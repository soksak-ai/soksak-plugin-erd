// soksak-plugin-db-studio 번들 빌드 — esbuild 단일 ESM main.js(blob-URL 로 import 됨).
// 단일 파일·상대/bare import 0 이 제약. P1 부터 3단계:
//   Stage A: 워커 4개를 각각 IIFE standalone 번들 → 문자열(__ERD_WORKER_*)
//   Stage B: Tailwind(index.css) 컴파일 + allotment 스타일 → 문자열(__ERD_CSS__)
//   Stage C: 메인 엔트리(plugin-entry.tsx) 번들 — A/B 문자열을 esbuild define 으로 주입
import { build, context } from "esbuild";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(root, "src");

// ── Stage A: 워커 IIFE 번들 ──────────────────────────────────────────
// 각 워커를 format:'iife'·bundle·alias @→src 로 standalone 번들해 문자열로 받는다.
// 번들 플러그인은 단일 blob ESM 이라 `new Worker(new URL('@/...', import.meta.url))` 가
// 깨진다 → 이 문자열을 inline-worker.blobWorker 가 classic blob worker 로 생성한다.
const WORKERS = {
  __ERD_WORKER_EDGE__: "src/workers/edge-render.worker.ts",
  __ERD_WORKER_LAYOUT__: "src/workers/layout.worker.ts",
  __ERD_WORKER_MWB__: "src/workers/mwb.worker.ts",
  __ERD_WORKER_IMPORT__: "src/workers/import.worker.ts",
};

async function bundleWorker(entry) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife", // classic worker(blob)에서 동작
    platform: "browser",
    target: "es2022",
    alias: { "@": SRC },
    define: { "process.env.NODE_ENV": '"production"', "import.meta.env.DEV": "false" },
    minify: true, // 워커는 검토 대상 아님 — 크기 우선
    legalComments: "none",
    write: false, // 디스크 대신 메모리 문자열
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

async function buildWorkerDefines() {
  const defines = {};
  for (const [name, entry] of Object.entries(WORKERS)) {
    const code = await bundleWorker(entry);
    defines[name] = JSON.stringify(code); // define 값은 JSON 직렬화된 문자열 리터럴
  }
  return defines;
}

// ── Stage B: CSS 컴파일(Tailwind + allotment) ───────────────────────
// @tailwindcss/cli 로 index.css → 컴파일(preflight·유틸·다크 variant 포함). allotment 스타일은
// Tailwind 와 무관(@import 안 함)하므로 별도 읽어 prepend. 합친 문자열을 __ERD_CSS__ 로 주입,
// plugin-entry 가 Shadow DOM <style> 로 격리 삽입한다.
async function buildCssDefine() {
  const twBin = path.resolve(root, "node_modules/.bin/tailwindcss");
  const { stdout } = await execFileP(
    twBin,
    ["-i", "src/index.css", "--minify"], // -o 생략 → stdout 출력
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );
  const allotmentCss = await readFile(
    path.resolve(root, "node_modules/allotment/dist/style.css"),
    "utf8",
  );
  // allotment 먼저(레이아웃 기반) → Tailwind 유틸 뒤(필요 시 override 우선).
  const css = `${allotmentCss}\n${stdout}`;
  return { __ERD_CSS__: JSON.stringify(css) };
}

// ── Stage C: 메인 엔트리 번들 ────────────────────────────────────────
async function buildMain(extraDefines) {
  const opts = {
    entryPoints: ["src/plugin-entry.tsx"],
    bundle: true,
    format: "esm", // 로더가 dynamic import() 하는 ESM
    platform: "browser",
    target: "es2022",
    jsx: "automatic", // React 19 automatic runtime
    alias: { "@": SRC }, // 앱 소스 @/* alias
    define: {
      "process.env.NODE_ENV": '"production"', // React production 빌드
      "import.meta.env.DEV": "false", // 앱 코드의 DEV 가드 → false(esbuild 는 기본 미정의)
      ...extraDefines, // __ERD_WORKER_*, __ERD_CSS__
    },
    outfile: "main.js",
    minify: false, // 가독(stale 검토). 발행 시 minify 전환.
    legalComments: "none",
    logLevel: "info",
  };

  if (process.argv.includes("--watch")) {
    // watch 는 메인만 — 워커/CSS 는 변경 빈도 낮음(필요 시 재실행).
    const ctx = await context(opts);
    await ctx.watch();
    console.log("[erd] watching src → main.js …");
  } else {
    await build(opts);
    console.log("[erd] built main.js");
  }
}

// ── Gate 동기화: 정본=플러그인 src/features/db/gate, 사본=사이드카 gate/ ─────
// masking/write 게이트 규칙(rules.json)과 그 오라클(cases.json)의 단일진실은 플러그인이다.
// 사이드카는 빌드 시점의 사본만 싣는다 — 수기 복제(드리프트) 금지. 사이드카는 형제 규약으로
// 발견한다: plugins/<id> ↔ sidecars/soksak-sidecar-db-studio (심링크 없음, 선언적 해석).
async function syncGateToSidecar() {
  const srcDir = path.resolve(SRC, "features/db/gate");
  const destDir = path.resolve(root, "../../sidecars/soksak-sidecar-db-studio/gate");
  await mkdir(destDir, { recursive: true }); // 멱등
  for (const file of ["rules.json", "cases.json"]) {
    await copyFile(path.join(srcDir, file), path.join(destDir, file)); // 덮어쓰기 = 멱등
  }
  console.log(`[erd] gate synced → ${destDir}`);
}

// ── 파이프라인 실행 ──────────────────────────────────────────────────
const [workerDefines, cssDefine] = await Promise.all([
  buildWorkerDefines(),
  buildCssDefine(),
  syncGateToSidecar(),
]);
// 버전 리터럴의 단일진실은 plugin.json — 엔트리에는 __ERD_VERSION__ 으로 주입.
const manifest = JSON.parse(await readFile(path.resolve(root, "plugin.json"), "utf8"));
await buildMain({
  ...workerDefines,
  ...cssDefine,
  __ERD_VERSION__: JSON.stringify(manifest.version),
});
