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


class TestAceAccessories(Base):
    """The shop's ticked pages from Ace's accessories catalogue (2026-11-26): on view with Price TBD, never sold."""
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.acc = C.load_master("ace-acc")

    def test_master_validates_and_counts(self):
        C.validate_master(self.acc, self.reg)
        fams = self.acc["families"]
        self.assertEqual(len(fams), 39)
        self.assertEqual(sorted({f["category"] for f in fams}), ["bases", "bowls", "heat", "hoses", "parts"])
        self.assertTrue(all(len(f["variants"]) == 1 for f in fams))   # no colour variants from Ace's generic squares
        self.assertTrue(all(re.fullmatch(r"OSS-11\d{4}", v["sku"]) for _, v in C.iter_variants(self.acc)))

    def test_prices_private_and_missing_ones_asked(self):
        for f, v in C.iter_variants(self.acc):
            self.assertIsNone(v["shop"]["price_cents"]["v"], v["sku"])
            self.assertFalse(v["shop"]["active"]["v"], v["sku"])
        byp = {f["page"]: f for f in self.acc["families"]}
        self.assertEqual({p for p, f in byp.items() if f["supplier_price_cents"]["v"] is None}, {77, 79, 80})
        self.assertEqual(byp[81]["supplier_price_cents"]["v"], 250)   # printed "$2.5"
        self.assertEqual(byp[77]["stamp"]["v"], "unclear")

    def test_only_ticked_pages_listed(self):
        # owner 2026-11-26: a tick means in the shop, in stock; nothing is ordered in. Unticked pages never go on view.
        ace = C.load_master("ace")
        for supplier, m in (("ace", ace), ("ace-acc", self.acc)):
            stamp = {v["sku"]: f["stamp"]["v"] for f, v in C.iter_variants(m)}
            for r in K.desired_rows(supplier, m):
                self.assertEqual(r["shop"]["listed"], 0 if stamp[r["sku"]] == "none" else 1, (supplier, r["sku"]))
        unticked = [f for f in self.acc["families"] if f["stamp"]["v"] == "none"]
        self.assertEqual(unticked, [], "the accessories master holds only ticked pages")

    def test_rows_on_view_tbd_pickup_until_weighed(self):
        rows = K.desired_rows("ace-acc", self.acc)
        self.assertEqual(len(rows), 39)
        for r in rows:
            s, f = r["shop"], json.loads(r["sup"]["facts_known"])
            self.assertEqual((s["price_cents"], s["active"], s["listed"]), (0, 0, 1), r["sku"])
            self.assertTrue(r["sup"]["family"].startswith("acc-"))   # never grouped with the hookah families
            self.assertEqual(s["weight_g"], 1)
            self.assertIn("weight_g", f)
            self.assertIsNone(f["weight_g"])   # unknown weight: pickup or local delivery once priced
        names = {r["sup"]["family"]: r["shop"]["name"] for r in rows}
        # another maker's brand on the page: the name waits for the shop to confirm the piece is genuine
        for p in (6, 13, 16, 17, 72):
            self.assertRegex(names[f"acc-p{p}"], rf"No\. {p}$")
        self.assertNotIn("Quasar", " ".join(names.values()))

    def test_apply_twice_is_stable(self):
        p1 = K.apply_supplier(self.con, "ace-acc", self.acc)
        self.assertEqual(len(p1["added"]), 39)
        p2 = K.apply_supplier(self.con, "ace-acc", self.acc)
        self.assertEqual((len(p2["added"]), len(p2["changed"]), len(p2["retired"])), (0, 0, 0))
        n = self.con.execute("SELECT COUNT(*) FROM products WHERE supplier_id = 'ace-acc' AND listed = 1 AND active = 0 AND price_cents = 0").fetchone()[0]
        self.assertEqual(n, 39)

    def test_photos_exist(self):
        for f, v in C.iter_variants(self.acc):
            if v["photo"]["img"]:
                for suf in ("", "-m", "-s"):
                    self.assertTrue((C.STORE / "public" / "img" / "pc" / (v["photo"]["img"] + suf + ".webp")).exists(), v["photo"]["img"])
        none = [f["page"] for f, v in C.iter_variants(self.acc) if not v["photo"]["img"]]
        self.assertEqual(none, [6, 13, 16, 17, 72, 83])   # 83 has no cut-out; the five withheld names hold their photos too (maker's mark)

    def test_workbook_names_every_accessory(self):
        import openpyxl
        p = Path(self.tmp.name) / "wb.xlsx"
        sheet.write_workbook(p, {s: C.load_master(s) for s in C.BLOCKS if C.load_master(s)})
        wb = openpyxl.load_workbook(p)
        self.assertIn("Catalogue Ace accessories", wb.sheetnames)
        rows = [[c.value for c in r] for r in wb["Answers"].iter_rows(min_row=2)]
        acc = [r for r in rows if str(r[0]).startswith("OSS-11")]
        self.assertEqual(len(acc), 39)
        self.assertTrue(all(r[2] for r in acc))   # the shop can see what it is pricing


# the Drive folder's new items (2026-11-28, drive2-2026-11-28.sql): the live files made before carry the masters without them
DRIVE2_SKUS = {f"OSS-14{n:04d}" for n in range(28, 103)} | {"OSS-120033"}


def before_drive2(m):
    """A master as it was before the Drive folder's items of 2026-11-28 went in: those variants (and emptied families) out."""
    m = copy.deepcopy(m)
    for f in m["families"]:
        f["variants"] = [v for v in f["variants"] if v["sku"] not in DRIVE2_SKUS]
    m["families"] = [f for f in m["families"] if f["variants"]]
    if m["supplier"]["id"] == "shop-hoses":     # the source line and the Simba card's flags as they read then
        m["sources"][0].update(products=32, sha256="2d7f4538a7ee69a5c64343716ce3eecd71b67501f8cb1a957f0311fc40b7bf8c")
        for f in m["families"]:
            f["flags"] = [x for x in f["flags"] if not x.startswith("NEEDS SHOP: Green: only in the shop's counter photo IMG_20261125")]
    if m["supplier"]["id"] == "shop-hookahs":   # the source line as it read then
        m["sources"][0].update(file="IMG_0670..IMG_0715 (hookahs on the counter)", products=27,
                               sha256="4c9f270d50d0f4695bb513323d4768a30d982f9536c79c83a67b808872535aa9")
    return m


