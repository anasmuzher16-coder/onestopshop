"""Tests for the catalogue pipeline. Run: python store/tools/catalog/test_catalog.py
Works on in-memory copies and a throwaway SQLite file; never touches the real master files or any live data."""
from __future__ import annotations

import copy
import json
import re
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog as K  # noqa: E402
import catlib as C  # noqa: E402
import sheet  # noqa: E402

MIG = C.STORE / "migrations"


def fresh_db(path: Path, with_0005=True):
    # every migration in order (the seed clears the account and back-office tables too), the two catalogue ones only
    # when asked: a database without them is what the import must refuse
    con = sqlite3.connect(path, isolation_level=None)
    catalogue = ("0005_catalog.sql", "0006_listed.sql")
    for f in sorted(p.name for p in MIG.glob("0*.sql")):
        if f not in catalogue:
            con.executescript((MIG / f).read_text(encoding="utf-8"))
    con.executescript((C.STORE / "seed" / "seed.sql").read_text(encoding="utf-8"))
    if with_0005:
        for f in catalogue:
            con.executescript((MIG / f).read_text(encoding="utf-8"))
    return con


def counts(con):
    return {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("products", "stock_moves", "audit_log", "catalog_imports")}


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ace = C.load_master("ace")
        cls.char = C.load_master("charcoal-foil")
        cls.reg = C.load_registry()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "t.sqlite"
        self.con = fresh_db(self.db)

    def tearDown(self):
        self.con.close()
        self.tmp.cleanup()


class TestMasters(Base):
    def test_masters_validate(self):
        C.validate_master(self.ace, self.reg)
        C.validate_master(self.char, self.reg)

    def test_ace_counts_and_stamps(self):
        fams = self.ace["families"]
        self.assertEqual(len(fams), 83)
        stamped = [f["page"] for f in fams if f["stamp"]["v"] != "none"]
        self.assertEqual(len(stamped), 26)
        need = {f["page"] for f in fams if f["stamp"]["needs_shop"]}
        self.assertEqual(need, {16, 26, 33, 36, 57})
        self.assertEqual({f["page"]: f["stamp"]["v"] for f in fams if f["page"] in (16, 33)}, {16: "unclear", 33: "unclear"})
        # stamped first
        self.assertTrue(all(f["stamp"]["v"] != "none" for f in fams[:26]))

    def test_ace_prices_private_and_items_off(self):
        for f, v in C.iter_variants(self.ace):
            self.assertIsNone(v["shop"]["price_cents"]["v"], v["sku"])
            self.assertFalse(v["shop"]["active"]["v"], v["sku"])
        priced = [f for f in self.ace["families"] if f["supplier_price_cents"]["v"] is not None]
        self.assertEqual(len(priced), 82)   # page 31 has no price

    def test_source_hash_recorded(self):
        self.assertEqual(self.ace["sources"][0]["sha256"], C.sha256_file(C.ACE_PDF)) if C.ACE_PDF.exists() else None
        self.assertRegex(self.ace["sources"][0]["sha256"], r"^[0-9a-f]{64}$")

    def test_charcoal_rules(self):
        fams = self.char["families"]
        self.assertEqual(len(fams), 87)   # 75 products + 12 single rolls
        for f in fams:
            v = f["variants"][0]
            self.assertEqual(v["shop"]["stock"]["v"], 10)
            self.assertEqual(f["facts"]["fulfilment"]["v"], "pickup_or_local_delivery" if f["category"] == "charcoal" else "ships")
        rows = {r["sku"]: r for r in K.desired_rows("charcoal-foil", self.char)}
        for f in fams:
            sku = f["variants"][0]["sku"]
            self.assertEqual(rows[sku]["shop"]["ship_class"], "pickup_only" if f["category"] == "charcoal" else "standard")
        self.assertEqual(set(self.char["retired"]), {"OSS-9137", "OSS-9159"})

    def test_shisha_all_off(self):
        m = C.load_master("shisha")
        vs = [v for _, v in C.iter_variants(m)]
        self.assertEqual(len(vs), 47)
        self.assertTrue(all(v["shop"]["active"]["v"] is False for v in vs))
        self.assertTrue(all(r["shop"]["active"] == 0 and r["shop"]["category_id"] == "shisha" for r in K.desired_rows("shisha", m)))

    def test_colour_names_never_from_swatches(self):
        for f, v in C.iter_variants(self.ace):
            src = v["colour"]["src"]
            if v["colour"]["v"]:
                self.assertTrue(src.startswith("photo:") and "human-confirm" in src, src)


