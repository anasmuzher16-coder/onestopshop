// Runs store suites the way the laptop runner does (scratchpad suites.ps1), on any OS: a fresh copy of a seeded local
// database per suite, the store restarted per suite, the fake map service up, no card keys (the live demo's mode).
// CARD=1 runs every suite in card mode instead, as suites.ps1 -Mode stripe does: the Stripe stand-in (tools/fake-stripe.mjs)
// restarted on 4498 per suite and the store given its test keys. A suite named with "+tobacco" (test-pay-card+tobacco) also
// gets STRIPE_TOBACCO_OK=1. test-emails gets the Resend stand-in (tools/fake-resend.mjs, 4497) and the mail settings.
// Used by .github/workflows/store-tests.yml (one shard of suites per machine) and locally:
//   node store/tools/ci-suites.mjs smoke-http e2e-nav ...      (from the repo root; needs wrangler and playwright installed)
// Env: PW_FROM (a package.json whose node_modules has playwright), PORT (default 4493).
// Each suite's line says how it ended and whether the store was still up afterwards, so a crash is never mistaken for a
// failed check: "store DIED" means the store process went away during the suite, "CRASH" names what crashed.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync, openSync, closeSync, renameSync } from "node:fs";
import { connect } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SEED_FILES, seedPath } from "./seed-files.mjs";

const STORE = fileURLToPath(new URL("../", import.meta.url)), WORK = join(process.env.RUNNER_TEMP || tmpdir(), "oss-ci"),   // outside the project, so the dev server never sees a file change
  PORT = +(process.env.PORT || 4493);
const GOLD = join(WORK, "gold"), STATE = join(WORK, "state"), OUT = process.env.CI_OUT || join(STORE, ".ci", "out"), WIN = process.platform === "win32";
const GH = process.env.GITHUB_ACTIONS === "true";   // on GitHub's machines (the laptop runs every suite as before)
// suites that take the store's base URL with a trailing slash, and those that take an output folder argument (as suites.ps1)
const SLASH = new Set(["e2e", "phone-audit", "whitebox", "fx-robust"]), NOARG = new Set(["smoke-http", "phone-audit", "test-ace", "test-account", "test-payments", "test-pay-card", "test-emails", "test-golive", "whitebox", "fx-robust", "ci-warm", "e2e-gallery"]);
// On GitHub, e2e-flow runs without its screenshot folder (the folder only feeds its screenshots; every check runs either way).
// A full-page screenshot resizes the page while the checkout's page-change animation (a view transition, app.js
// document.startViewTransition) is still running on these slow machines; Chrome aborts the transition ("Transition was aborted
// because of invalid state") and the suite's "no page errors" check sees the unhandled rejection. With screenshots it failed
// 5 of 5 times on GitHub, without them it passed 2 of 2 (runs 45901104803, 45901810149 on the ci-reliable branch).
if (GH) NOARG.add("e2e-flow");
const CARD = process.env.CARD === "1", MAIL = new Set(["test-emails"]);
const CARD_VARS = ["STRIPE_SECRET_KEY:sk_test_local", "STRIPE_WEBHOOK_SECRET:whsec_local_test", "STRIPE_API_BASE:http://127.0.0.1:4498"];
const MAIL_VARS = ["RESEND_API_KEY:re_test_local", "EMAIL_FROM:One Stop Shop <orders@shop.test>", "OWNER_EMAIL:counter@shop.test", "RESEND_API_BASE:http://127.0.0.1:4497", "EMAIL_RETRY_UNIT_MS:10"];   // retry minutes become 10 ms (honoured only against a local stand-in)
// "+openitems" or "+openall" (test-open-edit+openitems): the store gets the preview's open edit switch, PREVIEW_OPEN_EDIT=items or all
// (src/preview.js), and the suite EXPECT_OPEN=items or all. Without either the switch is off, as on every deployed store by default.
const OPEN = flags => flags.includes("openall") ? "all" : flags.includes("openitems") ? "items" : null;
const list = process.argv.slice(2); if (!list.length) { console.error("name the suites to run"); process.exit(2); }
const npx = (args, opt = {}) => spawnSync(WIN ? "npx.cmd" : "npx", args, { cwd: STORE, encoding: "utf8", shell: WIN, ...opt });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const NL = String.fromCharCode(10);
// is anything listening on the port? (a refused connection means the old process has let go of it)
const listening = port => new Promise(res => { const s = connect({ host: "127.0.0.1", port }); s.once("connect", () => { s.destroy(); res(true); }); s.once("error", () => res(false)); s.setTimeout(2000, () => { s.destroy(); res(true); }); });
const alive = async () => { try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 10000); const r = await fetch(`http://127.0.0.1:${PORT}/`, { signal: ac.signal, headers: { Connection: "close" } }); clearTimeout(tm); await r.arrayBuffer(); return r.status; } catch (e) { return String(e?.cause?.code || e?.name || e); } };
const workerds = () => WIN ? "" : (spawnSync("pgrep", ["-a", "workerd"], { encoding: "utf8" }).stdout || "").trim();

