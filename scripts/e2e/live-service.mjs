#!/usr/bin/env node
// Live core-routed service e2e — drive the app socket → core → ServiceManager →
// db-studio sidecar → a real SQLite file. Proves the FULL stack end-to-end
// against a running app (not just the sidecar wire). Idempotent: temp db,
// self-cleaning. Requires the app up and the sidecar staged (./stage.sh).
//   SOKSAK_SOCKET=~/.soksak-dev/com.soksak.dev.sock node scripts/e2e/live-service.mjs
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const SOCKET =
  process.env.SOKSAK_SOCKET ||
  path.join(os.homedir(), ".soksak-dev", "com.soksak.dev.sock");
const P = "plugin.soksak-plugin-db-studio.";

let sock;
let seq = 0;
const pend = new Map();
let rbuf = "";
function connect() {
  return new Promise((res, rej) => {
    sock = net.createConnection(SOCKET);
    sock.setNoDelay(true);
    sock.once("connect", res);
    sock.once("error", rej);
    sock.on("data", (d) => {
      rbuf += d.toString("utf8");
      let i;
      while ((i = rbuf.indexOf("\n")) >= 0) {
        const line = rbuf.slice(0, i);
        rbuf = rbuf.slice(i + 1);
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        const p = pend.get(m.id);
        if (p) {
          pend.delete(m.id);
          p(m);
        }
      }
    });
  });
}
function rpc(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pend.set(id, res);
    sock.write(JSON.stringify({ id, method, params }) + "\n");
    setTimeout(() => {
      if (pend.has(id)) {
        pend.delete(id);
        rej(new Error("TIMEOUT " + method));
      }
    }, 15000);
  });
}
const val = (m) => ({ ...m, ...(m.data || {}) });
let pass = 0;
let fail = 0;
const ok = (c, msg, d) => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "✓" : "✗"} ${msg}${d && !c ? " → " + JSON.stringify(d).slice(0, 300) : ""}`);
};

async function main() {
  await connect();
  // Bring the plugin fully live: (1) load the dev manifest from disk, (2) enable
  // it — this registers its commands + wires the core-routed service (spawns the
  // sidecar). Plugin commands are window-local, so also open the view.
  const loaded = await rpc("plugin.dev.load", {
    path: "/Users/max/.soksak-dev/plugins/soksak-plugin-db-studio",
  }).catch((e) => ({ error: String(e) }));
  console.log("  dev.load →", loaded.ok ? "OK" : JSON.stringify(loaded).slice(0, 220));
  const enabled = await rpc("plugin.enable", {
    id: "soksak-plugin-db-studio",
  }).catch((e) => ({ error: String(e) }));
  console.log("  enable   →", enabled.ok ? JSON.stringify(enabled.data) : JSON.stringify(enabled).slice(0, 220));
  await new Promise((r) => setTimeout(r, 1500));
  const opened = await rpc("plugin.view.open", {
    view: "soksak-plugin-db-studio.canvas",
  }).catch((e) => ({ error: String(e) }));
  console.log("  view.open →", opened.ok ? "OK" : JSON.stringify(opened).slice(0, 220));
  await new Promise((r) => setTimeout(r, 2500));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "db-studio-live-"));
  const dbfile = path.join(dir, "test.db");
  try {
    ok(val(await rpc(P + "db-create", { file: dbfile })).ok, "db-create (service op → core spawns the sidecar, real file made)");
    ok(val(await rpc(P + "db-connect", { profile: "live", file: dbfile })).ok, "db-connect");
    ok(
      val(await rpc(P + "db-exec", { profile: "live", sql: "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, password TEXT)" })).ok,
      "db-exec CREATE (gated write over the live stack)",
    );
    ok(val(await rpc(P + "db-exec", { profile: "live", sql: "INSERT INTO users(email,password) VALUES ('a@x.com','secret')" })).ok, "db-exec INSERT");

    const intro = val(await rpc(P + "db-introspect", { profile: "live" }));
    ok(intro.ok && (intro.tables || []).some((t) => t.name === "users"), "db-introspect → users reconstructed", intro);

    const q = val(await rpc(P + "query-run", { profile: "live", sql: "SELECT email, password FROM users" }));
    const row = (q.rows || [])[0] || [];
    ok(q.ok, "query-run", q);
    ok(row[0] === "a@x.com", "real row over the live stack", row);
    ok(row[1] === "<redacted:password>", "sensitive column masked live", row);

    await rpc(P + "db-disconnect", { profile: "live" }).catch(() => {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    sock.end();
  }

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"}: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("ERROR", e);
  process.exit(2);
});
