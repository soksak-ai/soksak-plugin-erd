#!/usr/bin/env node
// soksak-plugin-erd E2E — 영속 복원 시나리오(런타임 재적재 후 스키마 생존).
// persist.ts 계약의 라이브 검증: apply → persist-flush → plugin.reload(id) → get-schema.
//   사용: SOKSAK_SOCKET=<home>/<identifier>.sock node scripts/e2e/erd-restore.mjs
// 멱등: 시작·종료 시 data.ns.remove 로 플러그인 ns 를 회수하고 빈 런타임을 재적재한다.
import net from "node:net";

const SOCKET = process.env.SOKSAK_SOCKET;
if (!SOCKET) {
  // 기본 소켓 추측 금지 — identity home 별 경로가 다르다(감춰진 오배선 방지).
  console.error("usage: SOKSAK_SOCKET=<home>/<identifier>.sock node scripts/e2e/erd-restore.mjs");
  process.exit(2);
}
const ID = "soksak-plugin-erd";
const P = `plugin.${ID}.`;

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
    }, 8000);
  });
}
// 소켓 봉투는 payload 를 data 아래 중첩한다({ok,code,message,data:{...}}) — 한 번만 평탄화.
const val = (m) => {
  const v = m.result ?? m;
  return v && typeof v === "object" && v.data && typeof v.data === "object" ? { ...v, ...v.data } : v;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (cond, msg, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "✓" : "✗"} ${msg}${detail && !cond ? " → " + JSON.stringify(detail).slice(0, 200) : ""}`);
};

// 재적재 직후 새 런타임이 응답할 때까지 — 상한 15회×400ms(폴링 아님: 부팅 대기, 종료조건 명시).
async function waitRuntime() {
  for (let i = 0; i < 15; i++) {
    const r = val(await rpc(P + "ping").catch(() => ({ ok: false })));
    if (r.ok) return true;
    await sleep(400);
  }
  return false;
}

async function reloadRuntime() {
  await rpc("plugin.reload", { id: ID });
  return waitRuntime();
}

async function resetAll() {
  // 내구 문서까지 회수(멱등 기반) 후 빈 런타임 재적재.
  await rpc("data.ns.remove", { ns: ID }).catch(() => {});
  return reloadRuntime();
}

async function main() {
  await connect();
  ok(await resetAll(), "클린 슬레이트(ns 회수 + 재적재 + ping)");

  const empty = val(await rpc(P + "get-schema", { mode: "compact" }));
  ok((empty.tables || []).length === 0, "초기 스키마 비어있음", empty);

  // 1) 스키마 구축 + 좌표/뷰포트.
  const built = val(await rpc(P + "apply", {
    title: "restore-e2e",
    ops: [
      { command: "create-table", params: { name: "users", columns: [
        { name: "id", dataType: "INT", isPrimaryKey: true, autoIncrement: true },
        { name: "email", dataType: "VARCHAR(255)", isUnique: true },
      ] } },
      { command: "create-table", params: { name: "orders", columns: [
        { name: "id", dataType: "INT", isPrimaryKey: true, autoIncrement: true },
        { name: "total", dataType: "DECIMAL(12,2)" },
      ] } },
      { command: "add-relationship", params: { source: "users", target: "orders", type: "1:N", autoFk: true } },
      { command: "set-position", params: { table: "users", x: 120, y: 80 } },
    ],
  }));
  ok(built.ok, "apply 배치(users+orders+관계+좌표)", built);
  const vp = val(await rpc(P + "set-viewport", { x: 33, y: -10, zoom: 1.5 }));
  ok(vp.ok, "set-viewport", vp);

  // 2) 즉시 기록(디바운스 우회 — E2E 결정성).
  const fl = val(await rpc(P + "persist-flush"));
  ok(fl.ok && fl.flushed, "persist-flush 기록", fl);

  // 3) 런타임 재적재 = 이전 결함의 재현 지점.
  ok(await reloadRuntime(), "plugin.reload(id) + 새 런타임 ping");

  // 4) 복원 단언 — 이 줄이 영속 기능 이전에는 RED 였다(tables: []).
  const gs = val(await rpc(P + "get-schema", { mode: "compact" }));
  const tn = (gs.tables || []).map((t) => t.name).join(",");
  ok(/users/.test(tn) && /orders/.test(tn), `재적재 후 스키마 복원: ${tn}`, gs);
  ok((gs.relationships || []).length >= 1, `관계 복원(${(gs.relationships || []).length})`, gs);

  const gvp = val(await rpc(P + "get-viewport"));
  const v = gvp.viewport ?? {};
  ok(gvp.ok && v.zoom === 1.5 && v.x === 33 && v.y === -10, "뷰포트 복원", gvp);

  const st = val(await rpc(P + "persist-status"));
  ok(st.ok && st.restored === true && st.enabled === true, "persist-status 복원 보고(enabled)", st);

  // 5) 회수(멱등 종료) — ns 제거 후 빈 런타임 확인.
  ok(await resetAll(), "회수(ns 제거 + 재적재)");
  const cleaned = val(await rpc(P + "get-schema", { mode: "compact" }));
  ok((cleaned.tables || []).length === 0, "회수 후 빈 스키마", cleaned);

  console.log(`\n=== erd restore E2E: ${pass} pass / ${fail} fail ===`);
  sock.end();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E FAIL:", e.message);
  process.exit(1);
});