// stop a whole process group (npx -> wrangler -> workerd, or a stand-in), then wait until it has really gone and its port is
// free, so the next suite never starts beside a dying one. At most 5 s for the exit and 30 s for the port.
async function stop(p, port) {
  if (!p) return;
  if (p.exitCode === null && p.signalCode === null) {
    if (WIN) spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"]);
    else { try { process.kill(-p.pid, "SIGTERM"); } catch {} }
    for (let i = 0; i < 50 && p.exitCode === null && p.signalCode === null; i++) await sleep(100);
  }
  if (!WIN) { try { process.kill(-p.pid, "SIGKILL"); } catch {} }   // anything left in the group (workerd ignores a parent's death)
  if (!port) return;
  const until = Date.now() + 30000; while (Date.now() < until && await listening(port)) await sleep(100);
  if (await listening(port)) console.log(`   !! port ${port} still taken 30 s after the stop: ${workerds()}`);
}

// Crash evidence. A suite is run a second time only when it failed AND a process crashed under it: the store exited, the suite
// process was ended by a signal, Playwright reported a crashed page or a lost browser connection, or the kernel logged a browser
// crash while the suite ran AND the suite reported its browser gone. A failed check with no crash is never run again, a suite
// that fails twice counts as failed, and one that passes only on its second try is named at the end and flagged on GitHub.
const CRASHER = /WPEWebProcess|WPENetwork|WebCore|MiniBrowser|eadedCompositor|llvmpipe|chrome|headless_shell/;
const kernel = () => { if (WIN) return []; const r = spawnSync("sudo", ["-n", "dmesg"], { encoding: "utf8" }); if (r.status !== 0 || !r.stdout) return []; return r.stdout.split(NL).filter(l => /segfault|traps:|general protection/.test(l)); };
const CRASHED = /Target crashed|Page crashed|browser has disconnected/, GONE = /Target page, context or browser has been closed/;

