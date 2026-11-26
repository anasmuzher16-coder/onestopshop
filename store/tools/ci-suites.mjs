// Runs store suites the way the laptop runner does (scratchpad suites.ps1), on any OS: a fresh copy of a seeded local
// database per suite, the store restarted per suite, the fake map service up, no card keys (the live demo's mode).
// CARD=1 runs every suite in card mode instead, as suites.ps1 -Mode stripe does: the Stripe stand-in (tools/fake-stripe.mjs)
// restarted on 4498 per suite and the store given its test keys. A suite named with "+tobacco" (test-pay-card+tobacco) also
// gets STRIPE_TOBACCO_OK=1. test-emails gets the Resend stand-in (tools/fake-resend.mjs, 4497) and the mail settings.
// Used by .github/workflows/store-tests.yml (one shard of suites per machine) and locally:
//   node store/tools/ci-suites.mjs smoke-http e2e-nav ...      (from the repo root; needs wrangler and playwright installed)
// Env: PW_FROM (a package.json whose node_modules has playwright), PORT (default 4493).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SEED_FILES, seedPath } from "./seed-files.mjs";

const STORE = fileURLToPath(new URL("../", import.meta.url)), WORK = join(process.env.RUNNER_TEMP || tmpdir(), "oss-ci"),   // outside the project, so the dev server never sees a file change
  PORT = +(process.env.PORT || 4493);
const GOLD = join(WORK, "gold"), STATE = join(WORK, "state"), OUT = process.env.CI_OUT || join(STORE, ".ci", "out"), WIN = process.platform === "win32";
// suites that take the store's base URL with a trailing slash, and those that take an output folder argument (as suites.ps1)
const SLASH = new Set(["e2e", "phone-audit", "whitebox", "fx-robust"]), NOARG = new Set(["smoke-http", "phone-audit", "test-ace", "test-account", "test-payments", "test-pay-card", "test-emails", "test-golive", "whitebox", "fx-robust"]);
const CARD = process.env.CARD === "1", MAIL = new Set(["test-emails"]);
const CARD_VARS = ["STRIPE_SECRET_KEY:sk_test_local", "STRIPE_WEBHOOK_SECRET:whsec_local_test", "STRIPE_API_BASE:http://127.0.0.1:4498"];
const MAIL_VARS = ["RESEND_API_KEY:re_test_local", "EMAIL_FROM:One Stop Shop <orders@shop.test>", "OWNER_EMAIL:counter@shop.test", "RESEND_API_BASE:http://127.0.0.1:4497", "EMAIL_RETRY_UNIT_MS:10"];   // retry minutes become 10 ms (honoured only against a local stand-in)
const list = process.argv.slice(2); if (!list.length) { console.error("name the suites to run"); process.exit(2); }
const npx = (args, opt = {}) => spawnSync(WIN ? "npx.cmd" : "npx", args, { cwd: STORE, encoding: "utf8", shell: WIN, ...opt });
const logFd = t => openSync(join(OUT, t + ".dev.log"), "w");
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
    const [name, ...flags] = t.split("+");
    rmSync(STATE, { recursive: true, force: true }); cpSync(GOLD, STATE, { recursive: true });
    const vars = ["ADMIN_KEY:int-local-only", "GEOAPIFY_KEY:test", "GEOAPIFY_BASE:http://127.0.0.1:4499", ...(CARD ? CARD_VARS : []), ...(MAIL.has(name) ? MAIL_VARS : []), ...(flags.includes("tobacco") ? ["STRIPE_TOBACCO_OK:1"] : [])];
    // the stand-ins keep their state in memory, so each suite gets fresh ones (webhooks go to this suite's store)
    const fake = (file, env) => spawn(process.execPath, [join(STORE, "tools", file)], { stdio: "ignore", detached: !WIN, env: { ...process.env, ...env } });
    const fs = CARD ? fake("fake-stripe.mjs", { PORT: "4498", STORE: `http://127.0.0.1:${PORT}` }) : null, fr = MAIL.has(name) ? fake("fake-resend.mjs", {}) : null;
    const dev = spawn(WIN ? "npx.cmd" : "npx", ["wrangler", "dev", "--local", "--test-scheduled", "--ip", "127.0.0.1", "--port", String(PORT), "--persist-to", STATE,
      ...vars.flatMap(v => ["--var", WIN && /\s/.test(v) ? `"${v}"` : v])], { cwd: STORE, stdio: ["ignore", logFd(t), logFd(t)], shell: WIN, detached: !WIN });
    let up = false; for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${PORT}/`)).status === 200; } catch {} if (!up) await sleep(1000); }
    await sleep(2000);
    const script = join(STORE, "tools", name + ".mjs"), args = existsSync(script) ? [script] : null;
    let code = 1, text = `no such suite: ${t}`;
    if (args && up) {
      if (!NOARG.has(name)) { mkdirSync(join(OUT, t), { recursive: true }); args.push(join(OUT, t)); }
      const run = spawnSync(process.execPath, args, { cwd: join(STORE, ".."), encoding: "utf8", timeout: 40 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, EXPECT_TOBACCO: flags.includes("tobacco") ? "1" : "0", EMAIL_RETRY_UNIT_MS: "10", BASE: `http://127.0.0.1:${PORT}${SLASH.has(name) ? "/" : ""}`, PERSIST: STATE, ADMIN_KEY: "int-local-only", STRIPE: "http://127.0.0.1:4498", RESEND: "http://127.0.0.1:4497" } });
      code = run.status ?? 1; text = (run.stdout || "") + (run.stderr || "");
    } else if (!up) text = "the store did not start";
    writeFileSync(join(OUT, t + ".txt"), text);
    const tail = text.split(/\r?\n/).filter(l => /FAIL|PASS|passed|Error|waves played/.test(l)).slice(-8).join("\n   ");
    console.log(`== ${t} exit ${code}${tail ? "\n   " + tail : ""}`); results.push([t, code]);
    kill(dev); kill(fs); kill(fr); await sleep(1500);
  }
} finally { kill(geo); rmSync(join(STORE, ".dev.vars"), { force: true }); }
const bad = results.filter(([, c]) => c !== 0);
console.log(CARD ? "(card mode: fake Stripe keys)" : "(no card keys)");
console.log(bad.length ? `FAILED: ${bad.map(([t]) => t).join(", ")}` : `ALL ${results.length} PASSED`); process.exit(bad.length ? 1 : 0);