class TestShopHoses(Base):
    """The shop's own hanging hoses (2026-11-27): every one on view, Price TBD, in the shop, never from Ace."""
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.hoses = C.load_master("shop-hoses")

    def test_master_validates_and_counts(self):
        C.validate_master(self.hoses, self.reg)
        self.assertEqual(len(self.hoses["families"]), 21)
        self.assertEqual(sum(len(f["variants"]) for f in self.hoses["families"]), 33)   # 31 on the rack + Starbuzz light blue + Simba green
        self.assertTrue(all(re.fullmatch(r"OSS-12\d{4}", v["sku"]) for _, v in C.iter_variants(self.hoses)))

    def test_rebuild_is_stable(self):
        reg = copy.deepcopy(self.reg)
        m, retired = K.build_hoses(reg, "2099-01-01")
        C.carry_shop(self.hoses, m)
        self.assertEqual(retired, [])
        self.assertEqual(C.dumps(m), C.dumps(self.hoses))   # the committed master is what the source builds
        self.assertEqual(reg, self.reg)                     # no new numbers issued

    def test_names_and_lengths_as_captioned(self):
        by = {f["name"]["v"]: f for f in self.hoses["families"]}
        self.assertEqual(by["Aljomeyra Disposable Hose"]["facts"]["length"]["v"], "174 cm")
        self.assertEqual(by["Platinum Disposable Hose"]["facts"]["length"]["v"], "60.5 inch")
        self.assertEqual(by["No-name hose with end and mouthpiece attachments"]["facts"]["length"]["v"], "67 inches total")
        self.assertEqual([v["colour"]["v"] for v in by["Platinum Disposable Hose"]["variants"]], ["Yellow", "Black", "Green"])
        # given later as a photo's file name (Drive, 2026-11-27), written exactly as the file name says
        self.assertEqual(by["Starbuzz Ribbed Hose"]["facts"]["length"]["v"], "76.5 inches")
        self.assertIsNone(by["Royal Disposable Hose"]["facts"]["length"]["v"])   # not shown in "All disposable are 60.5 inches"

    def test_rows_on_view_tbd_not_ace(self):
        rows = K.desired_rows("shop-hoses", self.hoses)
        self.assertEqual(len(rows), 33)
        unsure = 0
        for r in rows:
            s, f = r["shop"], json.loads(r["sup"]["facts_known"])
            self.assertEqual((s["price_cents"], s["active"], s["listed"], s["stock"], s["category_id"], s["availability"]),
                             (0, 0, 1, 0, "hoses", "in_store_uncounted"), r["sku"])
            self.assertEqual(r["sup"]["supplier_id"], "shop-hoses")
            self.assertTrue(r["sup"]["family"].startswith("hose-"))
            self.assertIsNone(f["weight_g"])
            self.assertIn("length", f)
            # the light blue (OSS-120032) and the green Simba (OSS-120033) have no photo of their own yet: "Photo coming soon"
            self.assertTrue(r["sup"]["img"].startswith("hose/") or (r["sku"] in ("OSS-120032", "OSS-120033") and r["sup"]["img"] == "" and f["photo"] == "none"), r["sku"])
            unsure += bool(f.get("needs_confirm"))
            self.assertEqual(bool(f.get("needs_confirm")), bool(f.get("confirm_why")), r["sku"])
        self.assertEqual(unsure, 21)   # 12 captioned for sure, 21 marked for the shop to check (medium matches, Babylon, no caption, the light blue and the green Simba from counter photos)

    def test_photos_exist(self):
        self.assertEqual([v["sku"] for _, v in C.iter_variants(self.hoses) if v["photo"]["status"] == "none"], ["OSS-120033", "OSS-120032"])   # master order: the Simba card comes before the Starbuzz
        for f, v in C.iter_variants(self.hoses):
            if v["photo"]["status"] == "none":
                continue
            for suf in ("", "-m", "-s"):
                self.assertTrue((C.STORE / "public" / "img" / "pc" / (v["photo"]["img"] + suf + ".webp")).exists(), v["photo"]["img"])

    def test_live_file_matches_master(self):
        # hoses-2026-11-27.sql is the first upload (kept as it was applied); missing-items-2026-11-27.sql carries the seed as it
        # was before the Drive folder's green Simba (drive2-2026-11-28.sql adds that row alone, TestDrive2)
        self.assertEqual(live_sections(LIVE_MISSING)["shop-hoses"], K.seed_sql("shop-hoses", before_drive2(self.hoses)))

    def test_every_hose_photo_to_be_replaced(self):
        # owner 2026-11-27: "put a photo to be changed tag on all the hoses"; the photos themselves stay as they are
        rows = K.desired_rows("shop-hoses", self.hoses)
        self.assertEqual(len(rows), 33)
        for r in rows:
            f = json.loads(r["sup"]["facts_known"])
            # the light blue (OSS-120032) has no photo yet, so nothing to tag: it shows "Photo coming soon"
            want = ("none", None) if r["sku"] in ("OSS-120032", "OSS-120033") else ("own", "replace")
            self.assertEqual((f["photo"], f.get("photo_label")), want, r["sku"])

    def test_live_tag_over_applied_hoses_changes_only_the_label(self):
        """Over hoses as shop-photos-2026-11-27.sql left them, the new live file changes facts_known only (the tag), and a
        second run changes nothing."""
        con = self.con
        con.executescript(live_sections(LIVE_SHOP)["shop-hoses"])
        before = {r[0]: r[1:] for r in con.execute("SELECT sku, name, price_cents, stock, active, listed, img, family, variant_label, facts_known FROM products WHERE supplier_id = 'shop-hoses'")}
        con.executescript(live_sections(LIVE_MISSING)["shop-hoses"])
        after = {r[0]: r[1:] for r in con.execute("SELECT sku, name, price_cents, stock, active, listed, img, family, variant_label, facts_known FROM products WHERE supplier_id = 'shop-hoses'")}
        self.assertEqual(sorted(before) + ["OSS-120032"], sorted(after))   # the light blue is a new row, added by the same file
        for s in before:
            self.assertEqual(before[s][:-1], after[s][:-1], s)
            old, new = json.loads(before[s][-1]), json.loads(after[s][-1])
            self.assertNotIn("photo_label", old)
            self.assertEqual({**old, "photo_label": "replace"}, new, s)
        n = con.total_changes
        con.executescript(live_sections(LIVE_MISSING)["shop-hoses"])
        self.assertEqual(con.total_changes - n, 0)

    def test_apply_twice_is_stable(self):
        p1 = K.apply_supplier(self.con, "shop-hoses", self.hoses)
        self.assertEqual(len(p1["added"]), 33)
        p2 = K.apply_supplier(self.con, "shop-hoses", self.hoses)
        self.assertEqual((len(p2["added"]), len(p2["changed"]), len(p2["retired"])), (0, 0, 0))


