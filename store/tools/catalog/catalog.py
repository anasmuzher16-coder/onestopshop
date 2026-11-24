"""One Stop Shop catalogue pipeline. Usage (from the repo root):

  python store/tools/catalog/catalog.py build   [--ace-pdf PATH] [--intake DIR]   sources -> master files
  python store/tools/catalog/catalog.py xlsx    [--out FILE]                      the shop's spreadsheet
  python store/tools/catalog/catalog.py answers FILE.xlsx                         filled Answers sheet -> shop fields
  python store/tools/catalog/catalog.py plan    (--db FILE.sqlite | --snapshot backup.json) [--supplier ID]
  python store/tools/catalog/catalog.py apply   --local --db FILE.sqlite [--supplier ID] [--shop-fill]
  python store/tools/catalog/catalog.py seed    [--supplier ID]                   SQL for the D1 schema

Nothing here talks to the live database. apply refuses to run without --local and an explicit local file.
Rules and field ownership: store/catalog/SCHEMA.md.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catlib as C  # noqa: E402

SUPPLIER_META = {
    "ace": {"id": "ace", "name": "Ace Hookah", "sku_block": "OSS-10NNNN",
            "credit": "Credit Ace as text only. No Ace logo, marble or 'ACE IT' artwork on the site."},
    "charcoal-foil": {"id": "charcoal-foil", "name": "Charcoal and foil (the shop's own list)", "sku_block": "OSS-20NNNN (earlier items keep their OSS-9NNN numbers)",
                      "credit": "No supplier credit needed."},
    "shisha": {"id": "shisha", "name": "Tobacco-free shisha", "sku_block": "OSS-30NNNN", "credit": ""},
}
SHISHA_SECTION = "INSERT OR IGNORE INTO categories (id, name, tone, sort, active) VALUES ('shisha', 'Shisha', 'emerald', 8, 0)"


def today():
    import datetime as _d
    import zoneinfo
    return _d.datetime.now(zoneinfo.ZoneInfo("America/Toronto")).strftime("%Y-%m-%d")


# ------------------------------------------------------------------ build

def build_ace(reg, pdf: Path, photos_manifest, day):
    import src_ace
    _, pages = src_ace.read_pdf(pdf)
    fams = src_ace.families(pages)
    assign = {}   # variant key -> photo record
    hero = {}     # family -> img name of its hero shot
    if photos_manifest:
        for im in photos_manifest.get("images", []):
            if im.get("variant_key") and im.get("status") in ("ready", "CHECK"):
                assign.setdefault(im["variant_key"], im)
            if im.get("role") == "hero" and im.get("status") in ("ready", "CHECK"):
                hero.setdefault(im["family_id"], im["out"])
    live = set()
    out = []
    for f in fams:
        p = f"pdf:{src_ace.SRC_ID}#p{f['page']}"
        sw = f.pop("swatches") or [None]
        f.pop("images")
        variants, used = [], {}
        for i, s in enumerate(sw):
            hx = s["hex"] if s else None
            base = f"{f['family_id']}#{hx or 'one'}"
            used[base] = used.get(base, 0) + 1
            key = base if used[base] == 1 else f"{base}-{used[base]}"
            live.add(key)
            sku = C.sku_for(reg, "ace", key, day)
            ph = assign.get(key)
            colour = C.cell(ph["colour"], f"photo:{ph['out']} (p{ph['page']} xref {ph['xref']}), dominant colour; human-confirm") \
                if ph and ph.get("colour") else C.cell(None, None)
            img = ph["out"] if ph else hero.get(f["family_id"])
            variants.append({
                "sku": sku, "key": key,
                "swatch_hex": C.cell(hx, f"{p}:colour square {i + 1} fill (chip colour only; never a colour name)" if hx else None),
                "colour": colour,
                "photo": {"img": img, "status": (ph["status"] if ph else ("family_hero_only" if img else "none")),
                          "src": f"photo manifest store/catalog/suppliers/ace/photos.json" if img else None},
                "shop": C.blank_shop(),
            })
        f["variants"] = variants
        out.append(f)
    # stamped products first, then catalogue order
    out.sort(key=lambda f: (f["stamp"]["v"] == "none", f["page"]))
    retired = C.retire_missing(reg, "ace", live, day, "not in the catalogue any more")
    return out, retired


def build(args):
    day = today()
    reg = C.load_registry()
    summary = {}
    # Ace
    pdf = Path(args.ace_pdf)
    if pdf.exists():
        old = C.load_master("ace")
        manifest = C.load_json(C.SUPPLIERS / "ace" / "photos.json")
        fams, retired = build_ace(reg, pdf, manifest, day)
        import src_ace
        m = {"schema": C.SCHEMA_ID, "supplier": SUPPLIER_META["ace"],
             "sources": [{"id": src_ace.SRC_ID, "kind": "pdf", "file": pdf.name, "sha256": C.sha256_file(pdf),
                          "pages": 84, "products": len(fams), "edition": src_ace.EDITION, "received": src_ace.RECEIVED}],
             "rulings": ["shop 2026-11-24: the shop has its own prices; Ace's prices are stored only as the supplier price",
                         "every Ace item stays off until the shop's own price is set",
                         "colour names come from the photos and need a person to confirm them; the colour squares only set the chip colour"],
             "families": fams,
             "retired": {s: reg["skus"][s] for s in sorted(reg["skus"]) if reg["skus"][s]["supplier"] == "ace" and reg["skus"][s]["status"] == "retired"}}
        C.carry_shop(old, m)
        C.validate_master(m, reg)
        wrote = C.write_json(C.master_path("ace"), m)
        summary["ace"] = {"families": len(fams), "variants": sum(len(f["variants"]) for f in fams),
                          "stamped": sum(f["stamp"]["v"] != "none" for f in fams), "newly_retired": retired, "written": wrote}
    else:
        print(f"Ace PDF not found at {pdf}: Ace master left as it is.")
    # Charcoal and foil
    intake = Path(args.intake)
    if (intake / "catalogue-verified.json").exists():
        import src_charcoal
        old = C.load_master("charcoal-foil")
        data, photos = src_charcoal.load(intake)
        fams, retired_map = src_charcoal.families(data, photos, data["meta"]["source"])
        live = set()
        for f in fams:
            for v in f["variants"]:
                live.add(v["key"])
                v["sku"] = C.sku_for(reg, "charcoal-foil", v["key"], day, legacy=v["sku"])
        for sku, info in retired_map.items():
            if sku not in reg["skus"]:
                reg["skus"][sku] = {"supplier": "charcoal-foil", "key": f"retired:{sku}", "status": "retired", "assigned": day,
                                    "legacy": True, "history": [{"at": day, "event": "retired", "why": f"merged into {info['merged_into']}"}]}
        C.retire_missing(reg, "charcoal-foil", live | {f"retired:{s}" for s in retired_map}, day, "not on the shop's list any more")
        m = {"schema": C.SCHEMA_ID, "supplier": SUPPLIER_META["charcoal-foil"],
             "sources": [{"id": src_charcoal.SRC_ID, "kind": "verified intake", "file": "catalogue-verified.json",
                          "sha256": C.sha256_file(intake / "catalogue-verified.json"), "decisions": "DECISIONS.md",
                          "decisions_sha256": C.sha256_file(intake / "DECISIONS.md"), "original_list": data["meta"]["source"]}],
             "rulings": ["charcoal: pickup or local delivery only, never shipped by Canada Post or any carrier",
                         "foil: can ship, but each pack's weight is unknown",
                         "stock starts at 10 per item; the shop updates it as items sell",
                         "only the single rolls on the list are real; other boxes cannot be sold as rolls",
                         "nothing about ID or age on the customer side; staff check in person"],
             "families": fams, "retired": retired_map}
        C.carry_shop(old, m)
        C.validate_master(m, reg)
        wrote = C.write_json(C.master_path("charcoal-foil"), m)
        summary["charcoal-foil"] = {"families": len(fams), "variants": len(fams), "written": wrote}
    # Shisha: built only when its list exists
    sh = intake / "shisha" / "catalogue.json"
    if not sh.exists():
        stub = {"schema": C.SCHEMA_ID, "supplier": SUPPLIER_META["shisha"], "status": "STUB",
                "why": f"{sh} did not exist when the build ran; the owner's list is in source-shisha-2026-11-24.txt",
                "sources": [], "families": [], "retired": {}}
        C.write_json(C.master_path("shisha"), stub)
        summary["shisha"] = "stub (no shisha/catalogue.json yet)"
    else:
        import src_shisha
        old = C.load_master("shisha")
        data, path = src_shisha.load(intake)
        fams = src_shisha.families(data, C.STORE / "public" / "img" / "pc")
        live = set()
        for f in fams:
            for v in f["variants"]:
                live.add(v["key"])
                v["sku"] = C.sku_for(reg, "shisha", v["key"], day, legacy=v["sku"])
        C.retire_missing(reg, "shisha", live, day, "not on the shop's list any more")
        m = {"schema": C.SCHEMA_ID, "supplier": SUPPLIER_META["shisha"],
             "sources": [{"id": src_shisha.SRC_ID, "kind": "verified intake", "file": "shisha/catalogue.json", "sha256": C.sha256_file(path),
                          "prepared": data["meta"].get("prepared"), "original_list": "source-shisha-2026-11-24.txt"}],
             "rulings": ["prices are the shop's own, before tax", "stock starts at 10, sold-out at 0",
                         "every item stays off until the legal check and each supplier's lab certificate (not legal advice)",
                         "no health claims; 'tobacco-free, nicotine-free' only with the certificate behind it"],
             "families": fams, "retired": {}}
        C.carry_shop(old if old and old.get("families") else None, m)
        C.validate_master(m, reg)
        wrote = C.write_json(C.master_path("shisha"), m)
        summary["shisha"] = {"families": len(fams), "variants": sum(len(f["variants"]) for f in fams), "written": wrote}
    C.validate_registry(reg)
    C.write_json(C.REGISTRY, reg)
    print(json.dumps(summary, indent=1))
    return summary


# ------------------------------------------------------------------ rows for the database

def placeholder_name(ref: str, label: str | None):
    t = " ".join(w if any(c.isdigit() for c in w) else w.capitalize() for w in ref.replace("  ", " ").split())
    return f"{t}, {label}" if label else t


def desired_rows(supplier: str, m):
    """Each variant as a products row: supplier columns (kept in step) and first-insert defaults for shop columns."""
    rows = []
    for i, (f, v) in enumerate(C.iter_variants(m)):
        shop = v["shop"]
        facts = {k: c["v"] for k, c in f.get("facts", {}).items()}
        if supplier == "ace":
            label = v["colour"]["v"] or ""
            avail = "in_store_uncounted" if f["stamp"]["v"] != "none" else "special_order"
            facts.update({"group": f["group"]["v"], "page": f["page"], "stamp": f["stamp"]["v"]})
            sup = {"supplier_id": "ace", "supplier_ref": f["supplier_ref"]["v"], "supplier_price_cents": f["supplier_price_cents"]["v"],
                   "family": f["family_id"], "variant_label": label, "swatch_hex": v["swatch_hex"]["v"],
                   "img": v["photo"]["img"] or "", "height_cm": f["facts"]["height_cm"]["v"],
                   "facts_known": json.dumps(facts, sort_keys=True, ensure_ascii=False)}
            shopcols = {"name": shop["display_name"]["v"] or placeholder_name(f["supplier_ref"]["v"], label or None),
                        "category_id": "hookahs", "price_cents": shop["price_cents"]["v"] or 0, "weight_g": 2500, "box_id": "T",
                        "glass": 1, "ship_class": "standard", "note": "", "stock": shop["stock"]["v"] or 0, "low_stock_at": 1,
                        "active": 1 if (shop["active"]["v"] and shop["price_cents"]["v"]) else 0, "sort": 5000 + i, "availability": avail}
        else:
            charcoal = f["category"] == "charcoal"
            sup = {"supplier_id": supplier, "supplier_ref": f["supplier_ref"]["v"], "supplier_price_cents": None,
                   "family": f["family_id"], "variant_label": v["label"]["v"] or "", "swatch_hex": None,
                   "img": v["photo"]["img"] or "", "height_cm": None,
                   "facts_known": json.dumps(facts, sort_keys=True, ensure_ascii=False)}
            shopcols = {"name": shop["display_name"]["v"], "category_id": "shisha" if f["category"] == "shisha" else "heat",
                        "price_cents": shop["price_cents"]["v"] or 0,
                        "weight_g": 1, "box_id": "XS", "glass": 0, "ship_class": "pickup_only" if charcoal else "standard",
                        "note": shop["note"]["v"] or "", "stock": shop["stock"]["v"] or 0, "low_stock_at": 1,
                        "active": 1 if (shop["active"]["v"] and shop["price_cents"]["v"]) else 0, "sort": 3000 + i, "availability": "counted"}
        rows.append({"sku": v["sku"], "sup": sup, "shop": shopcols, "shop_master": shop})
    return rows


def suppliers_present():
    return [s for s in C.BLOCKS if (m := C.load_master(s)) and m.get("families")]


# ------------------------------------------------------------------ plan

def db_rows_from(args):
    if getattr(args, "db", None):
        con = sqlite3.connect(args.db)
        con.row_factory = sqlite3.Row
        cols = {r[1] for r in con.execute("PRAGMA table_info(products)")}
        rows = [dict(r) for r in con.execute("SELECT * FROM products")]
        con.close()
        return rows, cols
    snap = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    rows = snap["tables"]["products"]
    cols = set(rows[0]) if rows else set()
    return rows, cols


def compute_plan(supplier, m, db_rows, reg=None):
    reg = reg or C.load_registry()
    want = {r["sku"]: r for r in desired_rows(supplier, m)}
    have = {r["sku"]: r for r in db_rows}
    added, changed, retired, price_review, unchanged = [], [], [], [], 0
    for sku, w in want.items():
        h = have.get(sku)
        if h is None:
            added.append(sku)
            continue
        if h.get("supplier_id") not in (None, supplier):
            raise C.ValidationError(f"{sku} in the database belongs to {h.get('supplier_id')}, not {supplier}")
        diff = {k: (h.get(k), v) for k, v in w["sup"].items() if h.get(k) != v}
        if diff:
            changed.append({"sku": sku, "fields": diff})
            if "supplier_price_cents" in diff and h.get("supplier_price_cents") is not None:
                price_review.append({"sku": sku, "why": "supplier price changed", "was": diff["supplier_price_cents"][0],
                                     "now": diff["supplier_price_cents"][1], "shop_price_cents": h.get("price_cents")})
        else:
            unchanged += 1
        sp = w["shop_master"]["price_cents"]["v"]
        if sp is not None and h.get("price_cents") not in (sp,):
            price_review.append({"sku": sku, "why": "the shop's answer differs from the database price" if h.get("price_cents") else
                                 "the shop answered a price; the database has none yet (apply --shop-fill sets it)",
                                 "db_price_cents": h.get("price_cents"), "shop_answer_cents": sp})
        elif sp is None and supplier == "ace" and not h.get("price_cents"):
            price_review.append({"sku": sku, "why": "waiting for the shop's own price", "supplier_price_cents": w["sup"]["supplier_price_cents"]})
    for sku, h in have.items():
        if h.get("supplier_id") == supplier and sku not in want and h.get("availability") != "dropped":
            retired.append(sku)
    for sku in added:
        e = reg["skus"].get(sku)
        if not e or e["status"] != "active":
            raise C.ValidationError(f"refusing to add {sku}: not an active registry SKU")
    return {"supplier": supplier, "added": added, "changed": changed, "retired": retired,
            "price_review": price_review, "unchanged": unchanged}


def plan(args):
    rows, cols = db_rows_from(args)
    missing = [c for c in ("family", "supplier_id", "supplier_price_cents", "availability", "facts_known") if c not in cols]
    if missing:
        print("The database has no catalogue columns yet (" + ", ".join(missing) + "): run migration 0005 first. "
              "Planning as if every catalogue item is new.")
        rows = [{k: v for k, v in r.items()} for r in rows]
    out = []
    for s in ([args.supplier] if args.supplier else suppliers_present()):
        p = compute_plan(s, C.load_master(s), rows)
        out.append(p)
        print(f"\n== {s}: {len(p['added'])} added, {len(p['changed'])} changed, {len(p['retired'])} retired, "
              f"{p['unchanged']} unchanged, {len(p['price_review'])} on the price-review list")
        for c in p["changed"][:15]:
            print("  changed", c["sku"], ", ".join(f"{k}: {a!r} -> {b!r}" for k, (a, b) in c["fields"].items()))
        if p["retired"]:
            print("  retired", ", ".join(p["retired"]))
        why = {}
        for pr in p["price_review"]:
            why[pr["why"]] = why.get(pr["why"], 0) + 1
        for k, n in why.items():
            print(f"  price review: {n} x {k}")
    if args.json:
        Path(args.json).write_text(json.dumps(out, indent=1), encoding="utf-8")
    return out


# ------------------------------------------------------------------ apply (local only)

def ensure_schema(con):
    cols = {r[1] for r in con.execute("PRAGMA table_info(products)")}
    need = {"family", "variant_label", "swatch_hex", "supplier_id", "supplier_ref", "supplier_price_cents", "availability", "facts_known"}
    if not need <= cols:
        raise SystemExit("This database has no catalogue columns: apply migration 0005_catalog.sql to it first.")
    if not con.execute("SELECT 1 FROM sqlite_master WHERE name = 'catalog_imports'").fetchone():
        raise SystemExit("catalog_imports table missing: apply migration 0005_catalog.sql first.")


def apply_supplier(con, supplier, m, shop_fill=False, actor="catalog-import"):
    ensure_schema(con)
    cur = con.cursor()
    cur.row_factory = sqlite3.Row
    db_rows = [dict(r) for r in cur.execute("SELECT * FROM products")]
    p = compute_plan(supplier, m, db_rows)
    want = {r["sku"]: r for r in desired_rows(supplier, m)}
    have = {r["sku"]: r for r in db_rows}
    filled = []
    msha = C.master_hash(m)
    src_sha = (m.get("sources") or [{}])[0].get("sha256", "")
    con.execute("BEGIN")
    try:
        meta = SUPPLIER_META[supplier]
        con.execute("INSERT OR IGNORE INTO suppliers (id, name, sku_block, note) VALUES (?,?,?,?)",
                    (supplier, meta["name"], meta["sku_block"], meta["credit"]))
        if supplier == "shisha":   # its section is made switched off; turning it on is the shop's call
            con.execute(SHISHA_SECTION)
        for sku in p["added"]:
            w = want[sku]
            cols = {**w["shop"], **w["sup"]}
            con.execute(f"INSERT INTO products (sku, {', '.join(cols)}) VALUES (?{', ?' * len(cols)})", (sku, *cols.values()))
            if cols["stock"]:
                con.execute("INSERT INTO stock_moves (sku, delta, reason, ref, actor) VALUES (?,?, 'count', ?, ?)",
                            (sku, cols["stock"], f"catalogue import {supplier}", actor))
        for c in p["changed"]:
            ks = list(c["fields"])
            con.execute(f"UPDATE products SET {', '.join(k + ' = ?' for k in ks)}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?",
                        (*[c["fields"][k][1] for k in ks], c["sku"]))
        for sku in p["retired"]:
            con.execute("UPDATE products SET availability = 'dropped', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?", (sku,))
        if shop_fill:
            # The shop's answered price goes in only where the database has never had one. A price the shop has
            # already set (in the back office or earlier) is never overwritten.
            for sku, w in want.items():
                sp = w["shop_master"]["price_cents"]["v"]
                h = have.get(sku)
                if sp and h is not None and not h.get("price_cents"):
                    on = 1 if w["shop_master"]["active"]["v"] else 0
                    con.execute("UPDATE products SET price_cents = ?, active = CASE WHEN ? = 1 THEN 1 ELSE active END WHERE sku = ? AND price_cents = 0", (sp, on, sku))
                    filled.append(sku)
        n = len(p["added"]) + len(p["changed"]) + len(p["retired"]) + len(filled)
        logged = con.execute("SELECT 1 FROM catalog_imports WHERE supplier_id = ? AND master_sha256 = ?", (supplier, msha)).fetchone()
        if n or not logged:
            con.execute("INSERT OR IGNORE INTO catalog_imports (supplier_id, source_sha256, master_sha256, edition, added, updated, retired, price_review, actor) "
                        "VALUES (?,?,?,?,?,?,?,?,?)",
                        (supplier, src_sha, msha, (m.get("sources") or [{}])[0].get("edition", ""), len(p["added"]), len(p["changed"]),
                         len(p["retired"]), len(p["price_review"]), actor))
        if n:
            con.execute("INSERT INTO audit_log (actor, action, target, after) VALUES (?, 'catalog.apply', ?, ?)",
                        (actor, supplier, json.dumps({"added": len(p["added"]), "changed": len(p["changed"]), "retired": p["retired"],
                                                      "shop_filled": filled, "master_sha256": msha})))
        con.execute("COMMIT")
    except Exception:
        con.execute("ROLLBACK")
        raise
    p["shop_filled"] = filled
    return p


def apply(args):
    if not args.local:
        raise SystemExit("apply only runs against a local database: pass --local and --db FILE.sqlite. There is no remote mode.")
    if not args.db or not Path(args.db).exists():
        raise SystemExit("pass --db with an existing local .sqlite file (for example the worktree's .wrangler D1 file).")
    con = sqlite3.connect(args.db, isolation_level=None)
    con.execute("PRAGMA foreign_keys = ON")
    for s in ([args.supplier] if args.supplier else suppliers_present()):
        p = apply_supplier(con, s, C.load_master(s), shop_fill=args.shop_fill)
        print(f"{s}: added {len(p['added'])}, changed {len(p['changed'])}, retired {len(p['retired'])}, "
              f"shop prices filled {len(p['shop_filled'])}, unchanged {p['unchanged']}")
    con.close()


# ------------------------------------------------------------------ seed SQL

def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def seed_sql(supplier, m):
    rows = desired_rows(supplier, m)
    meta = SUPPLIER_META[supplier]
    msha = C.master_hash(m)
    src = (m.get("sources") or [{}])[0]
    out = [f"-- Generated by store/tools/catalog/catalog.py seed from store/catalog/suppliers/{supplier}/master.json",
           f"-- master sha256 {msha}. Safe to run twice: new items are inserted once, existing items get only their",
           "-- supplier columns refreshed. The shop's price, stock, name and on/off are never touched for an existing item.",
           f"INSERT OR IGNORE INTO suppliers (id, name, sku_block, note) VALUES ({q(supplier)}, {q(meta['name'])}, {q(meta['sku_block'])}, {q(meta['credit'])});"]
    if supplier == "shisha":
        out.append(SHISHA_SECTION + ";")
    for r in rows:
        cols = {**r["shop"], **r["sup"]}
        out.append(f"INSERT OR IGNORE INTO products (sku, {', '.join(cols)}) VALUES ({q(r['sku'])}, {', '.join(q(v) for v in cols.values())});")
        if cols["stock"]:
            out.append(f"INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT {q(r['sku'])}, {cols['stock']}, 'count', 'catalogue import {supplier}', 'catalog-import' WHERE changes() = 1;")
        sets = ", ".join(f"{k} = {q(v)}" for k, v in r["sup"].items())
        cond = " OR ".join(f"{k} IS NOT {q(v)}" for k, v in r["sup"].items())
        out.append(f"UPDATE products SET {sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = {q(r['sku'])} AND ({cond});")
    live = [r["sku"] for r in rows]
    out.append(f"UPDATE products SET availability = 'dropped' WHERE supplier_id = {q(supplier)} AND availability != 'dropped' AND sku NOT IN ({', '.join(q(s) for s in live)});")
    out.append(f"INSERT OR IGNORE INTO catalog_imports (supplier_id, source_sha256, master_sha256, edition, added, updated, retired, price_review, actor) "
               f"VALUES ({q(supplier)}, {q(src.get('sha256', ''))}, {q(msha)}, {q(src.get('edition', ''))}, 0, 0, 0, 0, 'catalog-seed');")
    return "\n".join(out) + "\n"


def seed(args):
    C.OUT.mkdir(parents=True, exist_ok=True)
    for s in ([args.supplier] if args.supplier else suppliers_present()):
        p = C.OUT / f"seed-{s}.sql"
        p.write_text(seed_sql(s, C.load_master(s)), encoding="utf-8", newline="\n")
        print("wrote", p)


# ------------------------------------------------------------------ spreadsheet and answers

def xlsx(args):
    import sheet
    p = Path(args.out) if args.out else C.OUT / "OneStopShop-Catalogue.xlsx"
    sheet.write_workbook(p, {s: C.load_master(s) for s in C.BLOCKS if C.load_master(s)})
    print("wrote", p)


def answers(args):
    import sheet
    res = sheet.read_answers(Path(args.file))
    print(json.dumps(res, indent=1))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--ace-pdf", default=str(C.ACE_PDF))
    b.add_argument("--intake", default=str(C.INTAKE))
    x = sub.add_parser("xlsx")
    x.add_argument("--out")
    a = sub.add_parser("answers")
    a.add_argument("file")
    pl = sub.add_parser("plan")
    g = pl.add_mutually_exclusive_group(required=True)
    g.add_argument("--db")
    g.add_argument("--snapshot")
    pl.add_argument("--supplier")
    pl.add_argument("--json")
    ay = sub.add_parser("apply")
    ay.add_argument("--local", action="store_true")
    ay.add_argument("--db")
    ay.add_argument("--supplier")
    ay.add_argument("--shop-fill", action="store_true")
    sd = sub.add_parser("seed")
    sd.add_argument("--supplier")
    args = ap.parse_args(argv)
    return {"build": build, "xlsx": xlsx, "answers": answers, "plan": plan, "apply": apply, "seed": seed}[args.cmd](args)


if __name__ == "__main__":
    main()
