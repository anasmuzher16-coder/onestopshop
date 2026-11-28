"""One Stop Shop catalogue pipeline: the shared library.

One master file per supplier (store/catalog/suppliers/<id>/master.json) is the single source of truth.
The shop's spreadsheet and the site database are both generated from it. Read store/catalog/SCHEMA.md first.

Every field is a "cell": {"v": value, "src": where it came from}. Fields are owned either by the supplier
(rebuilt from the catalogue on every build) or by the shop (never overwritten by a build or an import).
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
STORE = HERE.parent.parent                      # store/
CATALOG = STORE / "catalog"
SUPPLIERS = CATALOG / "suppliers"
REGISTRY = CATALOG / "registry.json"
OUT = CATALOG / "out"                            # generated files (spreadsheet, seed SQL); git-ignored
SCHEMA_ID = "oss-catalog/1"

ACE_PDF = Path(r"C:\Users\anasm\.claude\uploads\2e9104f4-ae4d-4888-ac56-0336af4e029a\8dbd1ba4-ACE_HOOKAH_October_2026.pdf")
ACE_ACC_PDF = Path(r"C:\Users\anasm\.claude\uploads\2e9104f4-ae4d-4888-ac56-0336af4e029a\b9cd9c7f-ACE_ACCESSORIES_compressed.pdf")
INTAKE = Path(r"C:\dev\onestopshop\inventory-2026-11-23")

# SKU blocks: OSS-SSNNNN. SS is the supplier block, NNNN a number that is never changed or reused.
BLOCKS = {"ace": "10", "ace-acc": "11", "shop-hoses": "12", "shop-bowls": "13", "shop-hookahs": "14", "charcoal-foil": "20", "shisha": "30"}   # 11: Ace accessories (2026-11-26); 12: the shop's own hoses, 13: its own bowls (2026-11-27)
SKU_RE = re.compile(r"^OSS-(\d{2})(\d{4})$")
LEGACY_RE = re.compile(r"^OSS-\d{4}$")          # the shop's earlier 4-digit numbers (charcoal intake), kept as they are

# Who owns each field. The build writes supplier fields; only the shop (answers sheet, back office) writes shop fields.
SUPPLIER_FIELDS = ("supplier_ref", "supplier_price_cents", "page", "stamp", "facts", "swatch_hex", "photo", "colour")
SHOP_FIELDS = ("price_cents", "display_name", "stock", "active", "colour_confirmed", "in_stock_here", "note")

# Database columns by owner. apply/seed UPDATE supplier columns every run; shop columns are written only when the
# row is first created (and never afterwards).
DB_SUPPLIER_COLS = ("supplier_id", "supplier_ref", "supplier_price_cents", "family", "variant_label", "swatch_hex",
                    "img", "height_cm", "facts_known")
DB_SHOP_COLS = ("name", "category_id", "price_cents", "weight_g", "box_id", "glass", "ship_class", "note",
                "stock", "low_stock_at", "active", "sort", "availability")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def cell(v, src):
    return {"v": v, "src": src}


def slug(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def dumps(obj) -> str:
    return json.dumps(obj, indent=1, ensure_ascii=False, sort_keys=False) + "\n"


def load_json(p: Path, default=None):
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(p: Path, obj) -> bool:
    """Write only when the content changes (keeps builds idempotent and git quiet). Returns True if written."""
    p.parent.mkdir(parents=True, exist_ok=True)
    text = dumps(obj)
    if p.exists() and p.read_text(encoding="utf-8") == text:
        return False
    p.write_text(text, encoding="utf-8", newline="\n")
    back = p.read_text(encoding="utf-8")
    if back != text:   # OneDrive-style truncation guard: read it back
        raise IOError(f"write did not stick: {p}")
    return True


def master_path(supplier: str) -> Path:
    return SUPPLIERS / supplier / "master.json"


def load_master(supplier: str):
    return load_json(master_path(supplier))


def master_hash(master) -> str:
    return sha256_text(dumps(master))


# ---------------------------------------------------------------- SKU registry

class RegistryError(ValueError):
    pass


def load_registry(path: Path = REGISTRY):
    reg = load_json(path)
    if reg is None:
        reg = {"schema": "oss-sku-registry/1",
               "rule": "OSS-SSNNNN: SS = supplier block, NNNN = sequence. A number is never changed, never reused, "
                       "and stays here after it is retired. Legacy 4-digit numbers are kept as they are.",
               "blocks": {v: k for k, v in BLOCKS.items()}, "next": {v: 1 for v in BLOCKS.values()}, "skus": {}}
    for sup, blk in BLOCKS.items():   # a supplier added later gets its block once; existing blocks and counters never change
        if blk not in reg["blocks"]:
            reg["blocks"][blk] = sup
            reg["next"][blk] = 1
    validate_registry(reg)
    return reg


def validate_registry(reg):
    seen_keys = {}
    for sku, e in reg["skus"].items():
        m = SKU_RE.match(sku)
        if not m and not LEGACY_RE.match(sku):
            raise RegistryError(f"bad SKU format in registry: {sku}")
        if m:
            blk, n = m.group(1), int(m.group(2))
            if reg["blocks"].get(blk) != e["supplier"]:
                raise RegistryError(f"{sku} is in block {blk} but registered to {e['supplier']}")
            if n >= reg["next"][blk]:
                raise RegistryError(f"{sku} is at or past the block counter {reg['next'][blk]}: a number could be reused")
        k = (e["supplier"], e["key"])
        if k in seen_keys:
            raise RegistryError(f"key {k} has two SKUs: {seen_keys[k]} and {sku}")
        seen_keys[k] = sku
        if e["status"] not in ("active", "retired"):
            raise RegistryError(f"{sku} has unknown status {e['status']}")


def sku_for(reg, supplier: str, key: str, today: str, legacy: str | None = None) -> str:
    """The SKU for (supplier, key). Existing keys keep their number, even when retired and coming back.
    New keys get the next number in the block; numbers only go up."""
    for sku, e in reg["skus"].items():
        if e["supplier"] == supplier and e["key"] == key:
            if e["status"] == "retired":
                e["status"] = "active"
                e.setdefault("history", []).append({"at": today, "event": "back in the catalogue"})
            return sku
    if legacy:
        if not LEGACY_RE.match(legacy):
            raise RegistryError(f"legacy SKU {legacy} is not a 4-digit OSS number")
        if legacy in reg["skus"]:
            raise RegistryError(f"legacy SKU {legacy} is already registered to {reg['skus'][legacy]['key']}")
        reg["skus"][legacy] = {"supplier": supplier, "key": key, "status": "active", "assigned": today, "legacy": True}
        return legacy
    blk = BLOCKS[supplier]
    n = reg["next"][blk]
    if n > 9999:
        raise RegistryError(f"block {blk} is full")
    sku = f"OSS-{blk}{n:04d}"
    if sku in reg["skus"]:
        raise RegistryError(f"{sku} already exists: refusing to reuse")
    reg["next"][blk] = n + 1
    reg["skus"][sku] = {"supplier": supplier, "key": key, "status": "active", "assigned": today}
    return sku


def retire_missing(reg, supplier: str, live_keys: set, today: str, reason: str) -> list:
    out = []
    for sku, e in reg["skus"].items():
        if e["supplier"] == supplier and e["status"] == "active" and e["key"] not in live_keys:
            e["status"] = "retired"
            e.setdefault("history", []).append({"at": today, "event": "retired", "why": reason})
            out.append(sku)
    return out


# ---------------------------------------------------------------- validation

class ValidationError(ValueError):
    pass


def _check_cell(path, c, problems):
    if not isinstance(c, dict) or "v" not in c or "src" not in c:
        problems.append(f"{path}: not a provenance cell {{v, src}}")
    elif c["v"] is not None and not c["src"]:
        problems.append(f"{path}: has a value but no source")


def validate_master(m, reg=None):
    """Raise ValidationError listing every problem. Rules are in SCHEMA.md."""
    p = []
    if m.get("schema") != SCHEMA_ID:
        p.append(f"schema must be {SCHEMA_ID}")
    sup = m.get("supplier", {}).get("id")
    if sup not in BLOCKS:
        p.append(f"unknown supplier {sup}")
    skus = set()
    for fi, fam in enumerate(m.get("families", [])):
        fp = f"families[{fi}]({fam.get('family_id')})"
        for k in ("supplier_ref", "supplier_price_cents", "group"):
            if k in fam:
                _check_cell(f"{fp}.{k}", fam[k], p)
        sp = fam.get("supplier_price_cents", {}).get("v")
        if sp is not None and (not isinstance(sp, int) or sp < 0):
            p.append(f"{fp}.supplier_price_cents must be whole cents >= 0, got {sp!r}")
        for k, c in fam.get("facts", {}).items():
            _check_cell(f"{fp}.facts.{k}", c, p)
        if not fam.get("variants"):
            p.append(f"{fp}: no variants")
        for vi, v in enumerate(fam.get("variants", [])):
            vp = f"{fp}.variants[{vi}]({v.get('sku')})"
            sku = v.get("sku", "")
            if not (SKU_RE.match(sku) or LEGACY_RE.match(sku)):
                p.append(f"{vp}: bad SKU {sku!r}")
            if sku in skus:
                p.append(f"{vp}: duplicate SKU {sku}")
            skus.add(sku)
            if reg is not None:
                e = reg["skus"].get(sku)
                if not e:
                    p.append(f"{vp}: SKU not in the registry")
                elif e["status"] != "active":
                    p.append(f"{vp}: SKU {sku} is retired and cannot be used")
                elif e["supplier"] != sup:
                    p.append(f"{vp}: SKU belongs to {e['supplier']}")
            shop = v.get("shop", {})
            for k in SHOP_FIELDS:
                if k not in shop:
                    p.append(f"{vp}.shop.{k} missing")
                else:
                    _check_cell(f"{vp}.shop.{k}", shop[k], p)
            pc = shop.get("price_cents", {}).get("v")
            if pc is not None and (not isinstance(pc, int) or pc <= 0):
                p.append(f"{vp}.shop.price_cents must be whole cents > 0, got {pc!r}")
            st = shop.get("stock", {}).get("v")
            if st is not None and (not isinstance(st, int) or st < 0):
                p.append(f"{vp}.shop.stock must be a whole number >= 0, got {st!r}")
            if shop.get("active", {}).get("v") and pc is None:
                p.append(f"{vp}: cannot be active without the shop's own price")
            # The supplier's price is never the shelf price unless the shop said so itself.
            psrc = shop.get("price_cents", {}).get("src") or ""
            if pc is not None and not psrc.startswith("shop:"):
                p.append(f"{vp}.shop.price_cents source must be the shop (shop:...), got {psrc!r}")
            for k in ("swatch_hex", "colour"):
                if k in v:
                    _check_cell(f"{vp}.{k}", v[k], p)
    for sku in m.get("retired", {}):
        if sku in skus:
            p.append(f"retired SKU {sku} is also live")
    if p:
        raise ValidationError("\n".join(p))
    return True


def blank_shop(stock=None, stock_src=None, price=None, price_src=None):
    return {
        "price_cents": cell(price, price_src),
        "display_name": cell(None, None),
        "stock": cell(stock, stock_src),
        "active": cell(False, "rule: off until the shop's own price is set"),
        "colour_confirmed": cell(None, None),
        "in_stock_here": cell(None, None),
        "note": cell(None, None),
    }


def carry_shop(old_master, new_master):
    """Copy every shop-owned field from the previous master into the new one, by SKU. A rebuild never loses them."""
    new_master["shop_answers"] = []
    new_master["retired_shop"] = {}
    if not old_master:
        return
    # shop cells of items that left the catalogue are parked, so they come back with the item
    old = dict(old_master.get("retired_shop", {}))
    old.update({v["sku"]: v.get("shop", {}) for f in old_master.get("families", []) for v in f["variants"]})
    live = set()
    for f in new_master.get("families", []):
        for v in f["variants"]:
            live.add(v["sku"])
            prev = old.get(v["sku"])
            if not prev:
                continue
            for k in SHOP_FIELDS:
                ps = (prev.get(k) or {}).get("src") or ""
                ns = (v["shop"][k].get("src") or "")
                # the shop's answers always survive; a newer copy of the shop's own list replaces an older one
                if ps.startswith("shop:") and (ps.startswith("shop:answers") or not ns.startswith("shop:")):
                    v["shop"][k] = prev[k]
    for sku, shop in old.items():
        if sku not in live and any((c.get("src") or "").startswith("shop:") for c in shop.values()):
            new_master["retired_shop"][sku] = shop
    new_master["shop_answers"] = old_master.get("shop_answers", [])


def carry_web_facts(old_master, new_master):
    """Facts read off a maker's or retailer's page (source 'web:<url> <date>', added by hand to the master) are not in the
    supplier's catalogue, so a rebuild would drop them. Copy each one across by family, unless the rebuild found a value."""
    if not old_master:
        return
    old = {f["family_id"]: f.get("facts", {}) for f in old_master.get("families", [])}
    for f in new_master.get("families", []):
        for k, c in old.get(f["family_id"], {}).items():
            if (c.get("src") or "").startswith("web:") and (f.setdefault("facts", {}).get(k) or {}).get("v") is None:
                f["facts"][k] = c


def iter_variants(m):
    for f in m.get("families", []):
        for v in f["variants"]:
            yield f, v