class TestRegistry(unittest.TestCase):
    def test_retired_numbers_never_reused(self):
        reg = C.load_registry(Path(tempfile.mkdtemp()) / "none.json")
        a = C.sku_for(reg, "ace", "k1", "d")
        b = C.sku_for(reg, "ace", "k2", "d")
        C.retire_missing(reg, "ace", {"k1"}, "d", "gone")
        self.assertEqual(reg["skus"][b]["status"], "retired")
        c = C.sku_for(reg, "ace", "k3", "d")
        self.assertNotIn(c, (a, b))
        self.assertGreater(int(c[-4:]), int(b[-4:]))
        self.assertEqual(C.sku_for(reg, "ace", "k2", "d"), b)   # the same item coming back keeps its number
        C.validate_registry(reg)

    def test_registry_rejects_counter_behind(self):
        reg = C.load_registry(Path(tempfile.mkdtemp()) / "none.json")
        C.sku_for(reg, "ace", "k1", "d")
        reg["next"]["10"] = 1
        with self.assertRaises(C.RegistryError):
            C.validate_registry(reg)

    def test_registry_rejects_two_skus_one_key(self):
        reg = C.load_registry(Path(tempfile.mkdtemp()) / "none.json")
        C.sku_for(reg, "ace", "k1", "d")
        reg["skus"]["OSS-100005"] = {"supplier": "ace", "key": "k1", "status": "active"}
        reg["next"]["10"] = 10
        with self.assertRaises(C.RegistryError):
            C.validate_registry(reg)

    def test_master_rejects_retired_sku(self):
        m = copy.deepcopy(C.load_master("charcoal-foil"))
        m["families"][0]["variants"][0]["sku"] = "OSS-9137"
        with self.assertRaises(C.ValidationError):
            C.validate_master(m, C.load_registry())


class TestValidation(unittest.TestCase):
    def setUp(self):
        self.m = copy.deepcopy(C.load_master("ace"))
        self.v = self.m["families"][0]["variants"][0]

    def bad(self):
        with self.assertRaises(C.ValidationError):
            C.validate_master(self.m)

    def test_shelf_price_must_come_from_the_shop(self):
        f = self.m["families"][0]
        self.v["shop"]["price_cents"] = {"v": f["supplier_price_cents"]["v"], "src": f["supplier_price_cents"]["src"]}
        self.bad()

    def test_negative_supplier_price(self):
        self.m["families"][0]["supplier_price_cents"]["v"] = -5
        self.bad()

    def test_active_without_price(self):
        self.v["shop"]["active"] = {"v": True, "src": "shop:x"}
        self.bad()

    def test_value_without_source(self):
        self.m["families"][0]["supplier_ref"]["src"] = None
        self.bad()

    def test_bad_sku(self):
        self.v["sku"] = "OSS-12"
        self.bad()

    def test_duplicate_sku(self):
        self.m["families"][1]["variants"][0]["sku"] = self.v["sku"]
        self.bad()


