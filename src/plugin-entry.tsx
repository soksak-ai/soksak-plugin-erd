// soksak ERD 플러그인 엔트리 — loader 가 blob-URL 로 import 하는 단일 ESM.
// P0a: 번들 파이프라인(esbuild + React-in-blob + registerView + 커맨드)이 soksak 에서 적재되는지 검증.
// 전체 abyss-erd 앱 마운트·워커 인라인·Tailwind Shadow DOM 은 P1.
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "@/store";
import { registerCommands } from "@/plugin/commands";

// 뷰는 container(soksak 제공 HTMLElement)에 마운트. placement(content/sidebar) 무관 동일 provider.
const roots = new WeakMap<HTMLElement, Root>();

export default {
  activate(ctx: any) {
    const app = ctx.app;

    // 뷰 등록 — content 탭에 마운트(P0a 는 적재 확인용 최소 트리).
    ctx.subscriptions.push(
      app.ui.registerView("canvas", {
        mount(container: HTMLElement) {
          const root = createRoot(container);
          root.render(
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--fg, #ddd)",
                background: "var(--bg, #1e1e1e)",
                fontFamily: "system-ui, sans-serif",
                fontSize: 14,
              }}
            >
              ERD plugin loaded ✓ — P0a 번들 마운트(React-in-blob)
            </div>,
          );
          roots.set(container, root);
        },
        unmount(container: HTMLElement) {
          const r = roots.get(container);
          if (r) {
            r.unmount();
            roots.delete(container);
          }
        },
      }),
    );

    // E2E/적재 확인용 헤드리스 커맨드 — sok plugin.soksak-plugin-erd.ping / MCP / 소켓.
    if (app.commands?.register) {
      ctx.subscriptions.push(
        app.commands.register("ping", {
          description: "플러그인 적재/버전 확인(E2E)",
          handler: async () => ({
            ok: true,
            plugin: "soksak-plugin-erd",
            version: "0.1.0",
            phase: "P2",
          }),
        }),
      );
    }

    // 헤드리스 커맨드 카탈로그(introspection/mutation/batch/layout) 등록 — store(useStore)를 주입.
    // 뷰 미오픈에도 sok plugin.soksak-plugin-erd.* / MCP / 소켓 E2E 로 전부 동작.
    registerCommands(ctx, useStore as unknown as Parameters<typeof registerCommands>[1]);
  },
  deactivate() {},
};
