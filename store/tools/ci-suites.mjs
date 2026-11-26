// Runs store suites the way the laptop runner does (scratchpad suites.ps1), on any OS: a fresh copy of a seeded local
// database per suite, the store restarted per suite, the fake map service up, no card keys (the live demo's mode).
// Used by .github/workflows/store-tests.yml (one shard of suites per machine) and locally:
//   node store/tools/ci-suites.mjs smoke-http e2e-nav ...      (from the repo root; needs wrangler and playwright installed)
// Env: PW_FROM (a package.json whose node_modules has playwright), PORT (default 4493).
// Each suite's line says how it ended and whether the store was still up afterwards, so a crash is never mistaken for a
// failed check: "store DIED (signal ...)" means the store process went away during the suite.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync, openSync, closeSync } from "node:fs";
import { connect } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SEED_FILES, seedPath } from "./seed-files.mjs";

const STORE = fileURLToPath(new URL("../", import.meta.url)), WORK = join(process.env.RUNNER_TEMP || tmpdir(), "oss-ci"),   // outside the project, so the dev server never sees a file change
  PORT = +(process.env.PORT || 4493);
const GOLD = join(WORK, "gold"), STATE = join(WORK, "state"), OUT = process.env.CI_OUT || join(STORE, ".ci", "out"), WIN = process.platform === "win32";
// suites that take the store's base URL with a trailing slash, and those that take an output folder argument (as suites.ps1)
const SLASH = new Set(["e2e", "phone-audit", "whitebox", "fx-robust"]), NOARG = new Set(["smoke-http", "phone-audit", "test-ace", "test-account", "test-payments", "whitebox", "fx-robust", "ci-warm"]);
const list = process.argv.slice(2); if (!list.length) { console.error("name the suites to run"); process.exit(2); }
const npx = (args, opt = {}) => spawnSync(WIN ? "npx.cmd" : "npx", args, { cwd: STORE, encoding: "utf8", shell: WIN, ...opt });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
// is anything listening on the port? (a refused connection means the old store has let go of it)
const listening = port => new Promise(res => { const s = connect({ host: "127.0.0.1", port }); s.once("connect", () => { s.destroy(); res(true); }); s.once("error", () => res(false)); s.setTimeout(2000, () => { s.destroy(); res(true); }); });
const alive = async () => { try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 10000); const r = await fetch(`http://127.0.0.1:${PORT}/`, { signal: ac.signal, headers: { Connection: "close" } }); clearTimeout(tm); await r.arrayBuffer(); return r.status; } catch (e) { return String(e?.cause?.code || e?.name || e); } };
const workerds = () => WIN ? "" : (spawnSync("pgrep", ["-a", "workerd"], { encoding: "utf8" }).stdout || "").trim();

// stop the whole store process group (npx -> wrangler -> workerd), then wait until it has really gone and the port is free,
// so the next suite's store never starts beside a dying one
async function stop(p) {
  if (!p) return;
  if (p.exitCode === null && p.signalCode === null) {
    if (WIN) spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"]);
    else { try { process.kill(-p.pid, "SIGTERM"); } catch {} }
    for (let i = 0; i < 50 && p.exitCode === null && p.signalCode === null; i++) await sleep(100);
  }
  if (!WIN) { try { process.kill(-p.pid, "SIGKILL"); } catch {} }   // anything left in the group (workerd ignores a parent's death)
  for (let i = 0; i < 300 && await listening(PORT); i++) await sleep(100);
  if (await listening(PORT)) console.log(`   !! port ${PORT} still taken 30 s after the store was stopped\n   ${workerds()}`);
  const left = workerds(); if (left) console.log(`   !! workerd still running after the stop:\n   ${left.replace(/\n/g, "\n   ")}`);
}

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
    if (await listening(PORT)) console.log(`   !! port ${PORT} is taken before ${t} starts\n   ${workerds()}`);
    const fd = openSync(join(OUT, t + ".dev.log"), "w"), t0 = Date.now();
    const dev = spawn(WIN ? "npx.cmd" : "npx", ["wrangler", "dev", "--local", "--test-scheduled", "--ip", "127.0.0.1", "--port", String(PORT), "--persist-to", STATE,
      "--var", "ADMIN_KEY:int-local-only", "--var", "GEOAPIFY_KEY:test", "--var", "GEOAPIFY_BASE:http://127.0.0.1:4499"], { cwd: STORE, stdio: ["ignore", fd, fd], shell: WIN, detached: !WIN });
    let died = null; dev.once("exit", (code, signal) => { died = { code, signal, after: Math.round((Date.now() - t0) / 1000) }; });
    let up = false; for (let i = 0; i < 120 && !up && !died; i++) { try { up = (await fetch(`http://127.0.0.1:${PORT}/`)).status === 200; } catch {} if (!up) await sleep(1000); }
    await sleep(2000);
    const script = join(STORE, "tools", t + ".mjs"), args = existsSync(script) ? ["--import", pathToFileURL(join(STORE, "tools", "ci-preload.mjs")).href, script] : null;
    let code = 1, text = `no such suite: ${t}`;
    if (args && up) {
      if (!NOARG.has(t)) { mkdirSync(join(OUT, t), { recursive: true }); args.push(join(OUT, t)); }
      // async, so the store's exit is seen the moment it happens rather than after the suite
      const run = spawn(process.execPath, args, { cwd: join(STORE, ".."), env: { ...process.env, BASE: `http://127.0.0.1:${PORT}${SLASH.has(t) ? "/" : ""}`, PERSIST: STATE, ADMIN_KEY: "int-local-only", STRIPE: "http://127.0.0.1:4498" } });
      const chunks = []; run.stdout.on("data", c => chunks.push(c)); run.stderr.on("data", c => chunks.push(c));
      const limit = setTimeout(() => { chunks.push(Buffer.from("\n[ci] the suite ran past 40 minutes and was stopped\n")); run.kill("SIGKILL"); }, 40 * 60 * 1000);
      const [c, sig] = await new Promise(res => run.once("close", (c, s) => res([c, s]))); clearTimeout(limit);
      code = c ?? 1; text = Buffer.concat(chunks).toString("utf8") + (sig ? `\n[ci] the suite process ended by ${sig}\n` : "");
    } else if (!up) text = died ? `the store did not start (it exited: code ${died.code}, signal ${died.signal})` : "the store did not start";
    const after = died ? `store DIED during the suite (code ${died.code}, signal ${died.signal}, ${died.after} s after start)` : `store after the suite: ${await alive()}`;
    writeFileSync(join(OUT, t + ".txt"), text + `\n[ci] ${after}\n`);
    const tail = text.split(/\r?\n/).filter(l => /FAIL|PASS|passed|Error|waves played|closed|crash/i.test(l)).slice(-8).join("\n   ");
    console.log(`== ${t} exit ${code} (${Math.round((Date.now() - t0) / 1000)} s, ended ${stamp()}; ${after})${tail ? "\n   " + tail : ""}`); results.push([t, code]);
    await stop(dev); closeSync(fd);
  }
} finally { if (WIN) spawnSync("taskkill", ["/PID", String(geo.pid), "/T", "/F"]); else { try { process.kill(-geo.pid, "SIGKILL"); } catch { geo.kill("SIGKILL"); } } rmSync(join(STORE, ".dev.vars"), { force: true }); }
const bad = results.filter(([, c]) => c !== 0);
console.log(bad.length ? `FAILED: ${bad.map(([t]) => t).join(", ")}` : `ALL ${results.length} PASSED`); process.exit(bad.length ? 1 : 0);