// the seeded database, built once: migrations, then the seed files in order
rmSync(WORK, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
writeFileSync(join(STORE, ".dev.vars"), "ADMIN_KEY=int-local-only" + NL);
let r = npx(["wrangler", "d1", "migrations", "apply", "onestopshop", "--local", "--persist-to", GOLD]);
if (r.status) { console.error("migrations failed" + NL + r.stdout + r.stderr); process.exit(1); }
for (const f of SEED_FILES) { r = npx(["wrangler", "d1", "execute", "onestopshop", "--local", "--persist-to", GOLD, "--file", seedPath(f)]); if (r.status) { console.error("seed failed: " + f + NL + (r.stdout + r.stderr).slice(-800)); process.exit(1); } }

const geo = spawn(process.execPath, [join(STORE, "tools", "fake-geoapify.mjs")], { stdio: "ignore", detached: !WIN });

async function runOnce(t) {
  const [name, ...flags] = t.split("+");
  rmSync(STATE, { recursive: true, force: true }); cpSync(GOLD, STATE, { recursive: true });
  if (await listening(PORT)) console.log(`   !! port ${PORT} is taken before ${t} starts: ${workerds()}`);
  // SAMPLES_TEST_ONLY: the fixtures may switch demo samples on in this throwaway local database (src/admin.js samplesForTests)
  const vars = ["ADMIN_KEY:int-local-only", "GEOAPIFY_KEY:test", "GEOAPIFY_BASE:http://127.0.0.1:4499", "SAMPLES_TEST_ONLY:1", ...(CARD ? CARD_VARS : []), ...(MAIL.has(name) ? MAIL_VARS : []), ...(flags.includes("tobacco") ? ["STRIPE_TOBACCO_OK:1"] : []), ...(OPEN(flags) ? ["PREVIEW_OPEN_EDIT:" + OPEN(flags)] : [])];
  // the stand-ins keep their state in memory, so each suite gets fresh ones (webhooks go to this suite's store)
  const fake = (file, env) => spawn(process.execPath, [join(STORE, "tools", file)], { stdio: "ignore", detached: !WIN, env: { ...process.env, ...env } });
  const fs = CARD ? fake("fake-stripe.mjs", { PORT: "4498", STORE: `http://127.0.0.1:${PORT}` }) : null, fr = MAIL.has(name) ? fake("fake-resend.mjs", {}) : null;
  const fd = openSync(join(OUT, t + ".dev.log"), "w"), t0 = Date.now(), k0 = kernel().length;
  const dev = spawn(WIN ? "npx.cmd" : "npx", ["wrangler", "dev", "--local", "--test-scheduled", "--ip", "127.0.0.1", "--port", String(PORT), "--persist-to", STATE,
    ...vars.flatMap(v => ["--var", WIN && /\s/.test(v) ? `"${v}"` : v])], { cwd: STORE, stdio: ["ignore", fd, fd], shell: WIN, detached: !WIN });
  let died = null; dev.once("exit", (code, signal) => { died = { code, signal, after: Math.round((Date.now() - t0) / 1000) }; });
  let up = false; for (let i = 0; i < 120 && !up && !died; i++) { try { up = (await fetch(`http://127.0.0.1:${PORT}/`)).status === 200; } catch {} if (!up) await sleep(1000); }
  await sleep(2000);
  // on GitHub each suite loads ci-preload.mjs first (local requests on fresh connections; see that file)
  const script = join(STORE, "tools", name + ".mjs"), args = existsSync(script) ? [...(GH ? ["--import", pathToFileURL(join(STORE, "tools", "ci-preload.mjs")).href] : []), script] : null;
  let code = 1, text = `no such suite: ${t}`, sig = null, timedOut = false;
  if (args && up && !died) {
    if (!NOARG.has(name)) { mkdirSync(join(OUT, t), { recursive: true }); args.push(join(OUT, t)); }
    // async, so the store's exit is seen the moment it happens rather than after the suite
    const run = spawn(process.execPath, args, { cwd: join(STORE, ".."), env: { ...process.env, EXPECT_TOBACCO: flags.includes("tobacco") ? "1" : "0", EXPECT_OPEN: OPEN(flags) || "", EMAIL_RETRY_UNIT_MS: "10", BASE: `http://127.0.0.1:${PORT}${SLASH.has(name) ? "/" : ""}`, PERSIST: STATE, ADMIN_KEY: "int-local-only", STRIPE: "http://127.0.0.1:4498", RESEND: "http://127.0.0.1:4497" } });
    const chunks = []; run.stdout.on("data", c => chunks.push(c)); run.stderr.on("data", c => chunks.push(c));
    const limit = setTimeout(() => { timedOut = true; chunks.push(Buffer.from(NL + "[ci] the suite ran past 40 minutes and was stopped" + NL)); run.kill("SIGKILL"); }, 40 * 60 * 1000);
    let c; [c, sig] = await new Promise(res => run.once("close", (c, s) => res([c, s]))); clearTimeout(limit);
    code = c ?? 1; text = Buffer.concat(chunks).toString("utf8") + (sig ? NL + `[ci] the suite process ended by ${sig}` + NL : "");
  } else if (args) text = died ? `the store did not start (it exited: code ${died.code}, signal ${died.signal})` : "the store did not start";
  const gone = died, crashes = kernel().slice(k0).filter(l => CRASHER.test(l));   // both read before the stops below, which end processes on purpose
  const after = gone ? `store DIED during the suite (code ${gone.code}, signal ${gone.signal}, ${gone.after} s after start)` : `store after the suite: ${await alive()}`;
  await stop(dev, PORT); await stop(fs, fs && 4498); await stop(fr, fr && 4497); closeSync(fd);
  const browserGone = CRASHED.test(text) || (crashes.length > 0 && GONE.test(text));
  const crash = [gone && "the store exited", sig && !timedOut && `the suite process was ended by ${sig}`, browserGone && "the browser crashed under the suite"].filter(Boolean).join("; ");
  const klog = crashes.length ? "kernel: " + crashes.map(l => l.replace(/^\[[^\]]*\]\s*/, "").slice(0, 110)).join(" | ") : "";
  writeFileSync(join(OUT, t + ".txt"), text + NL + `[ci] ${after}` + NL + (crash ? `[ci] crash: ${crash}` + NL : "") + (klog ? `[ci] ${klog}` + NL : ""));
  const tail = text.split(/\r?\n/).filter(l => !/pw:browser/.test(l) && /FAIL|PASS|passed|Error|waves played|closed|crash/i.test(l)).slice(-8).join(NL + "   ");
  console.log(`== ${t} exit ${code} (${Math.round((Date.now() - t0) / 1000)} s, ended ${stamp()}; ${after})` + (crash ? NL + `   CRASH: ${crash}` : "") + (klog ? NL + `   ${klog}` : "") + (tail ? NL + "   " + tail : ""));
  return { code, crash };
}

const results = [], retried = [];
try {
  for (const t of list) {
    let { code, crash } = await runOnce(t);
    if (code !== 0 && crash) {   // one more try, for a crash only; the first try's output is kept beside the second's
      for (const f of [".txt", ".dev.log", ""]) if (existsSync(join(OUT, t + f))) renameSync(join(OUT, t + f), join(OUT, t + ".try1" + f));
      console.log(`   ${t} failed with a crash under it (${crash}): running it once more; the first try is kept as ${t}.try1.*`);
      ({ code } = await runOnce(t));
      if (code === 0) { retried.push(t); if (GH) console.log(`::warning title=${t} passed on its second try::the first try crashed (${crash}); see ${t}.try1.txt in the outputs`); }
    }
    results.push([t, code]);
  }
} finally { if (WIN) spawnSync("taskkill", ["/PID", String(geo.pid), "/T", "/F"]); else { try { process.kill(-geo.pid, "SIGKILL"); } catch { geo.kill("SIGKILL"); } } rmSync(join(STORE, ".dev.vars"), { force: true }); }
const bad = results.filter(([, c]) => c !== 0);
console.log(CARD ? "(card mode: fake Stripe keys)" : "(no card keys)");
if (retried.length) console.log(`PASSED ON A SECOND TRY AFTER A CRASH: ${retried.join(", ")}`);
console.log(bad.length ? `FAILED: ${bad.map(([t]) => t).join(", ")}` : `ALL ${results.length} PASSED`); process.exit(bad.length ? 1 : 0);