class TestReverseSearch(Base):
    """Exact reverse-search rows (2026-11-27): makers' names for four stand-ins, web facts with their source, nothing about
    what comes in the box (owner: the hookahs are standalone), and a live file that never renames a row the shop renamed."""
    LIVE = C.CATALOG / "live" / "reverse-search-facts-2026-11-27.sql"
    NAMES = {"ace-tsar-molotov": "Tsar Molotov X/X+", "ace-tsar-ultimate-gold": "Tsar Ultimate",
             "ace-tsar-h-one": "Tsar H-One", "ace-flash-bang-amotion": "Amotion Flash Bang"}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.acc = C.load_master("ace-acc")

    def test_names_and_facts(self):
        fam = {f["family_id"]: f for f in self.ace["families"]}
        for fid, name in self.NAMES.items():
            for v in fam[fid]["variants"]:
                self.assertEqual(v["shop"]["display_name"]["v"], name)
                self.assertTrue(v["shop"]["display_name"]["src"].startswith("shop:owner yes 2026-11-27"))
        self.assertEqual(fam["ace-baseball-bat"]["facts"]["height_cm"]["v"], 68.5)
        self.assertEqual(fam["ace-tsar-ultimate-gold"]["facts"]["item_weight_g"]["v"], 4200)
        frank = next(f for f in self.acc["families"] if f["variants"][0]["sku"] == "OSS-110005")
        self.assertEqual((frank["facts"]["size"]["v"], frank["facts"]["item_weight_g"]["v"]), ("5 × 5 × 5 in", 330))
        for m in (self.ace, self.acc):
            for f in m["families"]:
                for k, c in f["facts"].items():
                    if (c["src"] or "").startswith("web:"):
                        self.assertNotIn(k, ("includes", "includes_base", "weight_g"))   # never what is in the box, never the pack weight
                        self.assertNotRegex(str(c["v"]).lower(), r"hose\b|bowl|mouthpiece|includ|comes with|\bhmd\b")

    def test_web_facts_survive_a_rebuild_and_stay_out_of_the_lineup(self):
        new = copy.deepcopy(self.ace)
        for f in new["families"]:   # what a rebuild from the PDF gives: no web facts
            for k in [k for k, c in f["facts"].items() if (c["src"] or "").startswith("web:")]:
                f["facts"][k] = C.cell(None, None) if k in ("height_cm", "weight_g") else None
            f["facts"] = {k: c for k, c in f["facts"].items() if c is not None}
        C.carry_web_facts(self.ace, new)
        self.assertEqual(C.dumps(new), C.dumps(self.ace))
        rows = {r["sku"]: r for r in K.desired_rows("ace", self.ace)}
        self.assertIsNone(rows["OSS-100116"]["sup"]["height_cm"])   # web height: a fact on the page, not drawn in the home line-up
        self.assertEqual(json.loads(rows["OSS-100116"]["sup"]["facts_known"])["height_cm"], 68.5)
        self.assertEqual(rows["OSS-100079"]["shop"]["name"], "Tsar Molotov X/X+")

    def test_live_file_renames_only_stand_ins_and_runs_twice(self):
        K.apply_supplier(self.con, "ace", self.ace)
        K.apply_supplier(self.con, "ace-acc", self.acc)
        self.con.execute("UPDATE products SET name = 'Hookah No. 26', facts_known = json_remove(facts_known, '$.material') WHERE family = 'ace-tsar-molotov'")
        self.con.execute("UPDATE products SET name = 'Shop''s own name' WHERE sku = 'OSS-100080'")   # renamed in the item editor
        self.con.execute("UPDATE products SET name = 'Hookah No. 30' WHERE family = 'ace-flash-bang-amotion'")
        sql = self.LIVE.read_text(encoding="utf-8")
        self.con.executescript(sql)
        name = lambda s: self.con.execute("SELECT name FROM products WHERE sku = ?", (s,)).fetchone()[0]
        self.assertEqual((name("OSS-100079"), name("OSS-100080"), name("OSS-100093")), ("Tsar Molotov X/X+", "Shop's own name", "Amotion Flash Bang"))
        self.assertEqual(self.con.execute("SELECT json_extract(facts_known, '$.material') FROM products WHERE sku = 'OSS-100079'").fetchone()[0], "Aluminium")
        audit = self.con.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'reverse-search-2026-11-27'").fetchone()[0]
        self.assertEqual(audit, 5 + 4)   # 5 Molotov colours still on the stand-in, 4 Flash Bang
        before = self.con.total_changes
        self.con.executescript(sql)
        self.assertEqual(self.con.total_changes, before)   # a second run changes nothing
        for sup, m in (("ace", self.ace), ("ace-acc", self.acc)):   # the file agrees with the masters
            for r in K.desired_rows(sup, m):
                if r["sku"] == "OSS-100080":
                    continue
                got = self.con.execute("SELECT facts_known, name FROM products WHERE sku = ?", (r["sku"],)).fetchone()
                self.assertEqual(json.loads(got[0]), json.loads(r["sup"]["facts_known"]), r["sku"])
                self.assertEqual(got[1], r["shop"]["name"], r["sku"])

LIVE_SHOP = "shop-photos-2026-11-27.sql"
LIVE_HOOKAHS = "shop-hookahs-2026-11-27.sql"
LIVE_MISSING = "missing-items-2026-11-27.sql"   # the live file carrying the bowl and hose seeds (hoses: before the green Simba, drive2)


