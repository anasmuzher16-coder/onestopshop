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
    # Ace's accessories catalogue is its own master (not inside the hookah one): a different PDF, one item per page with no
    # colour variants, no hookah grouping or base rules, and its own photo set. Same supplier company, same credit rule.
    "ace-acc": {"id": "ace-acc", "name": "Ace Hookah (accessories)", "sku_block": "OSS-11NNNN",
                "credit": "Credit Ace as text only. No Ace logo, marble or 'ACE IT' artwork on the site."},
    # The shop's own hanging hoses (2026-11-27): no supplier catalogue, its shelf photos and the captions of its recording.
    "shop-hoses": {"id": "shop-hoses", "name": "The shop's own hoses", "sku_block": "OSS-12NNNN", "credit": "No supplier credit needed."},
}
SHISHA_SECTION = "INSERT OR IGNORE INTO categories (id, name, tone, sort, active) VALUES ('shisha', 'Shisha', 'emerald', 8, 0)"
# Charcoal, its own section after Heat (shop request, 2026-11-24): the sections from place 4 on move down one, once.
# The same two statements open store/catalog/live/charcoal-section-2026-11-24.sql. Both are safe to run twice.
CHARCOAL_SECTION = ("UPDATE categories SET sort = sort + 1 WHERE sort > 3 AND id <> 'charcoal' AND EXISTS (SELECT 1 FROM categories WHERE id <> 'charcoal' AND sort = 4) AND NOT EXISTS (SELECT 1 FROM categories WHERE id = 'charcoal')",
                    "INSERT OR IGNORE INTO categories (id, name, tone, sort, active) VALUES ('charcoal', 'Charcoal', 'ash', 4, 1)")


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
            if im.get("variant_key") and im.get("status") in USABLE_PHOTO:
                assign.setdefault(im["variant_key"], im)
            if im.get("role") == "hero" and im.get("status") in USABLE_PHOTO:
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


def build_acc(reg, pdf: Path, photos_manifest, day):
    import src_ace_acc
    _, pages = src_ace_acc.read_pdf(pdf)
    fams = src_ace_acc.families(pages)
    shots = {im["family_id"]: im for im in (photos_manifest or {}).get("images", [])}
    live = set()
    for f in fams:
        f.pop("photo_src")
        key = f["family_id"]
        live.add(key)
        ph = shots.get(key)
        ok = ph and ph.get("status") in USABLE_PHOTO and ph.get("out")
        f["variants"] = [{"sku": C.sku_for(reg, "ace-acc", key, day), "key": key,
                          "photo": {"img": ph["out"] if ok else None, "status": ph["status"] if ph else "none",
                                    "src": "photo manifest store/catalog/suppliers/ace-acc/photos.json" if ok else None},
                          "shop": C.blank_shop()}]
    fams.sort(key=lambda f: (f["stamp"]["v"] == "none", f["page"]))   # ticked first, then catalogue order
    retired = C.retire_missing(reg, "ace-acc", live, day, "not in the catalogue any more")
    return fams, retired


def build_hoses(reg, day):
    """The shop's hoses: one family per hose, one variant per colour photographed. Every photo must be published already."""
    import src_shop_hoses
    fams = src_shop_hoses.families()
    live = set()
    for f in fams:
        f["variants"] = []
        for v in f.pop("variants_src"):
            live.add(v["key"])
            img = v.pop("img")
            have = (C.STORE / "public" / "img" / "pc" / (img + ".webp")).exists()
            f["variants"].append({"sku": C.sku_for(reg, "shop-hoses", v["key"], day), "key": v["key"], "swatch_hex": v["swatch_hex"],
                                  "colour": v["colour"], "confirm": v["confirm"],
                                  "photo": {"img": img if have else None, "status": "ready" if have else "none",
                                            "src": f"photo:{v['photo_file']} (the shop's shelf photo, cut out, bag kept as film)" if have else None},
                                  "shop": C.blank_shop()})
    retired = C.retire_missing(reg, "shop-hoses", live, day, "not on the shop's hose list any more")
    m = {"schema": C.SCHEMA_ID, "supplier": SUPPLIER_META["shop-hoses"],
         "sources": [{"id": src_shop_hoses.SRC_ID, "kind": "shop photos and recording", "file": "IMG_0543..IMG_0579 (hanging rack) + recording captions",
                      "sha256": C.sha256_text(json.dumps(src_shop_hoses.HOSES, ensure_ascii=False)), "products": len(live),
                      "edition": src_shop_hoses.EDITION, "received": src_shop_hoses.RECEIVED}],
         "rulings": ["owner 2026-11-27: every hanging hose goes on the site now; the unsure ones are cleaned up later with the shop",
                     "names and lengths exactly as the recording's captions say them; no online names, no cm conversion",
                     "in the shop, Price TBD, stock not counted; the shop fills price, colours and stock in the item editor",
                     "pickup or local delivery once priced, until each hose's weight is known (same rule as the Ace accessories)"],
         "families": fams,
         "retired": {s: reg["skus"][s] for s in sorted(reg["skus"]) if reg["skus"][s]["supplier"] == "shop-hoses" and reg["skus"][s]["status"] == "retired"}}
    return m, retired


