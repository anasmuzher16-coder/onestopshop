// Runs store suites the way the laptop runner does (scratchpad suites.ps1), on any OS: a fresh copy of a seeded local
// database per suite, the store restarted per suite, the fake map service up, no card keys (the live demo's mode).
// Used by .github/workflows/store-tests.yml (one shard of suites per machine) and locally:
//   node store/tools/ci-suites.mjs smoke-http e2e-nav ...      (from the repo root; needs wrangler and playwright installed)
// Env: PW_FROM (a package.json whose node_modules has playwright), PORT (default 4493).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { SEED_FILES, seedPath } from "./seed-files.mjs";

const STORE = fileURLToPath(new URL("../", import.meta.url)), WORK = join(STORE, ".ci"), PORT = +(process.env.PORT || 4493);
const GOLD = join(WORK, "gold"), STATE = join(WORK, "state"), OUT = join(WORK, "out"), WIN = process.platform === "win32";
// suites that take the store's base URL with a trailing slash, and those that take an output folder argument (as suites.ps1)
const SLASH = new Set(["e2e", "phone-audit", "whitebox", "fx-robust"]), NOARG = new Set(["smoke-http", "phone-audit", "test-ace", "test-account", "test-payments", "whitebox", "fx-robust"]);
const list = process.argv.slice(2); if (!list.length) { console.error("name the suites to run"); process.exit(2); }
const npx = (args, opt = {}) => spawnSync(WIN ? "npx.cmd" : "npx", args, { cwd: STORE, encoding: "utf8", shell: WIN, ...opt });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = p => { if (!p || p.exitCode !== null) return; if (WIN) spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"]); else { try { process.kill(-p.pid, "SIGKILL"); } catch { p.kill("SIGKILL"); } } };

// the seeded database, built once: migrations, then the seed files in order
rmSync(WORK, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
writeFileSync(join(STORE, ".dev.vars"), "ADMIN_KEY=int-local-only\n");
let r = npx(["wrangler", "d1", "migrations", "apply", "onestopshop", "--local", "--persist-to", GOLD]);
if (r.status) { console.error("migrations failed\n" + r.stdout + r.stderr); process.exit(1); }
for (const f of SEED_FILES) { r = npx(["wrangler", "d1", "execute", "onestopshop", "--local", "--persist-to", GOLD, "--file", seedPath(f)]); if (r.status) { console.error("seed failed: " + f + "\n" + (r.stdout + r.stderr).slice(-800)); process.exit(1); } }

const geo = spawn(process.execPath, [join(STORE, "tools", "fake-geoapify.mjs")], { stdio: "ignore", detached: !WIN });
const results = [];
try {
  for (const t of list) {
    rmSync(STATE, { recursive: true, force: true }); cpSync(GOLD, STATE, { recursive: true });
    const dev = spawn(WIN ? "npx.cmd" : "npx", ["wrangler", "dev", "--local", "--test-scheduled", "--ip", "127.0.0.1", "--port", String(PORT), "--persist-to", STATE,
      "--var", "ADMIN_KEY:int-local-only", "--var", "GEOAPIFY_KEY:test", "--var", "GEOAPIFY_BASE:http://127.0.0.1:4499"], { cwd: STORE, stdio: "ignore", shell: WIN, detached: !WIN });
    let up = false; for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${PORT}/`)).status === 200; } catch {} if (!up) await sleep(1000); }
    await sleep(2000);
    const script = join(STORE, "tools", t + ".mjs"), args = existsSync(script) ? [script] : null;
    let code = 1, text = `no such suite: ${t}`;
    if (args && up) {
      if (!NOARG.has(t)) { mkdirSync(join(OUT, t), { recursive: true }); args.push(join(OUT, t)); }
      const run = spawnSync(process.execPath, args, { cwd: join(STORE, ".."), encoding: "utf8", timeout: 40 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, BASE: `http://127.0.0.1:${PORT}${SLASH.has(t) ? "/" : ""}`, PERSIST: STATE, ADMIN_KEY: "int-local-only", STRIPE: "http://127.0.0.1:4498" } });
      code = run.status ?? 1; text = (run.stdout || "") + (run.stderr || "");
    } else if (!up) text = "the store did not start";
    writeFileSync(join(OUT, t + ".txt"), text);
    const tail = text.split(/\r?\n/).filter(l => /FAIL|PASS|passed|Error|waves played/.test(l)).slice(-8).join("\n   ");
    console.log(`== ${t} exit ${code}${tail ? "\n   " + tail : ""}`); results.push([t, code]);
    kill(dev); await sleep(1500);
  }
} finally { kill(geo); rmSync(join(STORE, ".dev.vars"), { force: true }); }
const bad = results.filter(([, c]) => c !== 0);
console.log(bad.length ? `FAILED: ${bad.map(([t]) => t).join(", ")}` : `ALL ${results.length} PASSED`); process.exit(bad.length ? 1 : 0);
