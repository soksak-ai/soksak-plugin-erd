// soksak-plugin-erd 번들 빌드 — esbuild 단일 ESM main.js(blob-URL 로 import 됨).
// P0a: 엔트리만(워커 인라인·Tailwind·전체 앱은 P1). 단일 파일·상대/bare import 0 이 제약.
import { build, context } from "esbuild";

const opts = {
  entryPoints: ["src/plugin-entry.tsx"],
  bundle: true,
  format: "esm", // 로더가 dynamic import() 하는 ESM
  platform: "browser",
  target: "es2022",
  jsx: "automatic", // React 19 automatic runtime
  outfile: "main.js",
  minify: false, // P0a 가독(stale 검토). 발행 시 minify 전환.
  legalComments: "none",
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log("[erd] watching src → main.js …");
} else {
  await build(opts);
  console.log("[erd] built main.js");
}
