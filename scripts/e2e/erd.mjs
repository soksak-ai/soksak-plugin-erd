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
// 소켓 응답 봉투 = { id, ok, code, message, data, window }. 명령 결과 payload 는 data 아래에 있고
// ok/code 는 최상위다. 둘을 평탄 병합해 val(m).ok·val(m).tables·val(m).values 모두 접근되게 한다.
const val = (m) => ({ ...m, ...(m.result || {}), ...(m.data || {}) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0,
  fail = 0;
const ok = (cond, msg, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "✓" : "✗"} ${msg}${detail && !cond ? " → " + JSON.stringify(detail).slice(0, 200) : ""}`);
};

async function reset() {
  // 멱등: 이전(영속 복원 포함) 스키마를 실제로 비운다 — 존재 테이블 전부 드롭.
  const lt = val(await rpc(P + "list-tables"));
  for (const t of lt.tables || []) {
    await rpc(P + "drop-table", { table: t.id ?? t.name }).catch(() => {});
  }
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

  // 6) 표기법(notation) — 명령 설정 + prefs 상태면 반영.
  ok(val(await rpc(P + "set-notation", { style: "numeric" })).ok, "set-notation numeric");
  let ps = val(await rpc(P + "prefs-status"));
  ok(ps.values?.notationStyle === "numeric", `prefs-status.values.notationStyle=numeric`, ps.values);
  ok(val(await rpc(P + "set-notation", { bad: 1 })).ok === false, "set-notation 잘못된 값 거부");

  // 7) 표기법 prefs 영속 왕복 — flush → plugin.reload(빈 store) → 복원.
  ok(val(await rpc(P + "prefs-flush")).ok, "prefs-flush");
  await rpc("plugin.reload");
  await sleep(800);
  ps = val(await rpc(P + "prefs-status"));
  ok(ps.values?.notationStyle === "numeric", "재적재 후 notationStyle 복원=numeric", ps.values);

  // 8) 행 강조(hover-row) — 설정/범위가드/해제.
  // 스키마는 reload 로 kv 에서 복원됨(users/orders). 없으면 재구축.
  if (!(val(await rpc(P + "list-tables")).tables || []).some((t) => t.name === "orders")) {
    await rpc(P + "apply", { title: "shop", ops: [
      { command: "create-table", params: { name: "orders", columns: [{ name: "id", dataType: "INT", isPrimaryKey: true }] } },
    ] });
  }
  ok(val(await rpc(P + "hover-row", { table: "orders", index: 0 })).ok, "hover-row orders[0]");
  ok(val(await rpc(P + "hover-row", { table: "orders", index: 99 })).ok === false, "hover-row 범위밖 거부");
  ok(val(await rpc(P + "hover-row", {})).cleared === true, "hover-row 해제");

  // 9) 테이블 색 — 설정/조회/해제.
  ok(val(await rpc(P + "set-color", { table: "orders", color: "#3b82f6" })).ok, "set-color orders");
  ok(val(await rpc(P + "get-table", { table: "orders" })).table?.color === "#3b82f6", "get-table color=#3b82f6");
  await rpc(P + "set-color", { table: "orders" }); // 해제

  // 10) 스냅샷 — 두 표기법 모두 고정 경로로 캡처(시각 리뷰 아티팩트). 창 없으면 스킵.
  const dir = process.env.SNAP_DIR || `${process.env.HOME}/.soksak-e2e`;
  await rpc(P + "set-notation", { style: "numeric" });
  await captureSnapshot(`${dir}/erd-notation-numeric.png`);
  await rpc(P + "set-notation", { style: "crowsfoot" });
  await captureSnapshot(`${dir}/erd-notation-crowsfoot.png`);

  // 멱등 복원 — 표기법 기본값(crowsfoot) 영속.
  await rpc(P + "prefs-flush").catch(() => {});

  console.log(`\n=== erd E2E: ${pass} pass / ${fail} fail ===`);
  sock.end();
  process.exit(fail ? 1 : 0);
}

// erd 뷰가 마운트된 창을 찾아 활성화 후 window.snapshot 을 고정 경로로 저장한다. 헤드리스/무창
// 환경에서는 조용히 스킵(단언 아님 — 시각 리뷰용 아티팩트). 경로는 SNAP 환경변수 또는 기본 고정 경로.
async function captureSnapshot(out) {
  try {
    const labels = val(await rpc("window.list")).labels || [];
    for (const label of labels) {
      await rpc("window.focus", { label }).catch(() => {});
      const views = val(await rpc("view.list")).views || [];
      const erd = views.find((v) => v.plugin === "soksak-plugin-erd");
      if (!erd) continue;
      await rpc("view.activate", { view: erd.id }).catch(() => {});
      await rpc("window.focus", { label }).catch(() => {});
      await rpc(P + "auto-layout").catch(() => {});
      await sleep(250);
      await rpc(P + "fit").catch(() => {});
      await sleep(400);
      const snap = val(await rpc("window.snapshot", { path: out }));
      console.log(`  ▶ snapshot: ${snap.saved || out} (window ${label})`);
      return;
    }
    console.log(`  ▶ snapshot(${out}): erd 뷰가 열린 창 없음 — 스킵`);
  } catch (e) {
    console.log(`  ▶ snapshot(${out}): 스킵(${e.message})`);
  }
}

main().catch((e) => {
  console.error("E2E FAIL:", e.message);
  process.exit(1);
});