class TestShopPhotosForAce(Base):
    """The shop's own photos standing in for Ace catalogue photos (shop_photos.py): the Rose hookah, 2026-11-27."""
    def test_every_shop_photo_is_published(self):
        from shop_photos import SHOP_PHOTOS
        for key, (img, _c, _p, _w) in SHOP_PHOTOS.items():
            for suf in ("", "-m", "-s"):   # a missing file would make the build fall back to the catalogue photo silently
                self.assertTrue((C.STORE / "public" / "img" / "pc" / (img + suf + ".webp")).exists(), img + suf)

    def test_rose_uses_the_shop_photo_without_a_label(self):
        ace = C.load_master("ace")
        v = next(v for f in ace["families"] for v in f["variants"] if v["sku"] == "OSS-100150")
        self.assertEqual((v["photo"]["img"], v["photo"]["status"]), ("shop/ace-rose-red", "shop"))
        self.assertNotIn("OSS-100150", [x["sku"] for x in ace["photo_labels"]])
        row = next(r for r in K.desired_rows("ace", ace) if r["sku"] == "OSS-100150")
        f = json.loads(row["sup"]["facts_known"])
        self.assertEqual((row["sup"]["img"], f["photo"]), ("shop/ace-rose-red", "own"))
        self.assertNotIn("photo_label", f)

    def test_live_rose_line_is_the_ace_seed_line(self):
        live = (C.CATALOG / "live" / LIVE_SHOP).read_text(encoding="utf-8").splitlines()
        mine = [l for l in live if l.startswith("UPDATE products SET supplier_id = 'ace'")]
        seed = [l for l in K.seed_sql("ace", C.load_master("ace")).splitlines()
                if l.startswith("UPDATE products SET supplier_id = 'ace'") and "WHERE sku = 'OSS-100150'" in l]
        # the Rose's measured chip colour came later, in hookah-glass-2026-11-27.sql (test_live_hookah_glass_targets_photo_keys)
        self.assertEqual(mine, [re.sub(r'"photo_hex": "#[0-9a-f]{6}", ', "", l) for l in seed])

    def test_tsar_uses_the_shop_photos(self):
        """Green and blue get their own shop photo, no label; red and yellow still say "Shown in blue", now on the shop's photo."""
        ace = C.load_master("ace")
        v = {v["sku"]: v for f in ace["families"] if f["family_id"] == "ace-tsar-molotov" for v in f["variants"]}
        self.assertEqual((v["OSS-100084"]["photo"]["img"], v["OSS-100084"]["photo"]["status"], v["OSS-100084"]["colour"]["v"]),
                         ("shop/ace-tsar-molotov-green", "shop", "green"))
        self.assertEqual((v["OSS-100081"]["photo"]["img"], v["OSS-100081"]["photo"]["status"]), ("shop/ace-tsar-molotov-blue", "shop"))
        labels = {x["sku"]: x for x in ace["photo_labels"]}
        self.assertNotIn("OSS-100081", labels); self.assertNotIn("OSS-100084", labels)
        for sku in ("OSS-100080", "OSS-100083"):
            self.assertEqual((labels[sku]["img"], labels[sku]["shown_in"]), ("shop/ace-tsar-molotov-blue", "blue"))
        for f in ace["families"]:   # no colour anywhere is left pointing at a catalogue photo that a shop photo replaced
            for x in f["variants"]:
                if x["photo"]["status"] == "family_hero_only":
                    self.assertNotEqual(x["photo"]["img"], "ace/ace-tsar-molotov-blue")

    def test_live_hookah_glass_targets_photo_keys(self):
        """Run on rows holding other facts and old photo values, the live file gives exactly catalog.py's img, label and photo
        keys, leaves every other fact and column alone, and a second run changes nothing."""
        import sqlite3
        skus = ("OSS-100080", "OSS-100081", "OSS-100083", "OSS-100084", "OSS-100150")
        rows = {r["sku"]: r["sup"] for r in K.desired_rows("ace", C.load_master("ace")) if r["sku"] in skus}
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE products (sku TEXT, name TEXT, supplier_id TEXT, img TEXT, variant_label TEXT, facts_known TEXT, updated_at TEXT)")
        for s in skus:
            old = {"height_cm": 61, "material": "web fact", "photo": "family", "photo_label": "shown_in", "shown_in": "blue", "photo_hex": "#000000"}
            db.execute("INSERT INTO products VALUES (?, 'Live name', 'ace', 'ace/old', '', ?, NULL)", (s, json.dumps(old)))
        # a bystander: the black Tsar keeps its web photo, so no line may touch it (nor any row not listed above)
        db.execute("INSERT INTO products VALUES ('OSS-100082', 'Live name', 'ace', 'ace/ace-tsar-molotov-black', 'black', '{\"photo\": \"own\"}', NULL)")
        sql = (C.CATALOG / "live" / "hookah-glass-2026-11-27.sql").read_text(encoding="utf-8")
        db.executescript(sql)
        self.assertEqual(db.execute("SELECT img, variant_label, facts_known, updated_at FROM products WHERE sku = 'OSS-100082'").fetchone(),
                         ("ace/ace-tsar-molotov-black", "black", '{"photo": "own"}', None))
        photo_keys = {"photo", "photo_hex", "photo_label", "shown_in", "photo_upscale"}
        for s in skus:
            name, img, label, fk = db.execute("SELECT name, img, variant_label, facts_known FROM products WHERE sku = ?", (s,)).fetchone()
            want = {k: v for k, v in json.loads(rows[s]["facts_known"]).items() if k in photo_keys}
            self.assertEqual((name, img, label), ("Live name", rows[s]["img"], rows[s]["variant_label"]), s)
            self.assertEqual(json.loads(fk), {"height_cm": 61, "material": "web fact", **want}, s)
        n = db.total_changes
        db.executescript(sql)
        self.assertEqual(db.total_changes, n)


def live_sections(name):
    """{supplier: its seed section} of a live file holding several seeds, each under its own '-- Generated by' line."""
    text = (C.CATALOG / "live" / name).read_text(encoding="utf-8")
    parts = text.split("-- Generated by ")[1:]
    return {re.search(r"suppliers/([a-z-]+)/master\.json", p).group(1): "-- Generated by " + p for p in parts}