class TestApply(Base):
    def test_idempotent(self):
        p1 = K.apply_supplier(self.con, "ace", self.ace)
        self.assertEqual(len(p1["added"]), 296)
        before = counts(self.con)
        p2 = K.apply_supplier(self.con, "ace", self.ace)
        self.assertEqual((len(p2["added"]), len(p2["changed"]), len(p2["retired"])), (0, 0, 0))
        self.assertEqual(counts(self.con), before)

    def test_ace_rows_off_with_no_shelf_price(self):
        K.apply_supplier(self.con, "ace", self.ace)
        r = self.con.execute("SELECT COUNT(*), SUM(active), SUM(price_cents), SUM(supplier_price_cents IS NOT NULL) FROM products WHERE supplier_id='ace'").fetchone()
        self.assertEqual(r[0], 296)
        self.assertEqual(r[1], 0)
        self.assertEqual(r[2], 0)
        self.assertGreater(r[3], 0)

    def test_never_overwrites_shop_fields(self):
        K.apply_supplier(self.con, "ace", self.ace)
        sku = self.ace["families"][0]["variants"][0]["sku"]
        self.con.execute("UPDATE products SET price_cents=7999, name='Shop name', stock=3, active=1, note='n', availability='counted' WHERE sku=?", (sku,))
        m = copy.deepcopy(self.ace)
        m["families"][0]["supplier_price_cents"]["v"] = 99900
        m["families"][0]["variants"][0]["colour"] = {"v": "night blue", "src": "photo:x human-confirm"}
        p = K.apply_supplier(self.con, "ace", m, shop_fill=True)
        row = self.con.execute("SELECT price_cents, name, stock, active, note, availability, supplier_price_cents, variant_label FROM products WHERE sku=?", (sku,)).fetchone()
        self.assertEqual(row[:6], (7999, "Shop name", 3, 1, "n", "counted"))
        self.assertEqual(row[6:], (99900, "night blue"))
        self.assertTrue(any(pr["sku"] == sku and pr["why"] == "supplier price changed" for pr in p["price_review"]))

    def test_shop_fill_only_fills_unset_prices(self):
        K.apply_supplier(self.con, "ace", self.ace)
        m = copy.deepcopy(self.ace)
        a, b = m["families"][0]["variants"][0], m["families"][0]["variants"][1]
        for v in (a, b):
            v["shop"]["price_cents"] = {"v": 6499, "src": "shop:answers test"}
        self.con.execute("UPDATE products SET price_cents=7000 WHERE sku=?", (b["sku"],))
        K.apply_supplier(self.con, "ace", m, shop_fill=True)
        got = dict(self.con.execute("SELECT sku, price_cents FROM products WHERE sku IN (?,?)", (a["sku"], b["sku"])).fetchall())
        self.assertEqual(got, {a["sku"]: 6499, b["sku"]: 7000})

    def test_cannot_switch_on_without_shop_price(self):
        K.apply_supplier(self.con, "ace", self.ace)
        sku = self.ace["families"][0]["variants"][0]["sku"]
        with self.assertRaises(sqlite3.IntegrityError):
            self.con.execute("UPDATE products SET active=1 WHERE sku=?", (sku,))

    def test_retired_items_marked_dropped_not_deleted(self):
        K.apply_supplier(self.con, "ace", self.ace)
        m = copy.deepcopy(self.ace)
        gone = m["families"].pop(0)
        p = K.apply_supplier(self.con, "ace", m)
        self.assertEqual(sorted(p["retired"]), sorted(v["sku"] for v in gone["variants"]))
        n = self.con.execute(f"SELECT COUNT(*) FROM products WHERE availability='dropped' AND sku IN ({','.join('?' * len(p['retired']))})", p["retired"]).fetchone()[0]
        self.assertEqual(n, len(p["retired"]))

    def test_charcoal_over_existing_rows_keeps_shop_values(self):
        # rows already made by another path (as the charcoal-in-Heat seed does), with the shop's own numbers
        # since section-waves merged, seed.sql already holds OSS-9101 (the charcoal-in-Heat seed itself): give it the shop's own numbers
        self.con.execute("INSERT OR IGNORE INTO products (sku,name,category_id,price_cents,weight_g,box_id,ship_class,stock) VALUES ('OSS-9101','Shop typed name','heat',1234,1,'XS','pickup_only',4)")
        self.con.execute("UPDATE products SET name='Shop typed name', price_cents=1234, stock=4, supplier_id=NULL WHERE sku='OSS-9101'")
        K.apply_supplier(self.con, "charcoal-foil", self.char)
        row = self.con.execute("SELECT name, price_cents, stock, supplier_id FROM products WHERE sku='OSS-9101'").fetchone()
        self.assertEqual(row, ("Shop typed name", 1234, 4, "charcoal-foil"))

    def test_refuses_db_without_migration(self):
        con = fresh_db(Path(self.tmp.name) / "old.sqlite", with_0005=False)
        with self.assertRaises(SystemExit):
            K.apply_supplier(con, "ace", self.ace)
        con.close()

    def test_apply_needs_local_flag(self):
        with self.assertRaises(SystemExit):
            K.main(["apply", "--db", str(self.db)])


