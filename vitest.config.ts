import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

// 헤드리스 피처(dialect·mig DSL·converters·commands) 단위테스트 — node 환경(DOM/Pixi 무관).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(root, "./src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
