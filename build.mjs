// soksak-plugin-erd 번들 빌드 — esbuild 단일 ESM main.js(blob-URL 로 import 됨).
// P0a: 엔트리만(워커 인라인·Tailwind·전체 앱은 P1). 단일 파일·상대/bare import 0 이 제약.
import { build, context } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const opts = {
  entryPoints: ["src/plugin-entry.tsx"],
  bundle: true,
  format: "esm", // 로더가 dynamic import() 하는 ESM
  platform: "browser",
  target: "es2022",
  jsx: "automatic", // React 19 automatic runtime
  alias: { "@": path.resolve(root, "src") }, // 앱 소스 @/* alias
  define: { "process.env.NODE_ENV": '"production"' }, // React production 빌드
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