class TestBreakerFixes(Base):
    """Regression tests for the adversarial review of 2026-11-24."""

    def test_apply_and_seed_refuse_supplier_price_on_the_shelf(self):
        m = copy.deepcopy(self.ace)
        f = m["families"][0]
        f["variants"][0]["shop"]["price_cents"] = {"v": f["supplier_price_cents"]["v"], "src": f["supplier_price_cents"]["src"]}
        f["variants"][0]["shop"]["active"] = {"v": True, "src": "shop:x"}
        with self.assertRaises(C.ValidationError):
            K.apply_supplier(self.con, "ace", m)
        with self.assertRaises(C.ValidationError):
            K.seed_sql("ace", m)
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM products WHERE supplier_id='ace'").fetchone()[0], 0)

    def test_seed_refuses_retired_sku_and_never_takes_over_another_suppliers_row(self):
        m = copy.deepcopy(self.char)
        m["families"][0]["variants"][0]["sku"] = "OSS-9137"
        with self.assertRaises(C.ValidationError):
            K.seed_sql("charcoal-foil", m)
        self.con.executescript(K.seed_sql("ace", self.ace))
        sku = self.ace["families"][0]["variants"][0]["sku"]
        sql = K.seed_sql("charcoal-foil", self.char).replace("'OSS-9301'", f"'{sku}'")
        self.con.executescript(sql)
        self.assertEqual(self.con.execute("SELECT supplier_id FROM products WHERE sku=?", (sku,)).fetchone()[0], "ace")

    def test_shop_answers_survive_leaving_and_coming_back(self):
        m1 = copy.deepcopy(self.ace)
        v = m1["families"][0]["variants"][0]
        v["shop"]["price_cents"] = {"v": 6499, "src": "shop:answers t"}
        m2 = copy.deepcopy(m1)
        m2["families"].pop(0)
        C.carry_shop(m1, m2)
        self.assertIn(v["sku"], m2["retired_shop"])
        m3 = copy.deepcopy(self.ace)
        C.carry_shop(m2, m3)
        self.assertEqual(m3["families"][0]["variants"][0]["shop"]["price_cents"]["v"], 6499)

    def test_returning_item_is_no_longer_dropped(self):
        K.apply_supplier(self.con, "ace", self.ace)
        m = copy.deepcopy(self.ace)
        sku = m["families"][0]["variants"][0]["sku"]
        m["families"].pop(0)
        K.apply_supplier(self.con, "ace", m)
        self.assertEqual(self.con.execute("SELECT availability FROM products WHERE sku=?", (sku,)).fetchone()[0], "dropped")
        p = K.apply_supplier(self.con, "ace", self.ace)
        self.assertIn(sku, p["returned"])
        self.assertNotEqual(self.con.execute("SELECT availability FROM products WHERE sku=?", (sku,)).fetchone()[0], "dropped")

    def test_shop_colour_wins_and_name_has_no_guess(self):
        m = copy.deepcopy(self.ace)
        v = m["families"][0]["variants"][0]
        v["shop"]["colour_confirmed"] = {"v": "Copper", "src": "shop:answers t"}
        r = {x["sku"]: x for x in K.desired_rows("ace", m)}[v["sku"]]
        self.assertEqual(r["sup"]["variant_label"], "Copper")
        self.assertNotIn(",", r["shop"]["name"])

    def test_refuses_to_adopt_row_from_another_section(self):
        self.con.execute("INSERT INTO products (sku,name,category_id,price_cents,weight_g,box_id) VALUES ('OSS-9601','Back office item','misc',100,1,'XS')")
        with self.assertRaises(C.ValidationError):
            K.apply_supplier(self.con, "shisha", C.load_master("shisha"))