def build(args):
    day = today()
    reg = C.load_registry()
    summary = {}
    # The shop's hoses (no outside source: always built)
    old = C.load_master("shop-hoses")
    m, retired = build_hoses(reg, day)
    C.carry_shop(old, m)
    C.validate_master(m, reg)
    summary["shop-hoses"] = {"families": len(m["families"]), "variants": sum(len(f["variants"]) for f in m["families"]),
                             "newly_retired": retired, "written": C.write_json(C.master_path("shop-hoses"), m)}
    if getattr(args, "only", None) == "shop-hoses":
        C.validate_registry(reg)
        C.write_json(C.REGISTRY, reg)
        print(json.dumps(summary, indent=1))
        return summary
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
        m["photo_labels"] = photo_labels(m)
        C.validate_master(m, reg)
        wrote = C.write_json(C.master_path("ace"), m)
        summary["ace"] = {"families": len(fams), "variants": sum(len(f["variants"]) for f in fams),
                          "stamped": sum(f["stamp"]["v"] != "none" for f in fams), "newly_retired": retired, "written": wrote}
    else:
        print(f"Ace PDF not found at {pdf}: Ace master left as it is.")
    # Ace accessories (the pages the shop ticked)
    apdf = Path(args.acc_pdf)
    if apdf.exists():
        old = C.load_master("ace-acc")
        fams, retired = build_acc(reg, apdf, C.load_json(C.SUPPLIERS / "ace-acc" / "photos.json"), day)
        import src_ace_acc
        m = {"schema": C.SCHEMA_ID, "supplier": SUPPLIER_META["ace-acc"],
             "sources": [{"id": src_ace_acc.SRC_ID, "kind": "pdf", "file": apdf.name, "sha256": C.sha256_file(apdf),
                          "pages": src_ace_acc.PAGES, "products": len(fams), "edition": src_ace_acc.EDITION, "received": src_ace_acc.RECEIVED}],
             "rulings": ["owner 2026-11-26: only the pages the shop ticked go on the site, each with Price TBD; unticked pages stay off",
                         "Ace's prices are stored only as the supplier price; the shop sets its own",
                         "pickup or local delivery only until each item's weight is known"],
             "families": fams,
             "retired": {s: reg["skus"][s] for s in sorted(reg["skus"]) if reg["skus"][s]["supplier"] == "ace-acc" and reg["skus"][s]["status"] == "retired"}}
        C.carry_shop(old, m)
        C.validate_master(m, reg)
        wrote = C.write_json(C.master_path("ace-acc"), m)
        summary["ace-acc"] = {"families": len(fams), "newly_retired": retired, "written": wrote}
    else:
        print(f"Ace accessories PDF not found at {apdf}: its master left as it is.")
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

ACRONYMS = {"DMX", "EGY", "XME", "XM", "SS", "UFO", "ST3", "RX", "MR", "EL", "D"}


def placeholder_name(ref: str, label: str | None):
    import re
    ref = re.sub(r"\s*-\s*", "-", ref.replace("  ", " ").strip()).strip("-")   # "ISAC -ACE" -> "ISAC-ACE"
    word = lambda w: w if any(c.isdigit() for c in w) else (w.upper() if w.upper() in ACRONYMS else w.capitalize())
    t = " ".join("-".join(word(p) for p in w.split("-")) for w in ref.split())
    return f"{t}, {label}" if label else t


