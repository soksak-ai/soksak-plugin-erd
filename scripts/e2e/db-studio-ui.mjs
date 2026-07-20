#!/usr/bin/env node
// soksak-plugin-db-studio LIVE UI E2E (R3) — 실제 Tauri 앱에서 새 DB 패널을 구동하고 스냅샷한다.
// 절차: 플러그인 dev-load+enable+view.open → 실 SQLite(마스킹 컬럼) 셋업(서비스 op) → 접속 프로필
// 등록 → 뷰 활성(정본 방법: window.focus{label}→view.list→view.activate) → ui.input 으로 Query
// 탭·프로필 선택·SQL 실행 구동 → window.snapshot(고정 경로). 멱등: 픽스처 고정경로 재생성, 무창이면
// 스냅샷만 스킵(단언은 서비스 op 로 유지). node -e 일회성 금지 — 이 파일이 정본 재사용 하니스다.
//   SOKSAK_SOCKET=~/.soksak-dev/com.soksak.dev.sock node scripts/e2e/db-studio-ui.mjs
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const SOCKET =
  process.env.SOKSAK_SOCKET || path.join(os.homedir(), ".soksak-dev", "com.soksak.dev.sock");
const ID = "soksak-plugin-db-studio";
const P = `plugin.${ID}.`;
const PLUGIN_DIR = path.resolve(new URL("../..", import.meta.url).pathname); // .../plugins/soksak-plugin-db-studio
const FIXTURE = path.join(os.homedir(), ".soksak-e2e", "db-studio-ui");
const DBFILE = path.join(FIXTURE, "shop.db");
const SNAP_DIR = process.env.SNAP_DIR || path.join(os.homedir(), ".soksak-e2e");

let sock, seq = 0;
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
        if (p) { pend.delete(m.id); p(m); }
      }
    });
  });
}
function rpc(method, params = {}, timeoutMs = 15000) {
  const id = ++seq;
  return new Promise((res) => {
    pend.set(id, res);
    sock.write(JSON.stringify({ id, method, params }) + "\n");
    setTimeout(() => { if (pend.has(id)) { pend.delete(id); res({ ok: false, code: "TIMEOUT", method }); } }, timeoutMs);
  });
}
const val = (m) => ({ ...m, ...(m.data || {}) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, msg, d) => { c ? pass++ : fail++; console.log(`  ${c ? "✓" : "✗"} ${msg}${d && !c ? " → " + JSON.stringify(d).slice(0, 240) : ""}`); };

async function snapshot(name) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  const out = path.join(SNAP_DIR, name);
  const s = val(await rpc("window.snapshot", { path: out }));
  if (s.ok) console.log(`  ▶ snapshot: ${s.saved || out}`);
  else console.log(`  ▶ snapshot(${name}): 스킵 — ${s.message || s.code}`);
  return s.ok ? out : null;
}

// data-node path("panel-tab/query" 등)로 ui.tree 절대주소를 찾아 클릭/채운다(런타임 발견).
const DB_NODE_RE = /^(panel-tab|connection|conn-|query|sync|migration|add-table)/;
async function tree() { return val(await rpc("ui.tree")).nodes || []; }
function findAddr(nodes, nodePath) {
  const hit = nodes.find((n) => n.nodePath === nodePath || n.address.endsWith("/" + nodePath) || n.address.endsWith(nodePath));
  return hit?.address || null;
}
async function click(nodePath) {
  const a = findAddr(await tree(), nodePath);
  if (!a) return { ok: false, code: "NOT_FOUND", nodePath };
  return val(await rpc("ui.input.click", { address: a }));
}
async function fill(nodePath, value) {
  const a = findAddr(await tree(), nodePath);
  if (!a) return { ok: false, code: "NOT_FOUND", nodePath };
  return val(await rpc("ui.input.fill", { address: a, value }));
}