class TestShopBowls(Base):
    """The shop's own bowls (2026-11-27): 28 branded + 37 with no brand under plain names, Price TBD, in the shop, own photo."""
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.bowls = C.load_master("shop-bowls")

    def test_master_validates_and_counts(self):
        C.validate_master(self.bowls, self.reg)
        self.assertEqual(len(self.bowls["families"]), 28)
        self.assertEqual(sum(len(f["variants"]) for f in self.bowls["families"]), 65)
        plain = [f for f in self.bowls["families"] if f["facts"]["brand"]["v"] is None]
        self.assertEqual((len(plain), sum(len(f["variants"]) for f in plain)), (18, 37))
        for f in plain:   # a plain name never claims a brand, a model or what comes with it
            self.assertNotRegex(f["name"]["v"].lower(), r"\b(zanobia|oblako|von|tas|yahya|ace)\b|includ|\bset\b")
            self.assertTrue(f["supplier_ref"]["v"].startswith("No brand ("), f["family_id"])
        # the first 28 keep their numbers: the new bowls only add SKUs after them
        skus = sorted(v["sku"] for _, v in C.iter_variants(self.bowls))
        self.assertEqual(skus, [f"OSS-13{n:04d}" for n in range(1, 66)])
        self.assertTrue(all(re.fullmatch(r"OSS-13\d{4}", v["sku"]) for _, v in C.iter_variants(self.bowls)))

    def test_rebuild_is_stable(self):
        reg = copy.deepcopy(self.reg)
        m, retired = K.build_bowls(reg, "2099-01-01")
        C.carry_shop(self.bowls, m)
        self.assertEqual(retired, [])
        self.assertEqual(C.dumps(m), C.dumps(self.bowls))
        self.assertEqual(reg, self.reg)

    def test_rows_on_view_tbd_flagged(self):
        rows = K.desired_rows("shop-bowls", self.bowls)
        self.assertEqual(len(rows), 65)
        for r in rows:
            s, f = r["shop"], json.loads(r["sup"]["facts_known"])
            self.assertEqual((s["price_cents"], s["active"], s["listed"], s["stock"], s["category_id"], s["availability"]),
                             (0, 0, 1, 0, "bowls", "in_store_uncounted"), r["sku"])
            self.assertEqual(r["sup"]["supplier_id"], "shop-bowls")
            self.assertTrue(r["sup"]["img"].startswith("bowl/"))
            self.assertEqual(f["photo"], "own")
            self.assertIsNone(f["weight_g"])
            self.assertTrue(f["needs_confirm"] and f["confirm_why"], r["sku"])   # every name carries a word of ours: all to check
            large = (C.STORE / "public" / "img" / "pc" / (r["sup"]["img"] + "-l.webp")).exists()
            self.assertEqual(r["sup"]["img_lw"], 1440 if large else None, r["sku"])

    def test_photos_exist_framed(self):
        from PIL import Image
        for f, v in C.iter_variants(self.bowls):
            for suf, size in (("", (720, 900)), ("-m", (540, 675)), ("-s", (360, 450))):
                p = C.STORE / "public" / "img" / "pc" / (v["photo"]["img"] + suf + ".webp")
                self.assertTrue(p.exists(), p)
                with Image.open(p) as im:
                    self.assertEqual((im.size, im.mode), (size, "RGBA"), p)
                    self.assertEqual(im.getpixel((0, 0))[3], 0, p)   # transparent round the product, never a white box

    def test_live_file_matches_master(self):
        self.assertEqual(live_sections(LIVE_MISSING)["shop-bowls"], K.seed_sql("shop-bowls", self.bowls))

    def test_apply_twice_is_stable(self):
        p1 = K.apply_supplier(self.con, "shop-bowls", self.bowls)
        self.assertEqual(len(p1["added"]), 65)
        p2 = K.apply_supplier(self.con, "shop-bowls", self.bowls)
        self.assertEqual((len(p2["added"]), len(p2["changed"]), len(p2["retired"])), (0, 0, 0))