def public_name(f) -> str:
    """The shop-owned name a catalogue item starts with. A name that carries another brand's name is withheld until the
    shop confirms the piece is genuine (plan 2026-11-24 section 8): it starts as 'Hookah No. <catalogue page>'."""
    if any("another brand's name" in x for x in f.get("flags", [])):
        return f"Hookah No. {f['page']}"
    return placeholder_name(f["supplier_ref"]["v"], None)


def public_group(f):
    """The kind a shopper sees. The master's group rule also uses the supplier price (<= $30 compact, >= $150 statement);
    a heading built from it would tell anyone the supplier price band, so the public kind is worked out from the name
    and the printed facts only (breaker, 2026-11-24). The master's own group stays as it is, for the shop."""
    import src_ace
    tags = (["without_base"] if f["facts"]["includes_base"]["v"] is False else []) + (["acrylic"] if f["facts"]["acrylic"]["v"] else [])
    return src_ace.group_for(f["supplier_ref"]["v"], None, tags)[0]


USABLE_PHOTO = ("ready", "CHECK", "needs_original", "hand_crop")   # gallery-only images are never a main photo
# owner, 2026-11-24: blurry or over-enlarged (CHECK), held (needs_original) and hand-crop photos go up labelled "Photo to be upscaled"
UPSCALE_PHOTO = ("CHECK", "needs_original", "hand_crop")


def hero_colour(f):
    """The colour the family's main photo shows: the variant whose own photo it is."""
    imgs = {v["photo"]["img"]: v for v in f["variants"] if v["photo"]["status"] in USABLE_PHOTO and v["photo"]["img"]}
    for v in f["variants"]:
        if v["photo"]["status"] == "family_hero_only" and v["photo"]["img"] in imgs:
            h = imgs[v["photo"]["img"]]
            return (h["shop"]["colour_confirmed"]["v"] or h["colour"]["v"] or ""), h["photo"]["status"]
    return "", None


def photo_labels(m):
    """Every Ace photo that goes up with a label (owner, 2026-11-24), so the shop can replace it later:
    upscale = enlarged past 1.25x (CHECK), held past 2x, or a hand crop, shown with "Photo to be upscaled";
    shown_in = a colour with no photo of its own, shown with its family's photo and "Shown in <colour>"."""
    out = []
    for f in m["families"]:
        shown, _ = hero_colour(f)
        for v in f["variants"]:
            st = v["photo"]["status"]
            if st in UPSCALE_PHOTO:
                out.append({"sku": v["sku"], "family": f["family_id"], "photo_status": "upscale", "img": v["photo"]["img"]})
            elif st == "family_hero_only" and v["photo"]["img"]:
                out.append({"sku": v["sku"], "family": f["family_id"], "photo_status": "shown_in", "img": v["photo"]["img"], "shown_in": shown or None})
    return out


def labels(args):
    m = C.load_master("ace")
    m["photo_labels"] = photo_labels(m)
    C.validate_master(m, C.load_registry())
    C.write_json(C.master_path("ace"), m)
    n = {k: sum(1 for x in m["photo_labels"] if x["photo_status"] == k) for k in ("upscale", "shown_in")}
    print(f"photo_labels written to the Ace master: {n['upscale']} to be upscaled, {n['shown_in']} shown in another colour")


def photo_colours():
    """Measured colour of each published Ace photo (photos.json), so a colour chip matches the photo it shows."""
    man = C.load_json(C.SUPPLIERS / "ace" / "photos.json", {}) or {}
    out = {}
    for im in man.get("images", []):
        if im.get("out") and im.get("rgb") and im.get("status") in USABLE_PHOTO:
            out[im["out"]] = "#%02x%02x%02x" % tuple(im["rgb"])
    return out


