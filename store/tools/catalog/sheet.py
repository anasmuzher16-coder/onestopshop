"""The shop's spreadsheet, generated from the master files, and the reader for its Answers sheet.

Design (atelier brief, 2026-11-24):
  Subject: the shop's catalogue workbook. Audience: the owner and counter staff, on the shop PC, not technical.
  Job: get the shop's own prices and answers back with nothing to guess.  Idea: "the price sticker goes here".
  Device: THE STICKER (the store's own device): the ONLY coloured cells in the workbook are the ones the shop
  writes in, tinted the store's ember. Everything else is a quiet ledger: hairline rows, no fills, no zebra.
  Type: Calibri, because it is on every Windows PC (neutral by choice; the store faces cannot be relied on in Excel).
  Money is right-aligned with two decimals; Ace's price is grey and labelled as theirs, never the shelf price.
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

import catlib as C

INK = "201A17"        # coal ink on paper
MUTED = "8A817A"      # meta and the supplier's price
HAIR = "D9D2C9"       # one hairline weight
STICKER = "F9DED7"    # ember, tinted for a cell you write in
EMBER = "C2361F"      # the one accent, used for the column heads you write under
FONT = "Calibri"

ANSWER_COLS = ["SKU", "Section", "Product", "Colour (our guess)", "Ticked in the catalogue",
               "Your price ($, before tax)", "Stock count", "Colour name (correct it)", "In stock here? (yes/no)",
               "Turn on in the shop? (yes/no)", "Note"]
WRITE_COLS = {"Your price ($, before tax)", "Stock count", "Colour name (correct it)", "In stock here? (yes/no)",
              "Turn on in the shop? (yes/no)", "Note"}
GROUP_NAMES = {"full_size": "Full size", "stem_set": "Stem set (no base)", "compact_travel": "Compact and travel",
               "statement": "Statement piece"}
PHOTO_WORDS = {"ready": "Ready", "CHECK": "Ready, enlarged: check it", "hand_crop": "Needs a hand crop",
               "family_hero_only": "Uses the main photo only", "none": "No photo", "needs_store_photo": "Shop to photograph"}

# Suppliers whose items come from a printed catalogue (a page, Ace's printed name, the shop's tick)
CATALOGUES = ("ace", "ace-acc")
SHEET_NAMES = {"ace": "Ace", "ace-acc": "Ace accessories", "charcoal-foil": "Charcoal & foil", "shisha": "Shisha"}

GENERAL_QUESTIONS = [
    ("all", "Stem sets: sell them without a base, or bundle a base?"),
    ("ace", "Can Ace send its original photos, and confirm in writing that the shop may use its photos and names?"),
    ("ace", "Darkside, Tsar, Maklaud, Alpha and the other brand names in the Ace catalogue: are they genuine?"),
    ("ace", "What does 'SPECIAL' on 10 Ace pages mean?"),
    ("all", "Which bowls, hoses, tongs and burners does the shop stock (for starter sets)?"),
    ("all", "Can AA Cash Control export stock or sales?"),
    ("charcoal-foil", "Foil: what does each pack weigh (needed before it can be posted)?"),
    ("all", "The 5%: on the subtotal or the full total, and do pay-in-store orders count?"),
]


def _styles():
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    hair = Side(style="thin", color=HAIR)
    return {
        "title": Font(name=FONT, size=20, bold=True, color=INK),
        "lead": Font(name=FONT, size=11, color=INK),
        "meta": Font(name=FONT, size=9, color=MUTED),
        "head": Font(name=FONT, size=9, bold=True, color=INK),
        "head_write": Font(name=FONT, size=9, bold=True, color=EMBER),
        "body": Font(name=FONT, size=11, color=INK),
        "muted": Font(name=FONT, size=11, color=MUTED),
        "big": Font(name=FONT, size=28, bold=True, color=INK),
        "rule": Border(bottom=hair),
        "head_rule": Border(bottom=Side(style="medium", color=INK)),
        "sticker": PatternFill("solid", fgColor=STICKER),
        "wrap": Alignment(wrap_text=True, vertical="top"),
        "top": Alignment(vertical="top"),
        "right": Alignment(horizontal="right", vertical="top"),
    }


def _table(ws, row0, headers, rows, widths, S, write=frozenset(), money=frozenset(), muted=frozenset(), wrap=frozenset()):
    for j, h in enumerate(headers, 1):
        c = ws.cell(row=row0, column=j, value=h.upper())
        c.font = S["head_write"] if h in write else S["head"]
        c.border = S["head_rule"]
        c.alignment = S["wrap"]
    for i, r in enumerate(rows, row0 + 1):
        for j, h in enumerate(headers, 1):
            c = ws.cell(row=i, column=j, value=r.get(h))
            c.font = S["muted"] if h in muted else S["body"]
            c.border = S["rule"]
            c.alignment = S["wrap"] if h in wrap else S["top"]
            if h in money:
                c.number_format = '"$"#,##0.00'
                c.alignment = S["right"]
            if h in write:
                c.fill = S["sticker"]
    for j, w in enumerate(widths, 1):
        ws.column_dimensions[ws.cell(row=row0, column=j).column_letter].width = w
    ws.freeze_panes = ws.cell(row=row0 + 1, column=1)
    return row0 + len(rows)


def _yn(v):
    return {True: "yes", False: "no"}.get(v, None)


def write_workbook(path: Path, masters: dict):
    from openpyxl import Workbook
    from openpyxl.worksheet.datavalidation import DataValidation
    S = _styles()
    wb = Workbook()
    path.parent.mkdir(parents=True, exist_ok=True)
    made = datetime.now().strftime("%Y-%m-%d")
    live = {s: m for s, m in masters.items() if m.get("families")}

    # Summary
    ws = wb.active
    ws.title = "Summary"
    ws.sheet_view.showGridLines = False
    ws["A1"] = "One Stop Shop catalogue"
    ws["A1"].font = S["title"]
    ws["A2"] = f"Made {made} from the master files. Write only in the tinted cells, on the Answers sheet, then send the file back."
    ws["A2"].font = S["lead"]
    r = 4
    for s, m in live.items():
        vs = [v for _, v in C.iter_variants(m)]
        priced = sum(1 for v in vs if v["shop"]["price_cents"]["v"])
        photos = sum(1 for v in vs if v["photo"]["status"] in ("ready", "CHECK"))
        ws.cell(row=r, column=1, value=m["supplier"]["name"]).font = S["head"]
        ws.cell(row=r, column=1).border = S["head_rule"]
        r += 1
        stats = [(len(m["families"]), "products"), (len(vs), "items to sell (one per colour or size)"),
                 (priced, "have the shop's own price"), (len(vs) - priced, "are waiting for the shop's price"),
                 (photos, "have a site-ready photo")]
        if s in CATALOGUES:
            stats.insert(1, (sum(f["stamp"]["v"] != "none" for f in m["families"]), "ticked by the shop in the catalogue"))
        for n, label in stats:
            ws.cell(row=r, column=1, value=n).font = S["big"]
            ws.cell(row=r, column=1).alignment = S["right"]
            ws.cell(row=r, column=2, value=label).font = S["lead"]
            r += 1
        r += 1
    for s, m in masters.items():
        if m.get("status") == "STUB":
            ws.cell(row=r, column=1, value=m["supplier"]["name"] + ": not in this file yet (its list is still being checked).").font = S["meta"]
            r += 1
    r += 1
    for line in ["How it works",
                 "1. Answers sheet: put your own price, the count, and fix any colour name we guessed wrong.",
                 "2. Questions sheet: answer what you can, in a few words.",
                 "3. Send the file back. Nothing goes on the site until your price is in and you say turn it on.",
                 "Ace's prices in this file are Ace's catalogue prices, for reference. They are never put on the site."]:
        ws.cell(row=r, column=1, value=line).font = S["head"] if line == "How it works" else S["lead"]
        r += 1
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 60

    # Per-supplier catalogue sheets (read-only reference)
    for s, m in live.items():
        ws = wb.create_sheet(f"Catalogue {SHEET_NAMES.get(s, 'Shisha')}"[:31])
        ws.sheet_view.showGridLines = False
        rows = []
        for f, v in C.iter_variants(m):
            if s == "ace":
                rows.append({"SKU": v["sku"], "Page": f["page"], "Ace name": f["supplier_ref"]["v"],
                             "Colour (from the photo)": v["colour"]["v"] or "", "Chip": v["swatch_hex"]["v"] or "",
                             "Ticked": {"stamped": "yes", "unclear": "unclear", "none": ""}[f["stamp"]["v"]],
                             "Group": GROUP_NAMES[f["group"]["v"]],
                             "Ace price (theirs)": (f["supplier_price_cents"]["v"] or 0) / 100 if f["supplier_price_cents"]["v"] is not None else None,
                             "Your price": (v["shop"]["price_cents"]["v"] / 100) if v["shop"]["price_cents"]["v"] else None,
                             "Photo": PHOTO_WORDS.get(v["photo"]["status"], v["photo"]["status"]),
                             "Notes": "; ".join(f["flags"])})
            elif s == "ace-acc":
                rows.append({"SKU": v["sku"], "Page": f["page"], "Ace name": f["supplier_ref"]["v"], "Section": f["category"].capitalize(),
                             "Ticked": {"stamped": "yes", "unclear": "unclear", "none": ""}[f["stamp"]["v"]],
                             "Ace price (theirs)": (f["supplier_price_cents"]["v"] or 0) / 100 if f["supplier_price_cents"]["v"] is not None else None,
                             "Your price": (v["shop"]["price_cents"]["v"] / 100) if v["shop"]["price_cents"]["v"] else None,
                             "Photo": PHOTO_WORDS.get(v["photo"]["status"], v["photo"]["status"]),
                             "Notes": "; ".join(f["flags"])})
            else:
                rows.append({"SKU": v["sku"], "Kind": f["category"].capitalize(), "Name": v["shop"]["display_name"]["v"],
                             "Your price": (v["shop"]["price_cents"]["v"] / 100) if v["shop"]["price_cents"]["v"] else None,
                             "Stock": v["shop"]["stock"]["v"],
                             "How it goes": {"charcoal": "Pickup or local delivery, never shipped", "foil": "Can ship (weight unknown)"}.get(f["category"], "Off until the lab certificate is on file"),
                             "Photo": PHOTO_WORDS.get(v["photo"]["status"], v["photo"]["status"]),
                             "Notes": "; ".join(f["flags"])})
        if s == "ace":
            hd = ["SKU", "Page", "Ace name", "Colour (from the photo)", "Chip", "Ticked", "Group", "Ace price (theirs)", "Your price", "Photo", "Notes"]
            wd = [12, 6, 26, 16, 9, 8, 18, 11, 11, 22, 70]
            last = _table(ws, 1, hd, rows, wd, S, money={"Ace price (theirs)", "Your price"}, muted={"Ace price (theirs)", "Chip", "Page"}, wrap={"Notes"})
            from openpyxl.styles import PatternFill
            for i in range(2, last + 1):
                hx = ws.cell(row=i, column=5).value
                if hx and re.fullmatch(r"#[0-9a-f]{6}", hx):
                    ws.cell(row=i, column=5).fill = PatternFill("solid", fgColor=hx[1:].upper())
                    ws.cell(row=i, column=5).value = ""
        elif s == "ace-acc":
            hd = ["SKU", "Page", "Ace name", "Section", "Ticked", "Ace price (theirs)", "Your price", "Photo", "Notes"]
            _table(ws, 1, hd, rows, [12, 6, 30, 10, 8, 11, 11, 22, 70], S, money={"Ace price (theirs)", "Your price"}, muted={"Ace price (theirs)", "Page"}, wrap={"Notes"})
        else:
            hd = ["SKU", "Kind", "Name", "Your price", "Stock", "How it goes", "Photo", "Notes"]
            wd = [12, 10, 52, 11, 7, 30, 20, 70]
            _table(ws, 1, hd, rows, wd, S, money={"Your price"}, wrap={"Notes", "Name"})

    # Questions for the shop
    ws = wb.create_sheet("Questions for the shop")
    ws.sheet_view.showGridLines = False
    q = []
    n = 0
    for who, text in GENERAL_QUESTIONS:
        if who == "all" or who in live:
            n += 1
            q.append({"#": n, "About": "Everything" if who == "all" else live[who]["supplier"]["name"], "Question": text, "Your answer": None})
    for s, m in live.items():
        for f in m["families"]:
            for fl in f["flags"]:
                if fl.startswith("NEEDS SHOP: "):
                    n += 1
                    where = (f"page {f['page']}, {f['supplier_ref']['v']}" + (" (accessories)" if s == "ace-acc" else "")) if s in CATALOGUES else f["variants"][0]["shop"]["display_name"]["v"]
                    q.append({"#": n, "About": where, "Question": fl.removeprefix("NEEDS SHOP: "), "Your answer": None})
    _table(ws, 1, ["#", "About", "Question", "Your answer"], q, [5, 34, 80, 50], S, write={"Your answer"}, wrap={"Question", "About", "Your answer"})

    # Photo checklist
    ws = wb.create_sheet("Photo checklist")
    ws.sheet_view.showGridLines = False
    pr = []
    for s, m in live.items():
        for f, v in C.iter_variants(m):
            st = v["photo"]["status"]
            if st == "ready":
                continue
            need = {"CHECK": "Look at it on the contact sheet; ask Ace for the original if it looks soft",
                    "hand_crop": "Products overlap in Ace's photo: we cut it by hand",
                    "family_hero_only": "No photo of this colour: shop photo, or Ace's original",
                    "none": "No photo at all: shop photo", "needs_store_photo": "Shop photo: white sheet, whole item, side-on, no flash, portrait"}.get(st, st)
            pr.append({"SKU": v["sku"], "Product": f["supplier_ref"]["v"], "Colour": (v.get("colour") or {}).get("v") or (v.get("label") or {}).get("v") or "",
                       "Photo now": PHOTO_WORDS.get(st, st), "What is needed": need, "Done": None})
    _table(ws, 1, ["SKU", "Product", "Colour", "Photo now", "What is needed", "Done"], pr, [12, 40, 16, 24, 60, 8], S, write={"Done"}, wrap={"What is needed", "Product"})

    # Answers (the only sheet read back)
    ws = wb.create_sheet("Answers")
    ws.sheet_view.showGridLines = False
    ar = []
    for s, m in live.items():
        for f, v in C.iter_variants(m):
            sh = v["shop"]
            ar.append({"SKU": v["sku"], "Section": "Hookahs (Ace)" if s == "ace" else f["category"].capitalize() + (" (Ace)" if s == "ace-acc" else ""),
                       "Product": f["supplier_ref"]["v"] if s in CATALOGUES else sh["display_name"]["v"],
                       "Colour (our guess)": (v.get("colour") or {}).get("v") or (v.get("label") or {}).get("v") or "",
                       "Ticked in the catalogue": ({"stamped": "yes", "unclear": "unclear", "none": ""}[f["stamp"]["v"]] if s in CATALOGUES else ""),
                       "Your price ($, before tax)": sh["price_cents"]["v"] / 100 if sh["price_cents"]["v"] else None,
                       "Stock count": sh["stock"]["v"], "Colour name (correct it)": sh["colour_confirmed"]["v"],
                       "In stock here? (yes/no)": _yn(sh["in_stock_here"]["v"]), "Turn on in the shop? (yes/no)": _yn(sh["active"]["v"]) if sh["active"]["v"] else None,
                       "Note": sh["note"]["v"] if s in CATALOGUES else None})
    last = _table(ws, 1, ANSWER_COLS, ar, [12, 14, 30, 16, 10, 14, 9, 18, 12, 12, 30], S, write=WRITE_COLS,
                  money={"Your price ($, before tax)"}, muted={"SKU", "Ticked in the catalogue"}, wrap={"Product"})
    dv = DataValidation(type="list", formula1='"yes,no"', allow_blank=True, showErrorMessage=True, errorTitle="yes or no", error="Type yes or no.")
    ws.add_data_validation(dv)
    dv.add(f"I2:J{last}")
    num = DataValidation(type="decimal", operator="between", formula1="0.01", formula2="10000", allow_blank=True, showErrorMessage=True,
                         errorTitle="Price", error="A price in dollars, like 64.99")
    ws.add_data_validation(num)
    num.add(f"F2:F{last}")
    cnt = DataValidation(type="whole", operator="between", formula1="0", formula2="99999", allow_blank=True, showErrorMessage=True,
                         errorTitle="Count", error="A whole number, 0 or more")
    ws.add_data_validation(cnt)
    cnt.add(f"G2:G{last}")
    # version stamp, so a reply made from an old file is noticed
    ws2 = wb.create_sheet("_about")
    ws2["A1"] = "generated"
    ws2["B1"] = made
    for i, (s, m) in enumerate(live.items(), 2):
        ws2.cell(row=i, column=1, value=f"master:{s}")
        ws2.cell(row=i, column=2, value=C.master_hash(m))
    ws2.sheet_state = "hidden"
    wb.active = wb.sheetnames.index("Summary")
    wb.save(path)
    return path


# ------------------------------------------------------------------ reading the Answers sheet back

class AnswersError(ValueError):
    pass


def _parse_yes(v, where, errs):
    if v is None or str(v).strip() == "":
        return None
    t = str(v).strip().lower()
    if t in ("yes", "y", "true", "1"):
        return True
    if t in ("no", "n", "false", "0"):
        return False
    errs.append(f"{where}: '{v}' is not yes or no")
    return None


def parse_answers(path: Path):
    """Read the Answers sheet. Returns {sku: {field: value}}. Raises AnswersError listing every bad cell;
    nothing is written when any cell is bad."""
    from openpyxl import load_workbook
    wb = load_workbook(path, data_only=True)
    if "Answers" not in wb.sheetnames:
        raise AnswersError("no sheet called Answers in this file")
    ws = wb["Answers"]
    heads = [str(c.value or "").strip() for c in ws[1]]
    want = [h.upper() for h in ANSWER_COLS]
    col = {}
    for h in ANSWER_COLS:
        if h.upper() not in heads:
            raise AnswersError(f"the Answers sheet is missing the column '{h}'")
        col[h] = heads.index(h.upper())
    del want
    reg = C.load_registry()
    out, errs, seen = {}, [], set()
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
        sku = str(row[col["SKU"]] or "").strip()
        if not sku:
            if any(row[col[h]] not in (None, "") for h in WRITE_COLS):
                errs.append(f"row {i}: answers with no SKU (put the SKU back, or clear the row)")
            continue
        where = f"row {i} ({sku})"
        e = reg["skus"].get(sku)
        if not e:
            errs.append(f"{where}: unknown SKU")
            continue
        if e["status"] != "active":
            errs.append(f"{where}: this SKU is retired and cannot take answers")
            continue
        if sku in seen:
            errs.append(f"{where}: this SKU appears twice")
            continue
        seen.add(sku)
        a = {}
        pv = row[col["Your price ($, before tax)"]]
        if isinstance(pv, bool):
            errs.append(f"{where}: price '{pv}' is not a number")
            pv = None
        if pv not in (None, ""):
            try:
                t = float(str(pv).replace("$", "").replace(",", "").strip())
            except ValueError:
                errs.append(f"{where}: price '{pv}' is not a number")
                t = None
            if t is not None:
                if not (0 < t <= 10000):
                    errs.append(f"{where}: price {t} must be more than 0 and at most 10000")
                elif abs(t * 100 - round(t * 100)) > 1e-6:
                    errs.append(f"{where}: price {t} has more than two decimals")
                else:
                    a["price_cents"] = int(round(t * 100))
        sv = row[col["Stock count"]]
        if sv not in (None, ""):
            try:
                if isinstance(sv, bool):
                    raise ValueError
                n = float(sv)
                if n != int(n) or n < 0 or n > 99999:
                    raise ValueError
                a["stock"] = int(n)
            except (ValueError, TypeError):
                errs.append(f"{where}: stock '{sv}' must be a whole number, 0 or more")
        cv = row[col["Colour name (correct it)"]]
        if cv not in (None, ""):
            t = str(cv).strip()
            if len(t) > 40 or not re.fullmatch(r"[A-Za-z0-9 &/'.-]+", t):
                errs.append(f"{where}: colour name '{t}' must be plain words, 40 letters at most")
            else:
                a["colour_confirmed"] = t
        y = _parse_yes(row[col["In stock here? (yes/no)"]], where, errs)
        if y is not None:
            a["in_stock_here"] = y
        on = _parse_yes(row[col["Turn on in the shop? (yes/no)"]], where, errs)
        if on is not None:
            a["active"] = on
        nv = row[col["Note"]]
        if nv not in (None, ""):
            a["note"] = str(nv).strip()[:500]
        if a.get("active") and "price_cents" not in a:
            a["_needs_price"] = True
        out[sku] = a
    if errs:
        raise AnswersError("\n".join(errs))
    about = {}
    if "_about" in wb.sheetnames:
        for r in wb["_about"].iter_rows(values_only=True):
            if r and r[0] and str(r[0]).startswith("master:"):
                about[str(r[0])[7:]] = r[1]
    return out, about


def read_answers(path: Path, masters: dict | None = None, write=True):
    """Answers -> the shop-owned fields of the master files. All or nothing."""
    import shutil
    ans, about = parse_answers(path)
    tag = f"shop:answers {path.name} sha256:{C.sha256_file(path)[:12]} {datetime.now().strftime('%Y-%m-%d')}"
    masters = masters if masters is not None else {s: C.load_master(s) for s in C.BLOCKS if C.load_master(s)}
    changed, errs, pending = {}, [], []
    by_sku = {}
    for s, m in masters.items():
        for f, v in C.iter_variants(m):
            by_sku[v["sku"]] = (s, v)
    # a file made from an older master may not overwrite answers given since (the hidden _about sheet records it)
    stale = {s for s, m in masters.items() if about.get(s) and about[s] != C.master_hash(m)} if about else set(masters)
    for sku, a in ans.items():
        if sku not in by_sku:
            errs.append(f"{sku}: not in any master file")
            continue
        s, v = by_sku[sku]
        if s in stale:
            for k, val in a.items():
                cur = v["shop"].get(k) if not k.startswith("_") else None
                if cur and (cur.get("src") or "").startswith("shop:answers") and cur["v"] != val:
                    errs.append(f"{sku}.{k}: this file is older than the answer already recorded ({cur['src']}); make a fresh sheet")
        price_after = a.get("price_cents", v["shop"]["price_cents"]["v"])
        if a.get("active") and not price_after:
            errs.append(f"{sku}: 'turn on' needs the shop's price first")
            continue
        for k, val in a.items():
            if k.startswith("_"):
                continue
            if v["shop"][k]["v"] != val:
                pending.append((s, sku, v, k, val))
    if errs:   # all or nothing: nothing has been changed yet
        raise AnswersError("\n".join(errs))
    for s, sku, v, k, val in pending:
        v["shop"][k] = C.cell(val, tag)
        changed.setdefault(s, []).append(f"{sku}.{k}")
    reg = C.load_registry()
    for s in changed:
        masters[s].setdefault("shop_answers", []).append({"file": path.name, "sha256": C.sha256_file(path), "read": C.now_iso(),
                                                         "fields_changed": len(changed[s])})
        C.validate_master(masters[s], reg)
    if write:
        for s in changed:
            C.write_json(C.master_path(s), masters[s])
        keep = C.CATALOG / "answers" / f"{datetime.now().strftime('%Y-%m-%d')}-{path.name}"
        keep.parent.mkdir(parents=True, exist_ok=True)
        if path.resolve() != keep.resolve():
            shutil.copyfile(path, keep)
    return {s: len(v) for s, v in changed.items()}