async function main() {
  await connect();

  // 1) 플러그인을 라이브로: dev-load → enable → view.open.
  await rpc("plugin.dev.load", { path: PLUGIN_DIR });
  ok(val(await rpc("plugin.enable", { id: ID })).ok, "plugin.enable");
  await rpc("plugin.view.open", { view: `${ID}.canvas` });
  await sleep(1200);

  // 2) 실 SQLite 픽스처(마스킹 컬럼) — 멱등: 고정경로 재생성. 서비스 op 로 셋업.
  fs.rmSync(FIXTURE, { recursive: true, force: true });
  fs.mkdirSync(FIXTURE, { recursive: true });
  ok(val(await rpc(P + "db-create", { file: DBFILE })).ok, "db-create 픽스처");
  ok(val(await rpc(P + "db-connect", { profile: "seed", file: DBFILE })).ok, "db-connect(seed)");
  ok(val(await rpc(P + "db-exec", { profile: "seed", sql: "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, password TEXT)" })).ok, "create users");
  await rpc(P + "db-exec", { profile: "seed", sql: "INSERT INTO users(email,password) VALUES ('ada@example.com','s3cr3t'),('grace@example.com','hunter2'),('linus@example.com','tux')" });
  await rpc(P + "db-disconnect", { profile: "seed" });

  // 3) UI 가 볼 접속 프로필 등록(비밀 제외 메타). id 고정 → 노드 주소 결정적.
  ok(val(await rpc(P + "db-profile-add", { id: "shop", name: "shop.db", dialect: "sqlite", file: DBFILE })).ok, "db-profile-add");

  // 4) 전 창 탐색: 각 창을 focus → view.list(뷰 보유?) → view.activate → ui.tree(db-node 노출?).
  //    db-studio 뷰의 DOM 노드가 ui.tree 에 뜨는 창을 찾는다(어느 webview 가 스캔되는지 확정).
  const labels = val(await rpc("window.list")).labels || [];
  let target = null;
  let nodes = [];
  let db = [];
  for (const label of labels) {
    await rpc("window.focus", { label });
    await sleep(300);
    const views = val(await rpc("view.list")).views || [];
    const v = views.find((x) => x.plugin === ID);
    if (v) await rpc("view.activate", { view: v.id });
    await rpc("window.focus", { label });
    await sleep(600);
    const t = await tree();
    const d = t.filter((n) => DB_NODE_RE.test(n.nodePath || ""));
    console.log(`  · ${label.slice(0, 10)} view=${v ? "Y" : "-"} ui.tree=${t.length} db-node=${d.length}`);
    if (d.length) { target = label; nodes = t; db = d; break; }
    if (v && !nodes.length) { target = label; nodes = t; } // 뷰 보유하나 노드 미노출(nested webview 후보)
  }
  console.log(`  ▶ db-node 노출 창: ${db.length ? target?.slice(0, 10) : "없음(전 창)"} — db-node ${db.length}개`);

  if (db.length) {
    // 6) Query 탭 구동: 탭 전환 → 프로필 선택(→db-connect) → SQL 채움 → 실행 → 마스킹 결과.
    ok((await click("panel-tab/query")).ok !== false, "panel-tab/query 클릭");
    await sleep(400);
    ok((await click("connection-item/shop")).ok !== false, "connection-item/shop 클릭(→접속)");
    await sleep(900);
    ok((await fill("query-editor", "SELECT id, email, password FROM users")).ok !== false, "query-editor 채움");
    ok((await click("query-run")).ok !== false, "query-run 클릭");
    await sleep(1200);
    await snapshot("db-studio-query.png"); // ← 마스킹 결과가 보여야 함
    await click("panel-tab/sync"); await sleep(1400); await snapshot("db-studio-sync.png");
    await click("panel-tab/migration"); await sleep(700); await snapshot("db-studio-migration.png");
  } else {
    // 어느 창의 ui.tree 에도 db-node 없음 = 뷰가 중첩 webview(런처 webview 의 nodeScan 이 못 넘음).
    // 뷰 내부는 커맨드로 구동한다(데이터·마스킹=e2e:live). 뷰 렌더는 스냅샷으로 고정한다.
    if (target) await rpc("window.focus", { label: target });
    await sleep(600);
    console.log(`  ▶ db-node 미노출(전 창) — 뷰=중첩 webview. 마지막 창 ui.tree: ${nodes.map((n) => n.nodePath).join(", ")}`);
    await snapshot("db-studio-view.png");
  }

  console.log(`\n=== db-studio UI E2E: ${pass} pass / ${fail} fail ===`);
  console.log(`  스냅샷 리뷰: ${SNAP_DIR}/db-studio-*.png`);
  sock.end();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("E2E FAIL:", e.message); process.exit(1); });
