"""Prove the live SQL on sqlite copies of the 2026-11-27 backup: plain, after the shop-hookahs tag, twice, rollback; columns untouched."""
import sqlite3, sys, json, shutil
from pathlib import Path
sqlf, skus = Path(sys.argv[1]), sys.argv[2:]
import os, tempfile
base = Path(os.environ.get("HOSE_DB") or Path(__file__).parent.parent / "db" / "base.db")   # a sqlite copy of the live backup (HOSE_DB)
sql = sqlf.read_text()
cols = None
def snap(c):
    return {r[0]: r for r in c.execute("SELECT * FROM products ORDER BY sku")}
def run(tag):
    db = Path(tempfile.gettempdir()) / f"hose-drawnbag-t-{tag}.db"; shutil.copy(base, db); c = sqlite3.connect(db)
    if tag == "tagged":   # what shop-hookahs-2026-11-27.sql does to the hoses
        c.execute("UPDATE products SET facts_known = json_set(facts_known, '$.photo_label', 'replace') WHERE supplier_id = 'shop-hoses'")
        c.execute("UPDATE products SET details = json_set(details, '$.photo', 'replace') WHERE sku = 'OSS-120002'")
    c.commit(); before = snap(c)
    n1 = c.executescript(sql) and c.total_changes; c.commit(); after1 = snap(c)
    t1 = c.total_changes; c.executescript(sql); c.commit(); t2 = c.total_changes
    names = [d[1] for d in c.execute("pragma table_info(products)")]
    bad = []
    for sku, row in before.items():
        a = after1[sku]
        for i, nm in enumerate(names):
            if row[i] != a[i]:
                if sku not in skus: bad.append((sku, nm, "not in list"))
                elif nm not in ("details", "facts_known", "updated_at"): bad.append((sku, nm))
                elif nm in ("details", "facts_known"):
                    b0, b1 = json.loads(row[i] or "{}"), json.loads(a[i] or "{}")
                    k = "photo" if nm == "details" else "photo_label"
                    b0.pop(k, None); b1.pop(k, None)
                    if b0 != b1: bad.append((sku, nm, "other keys moved"))
    st = [(s, json.loads(after1[s][names.index("details")]).get("photo"), json.loads(after1[s][names.index("facts_known")]).get("photo_label")) for s in skus]
    ok = all(p == "approved" and l is None for _, p, l in st)
    print(f"{tag}: rows changed on run 1 = {t1}, on run 2 = {t2 - t1}, all approved+untagged = {ok}, unexpected changes = {bad[:5]}")
    # rollback (first statement of the header) returns details to before
    rb = [l[4:] for l in sql.splitlines() if l.startswith("--   UPDATE") or l.startswith("--     WHERE")]
    c.executescript(rb[0] + " " + rb[1]); c.commit()
    back = snap(c); di = names.index("details")
    print(f"{tag}: rollback restores details = {all(json.loads(back[s][di]) == json.loads(before[s][di]) if tag=='plain' else json.loads(back[s][di]).get('photo') is None for s in skus)}")
    c.close(); db.unlink()
run("plain"); run("tagged")