class TestShopHookahs(Base):
    """The shop's own hookahs (2026-11-27): on view, Price TBD, in the shop, the original photo tagged to be replaced, every
    name flagged for the shop; no size, height or contents claimed."""
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.hk = C.load_master("shop-hookahs")
        cls.cleaned = {v["sku"] for _, v in C.iter_variants(cls.hk) if v["photo"]["status"] == "shop"}

    # names found later by an exact visual match (Yandex, LENS.csv; renamed in missing-items-2-2026-11-27.sql): the files
    # made before carry the plain name the hookah was first given
    RENAMED = {"OSS-140015": ("MOB Cloud King Supreme", "Hookah, frosted white base, red stripes"),
               "OSS-140019": ("Smokah Professional", "Hookah, clear base, brown stem")}

    def as_named_before(self):
        m = copy.deepcopy(self.hk)
        for _, v in C.iter_variants(m):
            if v["sku"] in self.RENAMED:
                v["shop"]["display_name"] = {"v": None, "src": None}
        return m

    def as_first_uploaded(self):
        """The master as shop-hookahs-2026-11-27.sql was made from it: every cleaned photo back to the tagged original."""
        m = before_drive2(self.as_named_before())
        for _, v in C.iter_variants(m):
            if v["photo"]["status"] == "shop":
                v["photo"]["status"] = "replace"
                v["photo"]["src"] = v["photo"]["src"].replace("cut out, the mat cleared: clear_glass2.py", "as taken: to be replaced")
        return m

    def test_cleaned_photos_match_the_list(self):
        import src_shop_hookahs as S
        self.assertTrue(self.cleaned)
        for _, v in C.iter_variants(self.hk):
            if v["sku"] in self.cleaned:
                self.assertIn("clear_glass2.py", v["photo"]["src"])
                self.assertTrue(any(f"photo:{p} " in v["photo"]["src"] for p in S.CLEANED), v["sku"])
        self.assertEqual(len(self.cleaned), len(S.CLEANED))

    def test_live_clean_file_matches_master(self):
        import live_clean_hookahs as L
        import src_shop_hookahs as S
        for out, photos, day in L.FILES:
            self.assertEqual(out.read_text(encoding="utf-8"), L.sql(self.as_named_before(), photos, day), out.name)
        sets = [p for _, p, _ in L.FILES] + [S.CLEANED_B]          # each cleaned photo goes live in one file only
        for i, a in enumerate(sets):
            for b in sets[i + 1:]:
                self.assertFalse(a & b, sorted(a & b))
        self.assertEqual(set().union(*[p for _, p, _ in L.FILES]) | S.CLEANED_B, S.CLEANED)   # and every one has its file (B: OUT_B)
        self.assertEqual(L.OUT_B.read_text(encoding="utf-8"), L.sql_b(self.hk, C.load_master("ace") if L.PANDA_READY else None))

    def test_live_clean_b_puts_the_panda_photo_on_its_empty_ace_row_only(self):
        import live_clean_hookahs as L
        if not L.PANDA_READY:
            self.skipTest("the Panda's photo is not wired yet")
        want = L.panda_row(C.load_master("ace"))["sup"]
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE products (sku TEXT, supplier_id TEXT, img TEXT, variant_label TEXT, facts_known TEXT, updated_at TEXT)")
        before = {"acrylic": None, "group": "full_size", "page": 25, "photo": "none", "stamp": "stamped"}
        db.execute("INSERT INTO products VALUES (?, 'ace', '', '', ?, NULL)", (L.PANDA, json.dumps(before)))
        # bystanders: another Ace row, and the Panda already showing a photo (never overwritten)
        db.execute("INSERT INTO products VALUES ('OSS-100078', 'ace', '', '', '{\"photo\": \"none\"}', NULL)")
        sql = L.OUT_B.read_text(encoding="utf-8")
        panda = [ln for ln in sql.splitlines() if ln.startswith("UPDATE") and L.PANDA in ln]
        self.assertEqual(len(panda), 1)
        db.executescript("\n".join(panda))
        img, label, fk = db.execute("SELECT img, variant_label, facts_known FROM products WHERE sku = ?", (L.PANDA,)).fetchone()
        self.assertEqual((img, label), (want["img"], want["variant_label"]))
        got, desired = json.loads(fk), json.loads(want["facts_known"])
        for k in L.PHOTO_KEYS:
            self.assertEqual(got.get(k), desired.get(k), k)
        self.assertEqual({k: v for k, v in got.items() if k not in L.PHOTO_KEYS}, {k: v for k, v in before.items() if k not in L.PHOTO_KEYS})
        self.assertEqual(db.execute("SELECT img FROM products WHERE sku = 'OSS-100078'").fetchone(), ("",))
        n = db.total_changes
        db.executescript("\n".join(panda))
        self.assertEqual(db.total_changes, n)          # safe twice: the row has its img now
        # the rollback in the header puts the live values back
        rb = [ln[4:] for ln in sql.splitlines() if ln.startswith("--   UPDATE") and L.PANDA in ln]
        self.assertEqual(len(rb), 1)
        db.executescript(rb[0])
        img, label, fk = db.execute("SELECT img, variant_label, facts_known FROM products WHERE sku = ?", (L.PANDA,)).fetchone()
        self.assertEqual((img, label, json.loads(fk)), ("", "", before))

    def test_live_clean_b_holds_only_group_b(self):
        import live_clean_hookahs as L
        import src_shop_hookahs as S
        self.assertFalse(S.CLEANED_B & (S.CLEANED_FIRST | S.CLEANED_A | S.CLEANED_A3 | S.CLEANED_A2 | S.CLEANED_C2))   # group B goes live in its own file only
        b = {r["sku"] for r in L.cleaned_rows(self.hk, S.CLEANED_B)}
        others = set().union(*[{r["sku"] for r in L.cleaned_rows(self.hk, p)} for _, p, _ in L.FILES])
        self.assertFalse(b & others)
        self.assertEqual(b | others, self.cleaned)

    def test_renamed_from_the_visual_match(self):
        rows = {r["sku"]: r for r in K.desired_rows("shop-hookahs", self.hk)}
        for sku, (new, old) in self.RENAMED.items():
            v = next(v for _, v in C.iter_variants(self.hk) if v["sku"] == sku)
            self.assertEqual(rows[sku]["shop"]["name"], new)
            self.assertIn("web: Yandex visual match, https://", v["shop"]["display_name"]["src"])   # shop: prefix so a rebuild keeps it (carry_shop)
        live = (C.CATALOG / "live" / "missing-items-2-2026-11-27.sql").read_text(encoding="utf-8")
        for sku, (new, old) in self.RENAMED.items():   # guarded on the plain name: a name the shop typed is never overwritten
            self.assertIn(f"UPDATE products SET name = {K.q(new)}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') "
                          f"WHERE sku = '{sku}' AND supplier_id = 'shop-hookahs' AND name = {K.q(old)};", live)

    def test_live_clean_file_moves_only_photo_keys_and_is_safe_twice(self):
        import live_clean_hookahs as L
        con = self.con
        con.executescript(live_sections(LIVE_HOOKAHS)["shop-hookahs"])
        cols = "sku, name, price_cents, stock, active, listed, img, family, variant_label, facts_known"
        before = {r[0]: r[1:] for r in con.execute(f"SELECT {cols} FROM products WHERE supplier_id = 'shop-hookahs'")}
        for out, _, _ in L.FILES:
            con.executescript(out.read_text(encoding="utf-8"))
        con.executescript(L.OUT_B.read_text(encoding="utf-8"))
        after = {r[0]: r[1:] for r in con.execute(f"SELECT {cols} FROM products WHERE supplier_id = 'shop-hookahs'")}
        want = {r["sku"]: json.loads(r["sup"]["facts_known"]) for r in K.desired_rows("shop-hookahs", self.hk)}
        for s in before:
            self.assertEqual(before[s][:-1], after[s][:-1], s)
            if s in self.cleaned:
                self.assertEqual(json.loads(after[s][-1]), want[s], s)
                self.assertEqual(json.loads(before[s][-1]), {**want[s], "photo_label": "replace", "photo_full": True}, s)
            else:
                self.assertEqual(before[s][-1], after[s][-1], s)
        n = con.total_changes
        for out, _, _ in L.FILES:
            con.executescript(out.read_text(encoding="utf-8"))
        con.executescript(L.OUT_B.read_text(encoding="utf-8"))
        self.assertEqual(con.total_changes - n, 0)

    def test_master_validates_and_counts(self):
        C.validate_master(self.hk, self.reg)
        self.assertEqual(len(self.hk["families"]), 22 + 57)   # + the Drive folder's 57 cards (2026-11-28)
        skus = [v["sku"] for _, v in C.iter_variants(self.hk)]
        self.assertEqual(skus, [f"OSS-14{n:04d}" for n in range(1, 103)])
        self.assertNotIn("IMG_0689", json.dumps(self.hk))   # the Panda is OSS-100077 already: never a second card

    def test_rebuild_is_stable(self):
        reg = copy.deepcopy(self.reg)
        m, retired = K.build_hookahs(reg, "2099-01-01")
        C.carry_shop(self.hk, m)
        self.assertEqual(retired, [])
        self.assertEqual(C.dumps(m), C.dumps(self.hk))
        self.assertEqual(reg, self.reg)

    def test_rows_on_view_tbd_flagged_tagged(self):
        rows = K.desired_rows("shop-hookahs", self.hk)
        self.assertEqual(len(rows), 102)
        web = [r for r in rows if "photo_src" in json.loads(r["sup"]["facts_known"])]
        self.assertEqual([r["sku"] for r in web], ["OSS-140001", "OSS-140002", "OSS-140003", "OSS-140004"])   # the Steamulations
        for r in rows:
            s, f = r["shop"], json.loads(r["sup"]["facts_known"])
            self.assertEqual((s["price_cents"], s["active"], s["listed"], s["stock"], s["category_id"], s["availability"], s["glass"], s["weight_g"]),
                             (0, 0, 1, 0, "hookahs", "in_store_uncounted", 1, 1), r["sku"])
            self.assertEqual(r["sup"]["supplier_id"], "shop-hookahs")
            self.assertTrue(r["sup"]["img"].startswith("hookah/"))
            if r in web:   # an exact model's web photo: no tag, framed like the Ace hookahs
                self.assertEqual((f["photo"], f["stamp"]), ("own", "shelf"), r["sku"])
                self.assertNotIn("photo_label", f); self.assertNotIn("photo_full", f)
                self.assertTrue(f["photo_src"].startswith("https://"), r["sku"])
            elif r["sku"] in self.cleaned:   # a cleaned shop photo (clear_glass2.py): cut out and framed, no tag
                self.assertEqual((f["photo"], f["stamp"]), ("own", "shelf"), r["sku"])
                self.assertNotIn("photo_label", f); self.assertNotIn("photo_full", f); self.assertNotIn("photo_src", f)
            else:          # the shop's original: full tile, "Photo to be replaced"
                self.assertEqual((f["photo"], f["photo_label"], f["photo_full"], f["stamp"]), ("own", "replace", True, "shelf"), r["sku"])
            self.assertIsNone(f["weight_g"])
            self.assertIsNone(r["sup"]["height_cm"])
            self.assertTrue(f["needs_confirm"] and f["confirm_why"], r["sku"])
            for k in ("height_cm", "includes", "includes_base", "size", "length"):
                self.assertNotIn(k, f, r["sku"])
            self.assertNotRegex(s["name"].lower(), r"hose|include|bowl|tong|cm\b|inch")
            fam = r["sup"]["family"]
            self.assertTrue(fam.startswith("hookah-") or (fam == "ace-rose" and r["sup"]["variant_label"] == "Blue"), fam)

    def test_family_prefix_is_grouped_on_the_site(self):
        js = (C.STORE / "src" / "catalog.js").read_text(encoding="utf-8")
        self.assertIn("/^(ace|hose|bowl|hookah)-/", js)

    def test_photos_exist_framed(self):
        from PIL import Image
        for f, v in C.iter_variants(self.hk):
            web = v["photo"]["status"] == "ready"
            for suf, size in (("", (720, 900)), ("-m", (540, 675)), ("-s", (360, 450))) + (() if web else (("-l", (1440, 1800)),)):
                p = C.STORE / "public" / "img" / "pc" / (v["photo"]["img"] + suf + ".webp")
                self.assertTrue(p.exists(), p)
                with Image.open(p) as im:
                    self.assertEqual(im.size, size, p)
                    if web or v["photo"]["status"] == "shop":   # a cut-out: transparent round the product, never a white box
                        self.assertEqual((im.mode, im.getpixel((0, 0))[3]), ("RGBA", 0), p)

    def test_live_file_matches_master(self):
        # the first upload, as made (cleaned photos since then: hookah-clean-2026-11-27.sql, tested above)
        self.assertEqual(live_sections(LIVE_HOOKAHS)["shop-hookahs"], K.seed_sql("shop-hookahs", self.as_first_uploaded()))

    def test_live_file_touches_only_new_rows(self):
        sql = live_sections(LIVE_HOOKAHS)["shop-hookahs"]
        for line in sql.splitlines():
            if line.startswith("UPDATE products"):
                self.assertTrue("supplier_id = 'shop-hookahs'" in line, line[:120])
            m = re.search(r"WHERE sku = '([^']+)'", line)
            if m:
                self.assertRegex(m.group(1), r"^OSS-14\d{4}$")

    def test_apply_twice_is_stable(self):
        p1 = K.apply_supplier(self.con, "shop-hookahs", self.hk)
        self.assertEqual(len(p1["added"]), 102)
        p2 = K.apply_supplier(self.con, "shop-hookahs", self.hk)
        self.assertEqual((len(p2["added"]), len(p2["changed"]), len(p2["retired"])), (0, 0, 0))



