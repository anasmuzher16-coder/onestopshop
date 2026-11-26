// TEMPORARY (CI diagnosis, ci-reliable branch): e2e-flow exactly as it is, without its screenshot folder.
process.argv.length = 2;
await import("./e2e-flow.mjs");