class TestSeedSql(Base):
    def test_seed_twice_is_safe(self):
        sql = K.seed_sql("ace", self.ace)
        self.con.executescript(sql)
        sku = self.ace["families"][0]["variants"][0]["sku"]
        self.con.execute("UPDATE products SET price_cents=5555, name='Mine' WHERE sku=?", (sku,))
        before = counts(self.con)
        self.con.executescript(sql)
        self.assertEqual(counts(self.con), before)
        self.assertEqual(self.con.execute("SELECT price_cents, name FROM products WHERE sku=?", (sku,)).fetchone(), (5555, "Mine"))

    def test_seed_never_puts_supplier_price_on_the_shelf(self):
        for r in K.desired_rows("ace", self.ace):
            self.assertEqual(r["shop"]["price_cents"], 0)
            self.assertEqual(r["shop"]["active"], 0)


class TestNoPriceLeak(unittest.TestCase):
    def test_storefront_never_selects_supplier_columns(self):
        for f in ("catalog.js", "worker.js", "checkout.js"):
            src = (C.STORE / "src" / f).read_text(encoding="utf-8")
            self.assertNotIn("supplier_price", src, f)
            self.assertIsNone(re.search(r"SELECT\s+\*\s+FROM\s+products", src, re.I), f)

    def test_nothing_private_in_public(self):
        pub = C.STORE / "public"
        bad = [p for p in pub.rglob("*") if p.suffix.lower() in (".json", ".csv", ".xlsx", ".sql") and "ace" in p.parts]
        self.assertEqual(bad, [])
        for p in (pub / "img" / "pc" / "ace").glob("*"):
            self.assertRegex(p.name, r"^ace-[a-z0-9-]+(-m|-s)?\.webp$")

    def test_public_group_does_not_follow_the_supplier_price(self):
        m = copy.deepcopy(C.load_master("ace"))
        before = {r["sku"]: json.loads(r["sup"]["facts_known"])["group"] for r in K.desired_rows("ace", m)}
        for f in m["families"]:
            f["supplier_price_cents"]["v"] = 1 if (f["supplier_price_cents"]["v"] or 0) > 10000 else 999999
        after = {r["sku"]: json.loads(r["sup"]["facts_known"])["group"] for r in K.desired_rows("ace", m)}
        self.assertEqual(before, after)

    def test_facts_known_has_no_price(self):
        for r in K.desired_rows("ace", C.load_master("ace")):
            self.assertNotIn("price", r["sup"]["facts_known"])