class TestDrive2(Base):
    """The shop's Google Drive folder, 2026-11-28 (reports/DRIVE-MANIFEST-2026-11-28.csv): every NEW item on the site as new
    rows only: 75 hookah colours in 57 cards (src_shop_hookahs.BATCH_2) and the green Simba hose."""
    LIVE = "drive2-2026-11-28.sql"

    def test_live_file_matches_masters(self):
        import live_drive2 as L
        self.assertEqual((C.CATALOG / "live" / self.LIVE).read_text(encoding="utf-8"), L.sql())
        self.assertEqual({s for k in L.NEW.values() for s in k}, DRIVE2_SKUS)

    def test_batch_is_upright_originals_tagged(self):
        import src_shop_hookahs as S
        hk = C.load_master("shop-hookahs")
        new = [(f, v) for f, v in C.iter_variants(hk) if v["sku"] in DRIVE2_SKUS]
        self.assertEqual((len(new), len({f["family_id"] for f, _ in new})), (75, 57))
        self.assertEqual(len(S.UPRIGHT), 75)
        for f, v in new:
            cleaned = any(f"photo:{p} " in v["photo"]["src"] for p in S.CLEANED)   # cleaned since: its tag off (a hookah-clean file)
            self.assertEqual(v["photo"]["status"], "shop" if cleaned else "replace", v["sku"])   # else the shop's original, "Photo to be replaced"
            self.assertTrue(any(f"photo:{p} " in v["photo"]["src"] for p in S.UPRIGHT), v["sku"])
            self.assertTrue(f["family_id"].startswith("hookah-"), f["family_id"])
        # the ones already on the site never get a second card
        text = json.dumps(hk)
        for photo in ("PXL_20261128_002516743", "PXL_20261128_002808548", "IMG_0730", "IMG_0731", "IMG_0733"):
            self.assertNotIn(photo, text)

    def test_touches_only_new_rows_and_is_safe_twice(self):
        con = self.con
        con.executescript(live_sections(LIVE_HOOKAHS)["shop-hookahs"])
        con.executescript(live_sections(LIVE_MISSING)["shop-hoses"])
        cols = "sku, name, price_cents, stock, active, listed, availability, img, family, variant_label, facts_known, updated_at"
        before = {r[0]: r[1:] for r in con.execute(f"SELECT {cols} FROM products")}
        text = (C.CATALOG / "live" / self.LIVE).read_text(encoding="utf-8")
        for line in text.splitlines():
            m = re.search(r"VALUES \('(OSS-\d+)'|WHERE sku = '(OSS-\d+)'", line)
            if m:
                self.assertIn(next(g for g in m.groups() if g), DRIVE2_SKUS, line[:120])
            self.assertNotIn("NOT IN (", line)            # no whole-supplier sweep
            self.assertFalse(line.startswith("INSERT OR IGNORE INTO catalog_imports"), line[:80])
        con.executescript(text)
        after = {r[0]: r[1:] for r in con.execute(f"SELECT {cols} FROM products")}
        self.assertEqual(sorted(set(after) - set(before)), sorted(DRIVE2_SKUS))
        for s in before:
            self.assertEqual(before[s], after[s], s)
        rows = {r["sku"]: r for r in K.desired_rows("shop-hookahs", C.load_master("shop-hookahs"))}
        rows.update({r["sku"]: r for r in K.desired_rows("shop-hoses", C.load_master("shop-hoses"))})
        for s in DRIVE2_SKUS:   # each new row is what the master says, on view, Price TBD, in the shop
            got = dict(zip(cols.split(", ")[1:], after[s]))
            self.assertEqual((got["price_cents"], got["stock"], got["active"], got["listed"], got["availability"]), (0, 0, 0, 1, "in_store_uncounted"), s)
            self.assertEqual((got["img"], got["family"], json.loads(got["facts_known"])),
                             (rows[s]["sup"]["img"], rows[s]["sup"]["family"], json.loads(rows[s]["sup"]["facts_known"])), s)
        n = con.total_changes
        con.executescript(text)
        self.assertEqual(con.total_changes - n, 0)

    def test_clean_files_after_drive2_take_only_the_tag_off(self):
        """A hookah-clean file for Drive items runs after this file (seed-files.mjs): on the rows it inserted, the cleaned
        ones end with the tag off and every other key as inserted, the rest untouched; safe twice."""
        import live_clean_hookahs as L
        con = self.con
        con.executescript(live_sections(LIVE_HOOKAHS)["shop-hookahs"])
        con.executescript(live_sections(LIVE_MISSING)["shop-hoses"])
        con.executescript((C.CATALOG / "live" / self.LIVE).read_text(encoding="utf-8"))
        hk = C.load_master("shop-hookahs")
        seeds = (C.STORE / "tools" / "seed-files.mjs").read_text(encoding="utf-8")
        for out, photos, _d in L.FILES:
            mine = {r["sku"] for r in L.cleaned_rows(hk, photos)} & DRIVE2_SKUS
            if not mine:
                continue
            self.assertGreater(seeds.index(out.name), seeds.index(self.LIVE), out.name)
            before = {r[0]: json.loads(r[1]) for r in con.execute("SELECT sku, facts_known FROM products")}
            con.executescript(out.read_text(encoding="utf-8"))
            after = {r[0]: json.loads(r[1]) for r in con.execute("SELECT sku, facts_known FROM products")}
            for s in after:
                if s in mine:
                    self.assertEqual(after[s].get("photo"), "own", s)
                    self.assertNotIn("photo_label", after[s], s)
                    self.assertNotIn("photo_full", after[s], s)
                    self.assertEqual({k: v for k, v in after[s].items() if k not in L.PHOTO_KEYS},
                                     {k: v for k, v in before[s].items() if k not in L.PHOTO_KEYS}, s)
                else:
                    self.assertEqual(after[s], before[s], s)
            n = con.total_changes
            con.executescript(out.read_text(encoding="utf-8"))
            self.assertEqual(con.total_changes - n, 0, out.name)

    def test_green_simba_joins_the_simba_card(self):
        h = C.load_master("shop-hoses")
        f, v = next((f, v) for f, v in C.iter_variants(h) if v["sku"] == "OSS-120033")
        self.assertEqual((f["family_id"], v["colour"]["v"], v["photo"]["status"]), ("hose-simba-disposable-hose", "Green", "none"))


