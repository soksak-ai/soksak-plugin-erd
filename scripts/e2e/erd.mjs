#!/usr/bin/env node
// soksak-plugin-erd E2E — 헤드리스 커맨드 시나리오 드라이버(UI 없이 전수).
// soksak 소켓(SOKSAK_SOCKET JSON-RPC)에 붙어 plugin.soksak-plugin-erd.* 로 구동 +
// introspection(get-schema/validate)으로 결정적 단언. claude 의존 0. 종료코드 0=PASS.
//   사용: SOKSAK_SOCKET=~/.soksak/com.soksak.dev.sock node scripts/e2e/erd.mjs
import net from "node:net";
import os from "node:os";
import path from "node:path";

const SOCKET =
  process.env.SOKSAK_SOCKET ||
  path.join(os.homedir(), ".soksak", "com.soksak.dev.sock");
const P = "plugin.soksak-plugin-erd.";

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
const val = (m) => m.result ?? m;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0,
  fail = 0;
const ok = (cond, msg, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "✓" : "✗"} ${msg}${detail && !cond ? " → " + JSON.stringify(detail).slice(0, 200) : ""}`);
};

async function reset() {
  // 멱등: 이전 잔여를 새 빈 문서로(현재는 undo 반복 — new 커맨드 추가 시 교체).
  for (let i = 0; i < 8; i++) await rpc(P + "undo").catch(() => {});
}

async function main() {
  await connect();
  await rpc("plugin.reload"); // 최신 main.js 적재
  await sleep(800);
  await reset();

  // 1) 한 콜로 전체 스키마 구축(apply 배치, atomic).
  const built = val(
    await rpc(P + "apply", {
      title: "shop",
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
      ],
    }),
  );
  ok(built.ok, "apply 배치(users+orders+관계+autoFk)", built);

  // 2) introspection 동치.
  const gs = val(await rpc(P + "get-schema", { mode: "compact" }));
  const tn = (gs.tables || []).map((t) => t.name).join(",");
  ok(/users/.test(tn) && /orders/.test(tn) && (gs.relationships || []).length >= 1, `get-schema: ${tn} / 관계 ${(gs.relationships || []).length}`, gs);

  // 3) autoFk 컬럼.
  const oc = val(await rpc(P + "get-columns", { table: "orders" }));
  const cols = (oc.columns || []).map((c) => c.name).join(",");
  ok(/users_id|user_id/.test(cols), `autoFk 컬럼(orders: ${cols})`, oc);

  // 4) 검증 무에러.
  const va = val(await rpc(P + "validate"));
  const errs = (va.issues || va.errors || []).filter((e) => e.level === "error");
  ok(va.ok && errs.length === 0, "validate 무에러", va);

  // 5) undo/redo.
  const u = val(await rpc(P + "undo"));
  ok(u.ok !== false, "undo", u);

  console.log(`\n=== erd E2E: ${pass} pass / ${fail} fail ===`);
  sock.end();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E FAIL:", e.message);
  process.exit(1);
});