class TestAnswers(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.masters = {s: copy.deepcopy(C.load_master(s)) for s in ("ace", "charcoal-foil")}
        self.xlsx = Path(self.tmp.name) / "book.xlsx"
        sheet.write_workbook(self.xlsx, self.masters)

    def tearDown(self):
        self.tmp.cleanup()

    def fill(self, rows):
        from openpyxl import load_workbook
        wb = load_workbook(self.xlsx)
        ws = wb["Answers"]
        heads = [c.value for c in ws[1]]
        where = {ws.cell(row=i, column=1).value: i for i in range(2, ws.max_row + 1)}
        for sku, vals in rows.items():
            i = where.get(sku)
            if i is None:
                i = ws.max_row + 1
                ws.cell(row=i, column=1, value=sku)
            for h, v in vals.items():
                ws.cell(row=i, column=heads.index(h.upper()) + 1, value=v)
        wb.save(self.xlsx)

    def test_sheets_present(self):
        from openpyxl import load_workbook
        names = load_workbook(self.xlsx).sheetnames
        for n in ("Summary", "Catalogue Ace", "Catalogue Charcoal & foil", "Questions for the shop", "Photo checklist", "Answers"):
            self.assertIn(n, names)

    def test_round_trip_writes_shop_fields_only(self):
        sku = self.masters["ace"]["families"][0]["variants"][0]["sku"]
        self.fill({sku: {"Your price ($, before tax)": 64.99, "Stock count": 2, "Colour name (correct it)": "Royal blue",
                         "Turn on in the shop? (yes/no)": "yes"}})
        before_sup = json.dumps(self.masters["ace"]["families"][0]["supplier_price_cents"])
        res = sheet.read_answers(self.xlsx, self.masters, write=False)
        self.assertEqual(res, {"ace": 4})
        v = self.masters["ace"]["families"][0]["variants"][0]
        self.assertEqual((v["shop"]["price_cents"]["v"], v["shop"]["stock"]["v"], v["shop"]["active"]["v"]), (6499, 2, True))
        self.assertTrue(v["shop"]["price_cents"]["src"].startswith("shop:answers"))
        self.assertEqual(json.dumps(self.masters["ace"]["families"][0]["supplier_price_cents"]), before_sup)
        # reading the same file again changes nothing
        self.assertEqual(sheet.read_answers(self.xlsx, self.masters, write=False), {})

    def rejects(self, rows):
        self.fill(rows)
        snap = json.dumps(self.masters)
        with self.assertRaises(sheet.AnswersError):
            sheet.read_answers(self.xlsx, self.masters, write=False)
        self.assertEqual(json.dumps(self.masters), snap)   # all or nothing

    def test_rejects_text_price(self):
        self.rejects({self.masters["ace"]["families"][0]["variants"][0]["sku"]: {"Your price ($, before tax)": "sixty"}})

    def test_rejects_negative_stock(self):
        self.rejects({self.masters["ace"]["families"][0]["variants"][0]["sku"]: {"Stock count": -1}})

    def test_rejects_retired_sku(self):
        self.rejects({"OSS-9137": {"Your price ($, before tax)": 9.99}})

    def test_rejects_unknown_sku(self):
        self.rejects({"OSS-109999": {"Your price ($, before tax)": 9.99}})

    def test_rejects_turn_on_without_price(self):
        self.rejects({self.masters["ace"]["families"][0]["variants"][0]["sku"]: {"Turn on in the shop? (yes/no)": "yes"}})

    def test_rejects_answers_with_no_sku(self):
        self.rejects({None: {"Your price ($, before tax)": 99, "Turn on in the shop? (yes/no)": "yes"}})

    def test_rejects_true_as_stock(self):
        self.rejects({self.masters["ace"]["families"][0]["variants"][0]["sku"]: {"Stock count": True}})

    def test_old_file_cannot_overwrite_newer_answers(self):
        import shutil
        sku = self.masters["ace"]["families"][0]["variants"][0]["sku"]
        old = Path(self.tmp.name) / "old.xlsx"
        shutil.copyfile(self.xlsx, old)
        self.fill({sku: {"Your price ($, before tax)": 64.99}})
        sheet.read_answers(self.xlsx, self.masters, write=False)
        self.xlsx = old
        self.rejects({sku: {"Your price ($, before tax)": 50}})

    def test_rejects_bad_yes_no(self):
        self.rejects({self.masters["ace"]["families"][0]["variants"][0]["sku"]: {"In stock here? (yes/no)": "maybe"}})


if __name__ == "__main__":
    unittest.main(verbosity=1)