class TestShopCharcoal(Base):
    """Charcoal in the shop's photos but not on its price list (2026-11-27): the Duracubes 72-cube box, Price TBD, pickup only."""
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.coal = C.load_master("shop-charcoal")

    def test_master_and_rebuild(self):
        C.validate_master(self.coal, self.reg)
        self.assertEqual([v["sku"] for _, v in C.iter_variants(self.coal)], ["OSS-150001"])
        reg = copy.deepcopy(self.reg)
        m, retired = K.build_shop_charcoal(reg, "2099-01-01")
        C.carry_shop(self.coal, m)
        self.assertEqual((retired, C.dumps(m), reg), ([], C.dumps(self.coal), self.reg))

    def test_row_is_tbd_charcoal_pickup_only(self):
        (r,) = K.desired_rows("shop-charcoal", self.coal)
        s, f = r["shop"], json.loads(r["sup"]["facts_known"])
        self.assertEqual((s["name"], s["category_id"], s["price_cents"], s["stock"], s["active"], s["listed"], s["ship_class"], s["availability"]),
                         ("Duracubes Coconut Charcoal Cubes, 72 cubes", "charcoal", 0, 0, 0, 1, "pickup_only", "in_store_uncounted"))
        self.assertTrue(r["sup"]["family"].startswith("charcoal-"))   # charcoal wherever the back office moves it
        self.assertEqual((f["photo"], f["brand"], f["count"], f["weight_g"]), ("own", "Duracubes", 72, None))
        self.assertTrue(f["needs_confirm"] and f["confirm_why"])
        for suf, size in (("", (720, 900)), ("-m", (540, 675)), ("-s", (360, 450)), ("-l", (1440, 1800))):
            from PIL import Image
            with Image.open(C.STORE / "public" / "img" / "pc" / (r["sup"]["img"] + suf + ".webp")) as im:
                self.assertEqual((im.size, im.mode, im.getpixel((0, 0))[3]), (size, "RGBA", 0))

    def test_live_file_matches_and_adds_only(self):
        text = (C.CATALOG / "live" / "missing-items-2-2026-11-27.sql").read_text(encoding="utf-8")
        part1 = live_sections("missing-items-2-2026-11-27.sql")["shop-charcoal"].split("-- Two of the shop's hookahs")[0]   # part 2: hookah names
        self.assertEqual(part1, K.seed_sql("shop-charcoal", self.coal))
        self.assertNotIn("DELETE", chr(10).join(l for l in text.splitlines() if not l.startswith("--")))

    def test_apply_twice_is_stable(self):
        p1 = K.apply_supplier(self.con, "shop-charcoal", self.coal)
        self.assertEqual(p1["added"], ["OSS-150001"])
        p2 = K.apply_supplier(self.con, "shop-charcoal", self.coal)
        self.assertEqual((len(p2["added"]), len(p2["changed"]), len(p2["retired"])), (0, 0, 0))


if __name__ == "__main__":
    unittest.main(verbosity=1)