def desired_rows(supplier: str, m):
    """Each variant as a products row: supplier columns (kept in step) and first-insert defaults for shop columns."""
    rows = []
    hexes = photo_colours() if supplier == "ace" else {}
    for i, (f, v) in enumerate(C.iter_variants(m)):
        shop = v["shop"]
        facts = {k: c["v"] for k, c in f.get("facts", {}).items()}
        if supplier == "ace":
            # the shop's corrected colour name wins over the photo's guess
            label = shop["colour_confirmed"]["v"] or v["colour"]["v"] or ""
            avail = "in_store_uncounted" if (f["stamp"]["v"] != "none" or shop["in_stock_here"]["v"]) else "special_order"
            facts.update({"group": public_group(f), "page": f["page"], "stamp": f["stamp"]["v"]})
            # photo: this colour's own usable photo (ready, CHECK), the family's main photo standing in, or none
            st = v["photo"]["status"]
            facts["photo"] = "own" if st in USABLE_PHOTO and v["photo"]["img"] else ("family" if st == "family_hero_only" and v["photo"]["img"] else "none")
            # the label the photo carries on the site (owner, 2026-11-24): "Photo to be upscaled", or "Shown in <colour>"
            if facts["photo"] == "own" and st in UPSCALE_PHOTO:
                facts["photo_label"] = "upscale"
            elif facts["photo"] == "family":
                shown, hst = hero_colour(f)
                facts["photo_label"] = "shown_in"
                facts["shown_in"] = shown or None
                if hst in UPSCALE_PHOTO:
                    facts["photo_upscale"] = True
            facts["colour_confirmed"] = bool(shop["colour_confirmed"]["v"])   # a photo's guess is shown as "Colours TBD", never as fact
            if facts["photo"] == "own" and v["photo"]["img"] in hexes:
                facts["photo_hex"] = hexes[v["photo"]["img"]]
            sup = {"supplier_id": "ace", "supplier_ref": f["supplier_ref"]["v"], "supplier_price_cents": f["supplier_price_cents"]["v"],
                   "family": f["family_id"], "variant_label": label, "swatch_hex": v["swatch_hex"]["v"],
                   "img": v["photo"]["img"] or "", "height_cm": f["facts"]["height_cm"]["v"],
                   "facts_known": json.dumps(facts, sort_keys=True, ensure_ascii=False)}
            # the colour lives in variant_label, never baked into the shop-owned name (a guess would freeze there)
            shopcols = {"name": shop["display_name"]["v"] or public_name(f),
                        "category_id": "hookahs", "price_cents": shop["price_cents"]["v"] or 0, "weight_g": 2500, "box_id": "T",
                        "glass": 1, "ship_class": "standard", "note": "", "stock": shop["stock"]["v"] or 0, "low_stock_at": 1,
                        "active": 1 if (shop["active"]["v"] and shop["price_cents"]["v"]) else 0, "sort": 5000 + i, "availability": avail,
                        # on view with "Price TBD" from the start (owner, 2026-11-24); buyable only once priced and on.
                        # Only what the shop ticked is on view: a tick means it is in the shop, in stock, and nothing is
                        # ordered in (owner, 2026-11-26). An unticked page stays in the master, off the site.
                        "listed": 1 if f["stamp"]["v"] != "none" else 0}
        elif supplier == "shop-hoses":
            # one family per hose, a colour per photo (grouped like the hookahs: one card, colour chips). In the shop (its own
            # shelf photo), Price TBD, stock not counted. Weight unknown: the 1 g placeholder plus facts.weight_g = null keep it
            # pickup or local delivery once priced, like the Ace accessories. needs_confirm and its reason are for the back office
            # only (catalog.js never sends them to the storefront).
            st = v["photo"]["status"]
            facts.update({"stamp": "shelf", "photo": "own" if st in USABLE_PHOTO and v["photo"]["img"] else "none", "colour_confirmed": True})
            if v["confirm"]["v"]:
                facts.update({"needs_confirm": True, "confirm_why": v["confirm"]["v"]})
            sup = {"supplier_id": "shop-hoses", "supplier_ref": f["supplier_ref"]["v"], "supplier_price_cents": None,
                   "family": f["family_id"], "variant_label": v["colour"]["v"], "swatch_hex": v["swatch_hex"]["v"],
                   "img": v["photo"]["img"] or "", "height_cm": None,
                   "facts_known": json.dumps(facts, sort_keys=True, ensure_ascii=False)}
            shopcols = {"name": shop["display_name"]["v"] or f["name"]["v"], "category_id": "hoses",
                        "price_cents": shop["price_cents"]["v"] or 0, "weight_g": 1, "box_id": "XS", "glass": 0, "ship_class": "standard",
                        "note": "", "stock": shop["stock"]["v"] or 0, "low_stock_at": 1,
                        "active": 1 if (shop["active"]["v"] and shop["price_cents"]["v"]) else 0,
                        "sort": 4500 + i, "availability": "in_store_uncounted", "listed": 1}
        elif supplier == "ace-acc":
            # one card per item (family acc-..., never grouped like hookahs); on view with "Price TBD" until the shop's price.
            # Weight unknown: the 1 g placeholder plus facts.weight_g = null keep it pickup or local delivery once priced.
            st = v["photo"]["status"]
            facts.update({"page": f["page"], "stamp": f["stamp"]["v"],
                          "photo": "own" if st in USABLE_PHOTO and v["photo"]["img"] else "none"})
            if facts["photo"] == "own" and st in UPSCALE_PHOTO:
                facts["photo_label"] = "upscale"
            facts.pop("glass", None)
            # another maker's brand on the page: the name waits until the shop confirms the piece is genuine (hookah rule)
            name = f["withheld_name"]["v"] or f["name"]["v"]
            ticked = f["stamp"]["v"] != "none"
            glass = bool(f["facts"].get("glass", {}).get("v"))
            sup = {"supplier_id": "ace-acc", "supplier_ref": f["supplier_ref"]["v"], "supplier_price_cents": f["supplier_price_cents"]["v"],
                   "family": f["family_id"], "variant_label": "", "swatch_hex": None,
                   "img": v["photo"]["img"] or "", "height_cm": None,
                   "facts_known": json.dumps(facts, sort_keys=True, ensure_ascii=False)}
            shopcols = {"name": shop["display_name"]["v"] or name, "category_id": f["category"],
                        "price_cents": shop["price_cents"]["v"] or 0, "weight_g": 1, "box_id": "S" if glass else "XS",
                        "glass": 1 if glass else 0, "ship_class": "standard", "note": "", "stock": shop["stock"]["v"] or 0,
                        "low_stock_at": 1, "active": 1 if (shop["active"]["v"] and shop["price_cents"]["v"]) else 0,
                        # only ticked pages are on view: a tick means in the shop, in stock; nothing is ordered in (owner, 2026-11-26)
                        "sort": 4000 + i, "availability": "in_store_uncounted", "listed": 1 if ticked else 0}
        else:
            charcoal = f["category"] == "charcoal"
            sup = {"supplier_id": supplier, "supplier_ref": f["supplier_ref"]["v"], "supplier_price_cents": None,
                   "family": f["family_id"], "variant_label": v["label"]["v"] or "", "swatch_hex": None,
                   "img": v["photo"]["img"] or "", "height_cm": None,
                   "facts_known": json.dumps(facts, sort_keys=True, ensure_ascii=False)}
            shopcols = {"name": shop["display_name"]["v"], "category_id": "shisha" if f["category"] == "shisha" else "charcoal" if charcoal else "heat",   # Charcoal its own section (2026-11-24); Heat keeps foil
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
    returned = [sku for sku, w in want.items() if sku in have and have[sku].get("availability") == "dropped"]
    for sku, w in want.items():
        h = have.get(sku)
        # a row made elsewhere (no supplier yet) is adopted only when it sits in the section this item belongs to
        home = ("heat", "charcoal") if w["shop"]["category_id"] == "charcoal" else (w["shop"]["category_id"],)   # charcoal made before 2026-11-24 may still sit in Heat
        if h is not None and h.get("supplier_id") is None and h.get("category_id") not in home:
            raise C.ValidationError(f"{sku} exists in the database in section {h.get('category_id')!r}, not {w['shop']['category_id']!r}: "
                                    "refusing to take it over (a back-office number may have collided with the registry)")
    for sku, h in have.items():
        if h.get("supplier_id") == supplier and sku not in want and h.get("availability") != "dropped":
            retired.append(sku)
    for sku in added:
        e = reg["skus"].get(sku)
        if not e or e["status"] != "active":
            raise C.ValidationError(f"refusing to add {sku}: not an active registry SKU")
    return {"supplier": supplier, "added": added, "changed": changed, "retired": retired, "returned": returned,
            "price_review": price_review, "unchanged": unchanged - len([s for s in returned if s not in {c['sku'] for c in changed}])}


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
    if "listed" not in cols:
        raise SystemExit("This database has no listed column: apply migration 0006_listed.sql to it first.")


def apply_supplier(con, supplier, m, shop_fill=False, actor="catalog-import"):
    C.validate_master(m, C.load_registry())   # a hand-edited master never reaches the database unchecked
    if m["supplier"]["id"] != supplier:
        raise C.ValidationError(f"this master belongs to {m['supplier']['id']}, not {supplier}")
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
        if supplier == "charcoal-foil":   # charcoal has its own section since 2026-11-24 (made if missing, after Heat)
            for s in CHARCOAL_SECTION:
                con.execute(s)
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
        for sku in p["returned"]:   # back in the catalogue: undo our own 'dropped', nothing else
            con.execute("UPDATE products SET availability = ? WHERE sku = ? AND availability = 'dropped'", (want[sku]["shop"]["availability"], sku))
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
                # the shop's first count goes in only if the item has no stock history at all
                st = w["shop_master"]["stock"]["v"]
                if st and h is not None and (w["shop_master"]["stock"]["src"] or "").startswith("shop:answers") and \
                        not con.execute("SELECT 1 FROM stock_moves WHERE sku = ?", (sku,)).fetchone():
                    con.execute("UPDATE products SET stock = ? WHERE sku = ?", (st, sku))
                    con.execute("INSERT INTO stock_moves (sku, delta, reason, ref, actor) VALUES (?,?, 'count', 'shop answers sheet', ?)", (sku, st, actor))
                    filled.append(sku + ":stock")
                # "in stock here" moves an item from catalogue-order to in-store; a counted item is left alone
                if w["shop_master"]["in_stock_here"]["v"] is True and h is not None and h.get("availability") == "special_order":
                    con.execute("UPDATE products SET availability = 'in_store_uncounted' WHERE sku = ? AND availability = 'special_order'", (sku,))
                    filled.append(sku + ":availability")
        n = len(p["added"]) + len(p["changed"]) + len(p["retired"]) + len(p["returned"]) + len(filled)
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


def seed_sql(supplier, m, category=None):
    C.validate_master(m, C.load_registry())   # same gate as apply: no hand-edited master goes out unchecked
    if m["supplier"]["id"] != supplier:
        raise C.ValidationError(f"this master belongs to {m['supplier']['id']}, not {supplier}")
    rows = desired_rows(supplier, m)
    if category:   # one part of a supplier's list (for example only the foil): nothing else is inserted, refreshed or dropped
        fam = {f["family_id"] for f in m["families"] if f.get("category") == category}
        rows = [r for r in rows if r["sup"]["family"] in fam]
        if not rows:
            raise C.ValidationError(f"no {supplier} items in category {category!r}")
    meta = SUPPLIER_META[supplier]
    msha = C.master_hash(m)
    src = (m.get("sources") or [{}])[0]
    out = [f"-- Generated by store/tools/catalog/catalog.py seed from store/catalog/suppliers/{supplier}/master.json",
           f"-- master sha256 {msha}. Safe to run twice: new items are inserted once, existing items get only their",
           "-- supplier columns refreshed. The shop's price, stock, name and on/off are never touched for an existing item.",
           f"INSERT OR IGNORE INTO suppliers (id, name, sku_block, note) VALUES ({q(supplier)}, {q(meta['name'])}, {q(meta['sku_block'])}, {q(meta['credit'])});"]
    if supplier == "shisha":
        out.append(SHISHA_SECTION + ";")
    if supplier == "charcoal-foil" and any(r["shop"]["category_id"] == "charcoal" for r in rows):
        out.extend(s + ";" for s in CHARCOAL_SECTION)
    for r in rows:
        cols = {**r["shop"], **r["sup"]}
        out.append(f"INSERT OR IGNORE INTO products (sku, {', '.join(cols)}) VALUES ({q(r['sku'])}, {', '.join(q(v) for v in cols.values())});")
        if cols["stock"]:
            out.append(f"INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT {q(r['sku'])}, {cols['stock']}, 'count', 'catalogue import {supplier}', 'catalog-import' WHERE changes() = 1;")
        sets = ", ".join(f"{k} = {q(v)}" for k, v in r["sup"].items())
        cond = " OR ".join(f"{k} IS NOT {q(v)}" for k, v in r["sup"].items())
        # never take over a row that belongs to another supplier, or a back-office row in another section
        # (charcoal made before 2026-11-24 still sits in Heat until the Charcoal section step moves it, so either section is its own)
        secs = ("heat", "charcoal") if r["shop"]["category_id"] == "charcoal" else (r["shop"]["category_id"],)
        own = f"(supplier_id = {q(supplier)} OR (supplier_id IS NULL AND category_id IN ({', '.join(q(s) for s in secs)})))"
        out.append(f"UPDATE products SET {sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = {q(r['sku'])} AND {own} AND ({cond});")
        out.append(f"UPDATE products SET availability = {q(r['shop']['availability'])} WHERE sku = {q(r['sku'])} AND supplier_id = {q(supplier)} AND availability = 'dropped';")
    live = [r["sku"] for r in rows]
    if category:
        return "\n".join(out) + "\n"
    out.append(f"UPDATE products SET availability = 'dropped' WHERE supplier_id = {q(supplier)} AND availability != 'dropped' AND sku NOT IN ({', '.join(q(s) for s in live)});")
    out.append(f"INSERT OR IGNORE INTO catalog_imports (supplier_id, source_sha256, master_sha256, edition, added, updated, retired, price_review, actor) "
               f"VALUES ({q(supplier)}, {q(src.get('sha256', ''))}, {q(msha)}, {q(src.get('edition', ''))}, 0, 0, 0, 0, 'catalog-seed');")
    return "\n".join(out) + "\n"


def seed(args):
    C.OUT.mkdir(parents=True, exist_ok=True)
    for s in ([args.supplier] if args.supplier else suppliers_present()):
        cat = getattr(args, "category", None)
        p = C.OUT / (f"seed-{s}-{cat}.sql" if cat else f"seed-{s}.sql")
        p.write_text(seed_sql(s, C.load_master(s), cat), encoding="utf-8", newline="\n")
        print("wrote", p)


# ------------------------------------------------------------------ descriptions

DESCRIPTIONS = C.INTAKE / "descriptions" / "descriptions.json"


def descriptions_sql(path=DESCRIPTIONS):
    """The writer's descriptions ([{sku, description}]) as SQL: each goes into details.description, a shop column the
    storefront shows on the product page and card. Plain text only, at most 600 characters; an unknown SKU changes nothing."""
    rows = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = rows.get("items", rows) if isinstance(rows, dict) else rows
    out = [f"-- Generated by store/tools/catalog/catalog.py descriptions from {Path(path).name}. Safe to run twice."]
    seen = set()
    for r in rows:
        sku, d = str(r.get("sku", "")), " ".join(str(r.get("description") or "").split())
        fam = sku.startswith("ace-")   # an Ace family: one description shared by every colour
        if not (fam or C.SKU_RE.match(sku) or C.LEGACY_RE.match(sku)) or not d or sku in seen:
            continue
        if len(d) > 600 or "<" in d:
            raise C.ValidationError(f"{sku}: a description must be plain text under 600 characters")
        seen.add(sku)
        where = f"family = {q(sku)} AND supplier_id = 'ace'" if fam else f"sku = {q(sku)}"
        out.append(f"UPDATE products SET details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{{}}' END, '$.description', {q(d)}), "
                   f"updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE {where};")
    return "\n".join(out) + "\n", len(seen)


def descriptions(args):
    sql, n = descriptions_sql(Path(args.file) if args.file else DESCRIPTIONS)
    C.OUT.mkdir(parents=True, exist_ok=True)
    (C.OUT / "descriptions.sql").write_text(sql, encoding="utf-8", newline="\n")
    print(f"wrote {C.OUT / 'descriptions.sql'}: {n} descriptions")


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
    b.add_argument("--acc-pdf", default=str(C.ACE_ACC_PDF))
    b.add_argument("--intake", default=str(C.INTAKE))
    b.add_argument("--only", choices=["shop-hoses"], help="build only this master (and the registry)")
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
    sd.add_argument("--category", help="only this category of the supplier's list, for example foil")
    sub.add_parser("labels")
    de = sub.add_parser("descriptions")
    de.add_argument("file", nargs="?")
    args = ap.parse_args(argv)
    return {"build": build, "xlsx": xlsx, "answers": answers, "plan": plan, "apply": apply, "seed": seed, "descriptions": descriptions, "labels": labels}[args.cmd](args)


if __name__ == "__main__":
    main()
