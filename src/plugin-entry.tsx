// soksak ERD 플러그인 엔트리 — loader 가 blob-URL 로 import 하는 단일 ESM.
// P1: 전체 abyss-erd 앱(<App/>)을 Shadow DOM 에 마운트한다. 워커는 build.mjs(Stage A)가
// IIFE 문자열로 인라인(__ERD_WORKER_*), Tailwind+allotment CSS 는 Stage B 가 __ERD_CSS__ 로 주입.
// 헤드리스 커맨드(registerCommands)는 그대로 유지 — 뷰 미오픈에도 sok/MCP/소켓 E2E 전부 동작.
import { createRoot, type Root } from "react-dom/client";
import App from "@/App";
import { useStore } from "@/store";
import { registerCommands } from "@/plugin/commands";

// container(soksak 제공 HTMLElement) 별 마운트 상태. Shadow DOM 격리로 Tailwind preflight 전역
// 리셋이 soksak chrome 을 깨지 않는다. unmount 시 root.unmount() → Pixi destroy·worker.terminate
// effect cleanup 이 자동 연쇄(WebGL loseContext 포함).
interface MountState {
  root: Root;
  shadow: ShadowRoot;
}
const mounts = new WeakMap<HTMLElement, MountState>();

function mountApp(container: HTMLElement) {
  // 이미 마운트됐다면(중복 mount 호출 방어) 먼저 회수.
  unmountApp(container);

  // Shadow DOM 격리 — Tailwind preflight(*, html, body 리셋)이 shadow 경계를 넘지 않는다.
  const shadow = container.attachShadow({ mode: "open" });

  // 컴파일된 CSS(Tailwind + allotment)를 shadow 안 <style> 로 삽입.
  const style = document.createElement("style");
  style.textContent = __ERD_CSS__;
  shadow.appendChild(style);

  // React 루트 host — App 의 portalRoot(Radix 포털 컨테이너 + 다크모드 class 미러 타깃)이기도 하다.
  const host = document.createElement("div");
  host.style.width = "100%";
  host.style.height = "100%";
  // 다크 기본값 — App 의 theme effect 가 portalRoot 에 light/dark 를 즉시 미러하지만,
  // 첫 페인트 깜빡임 방지로 dark 를 선반영(store 기본 theme='dark').
  host.classList.add("dark");
  shadow.appendChild(host);

  const root = createRoot(host);
  root.render(<App portalRoot={host} />);
  mounts.set(container, { root, shadow });
}

function unmountApp(container: HTMLElement) {
  const state = mounts.get(container);
  if (!state) return;
  // root.unmount() → 모든 effect cleanup 연쇄: Pixi app.destroy(true) + WEBGL_lose_context,
  // edge/layout/import/mwb 워커 terminate. Shadow DOM 노드도 함께 제거.
  state.root.unmount();
  // attachShadow 는 되돌릴 수 없으나, 내부 노드는 unmount 로 정리됨. host/style 참조 해제.
  mounts.delete(container);
}

export default {
  activate(ctx: any) {
    const app = ctx.app;

    // 뷰 등록 — content 탭에 <App/> 전체 마운트(placement 무관 동일 트리).
    ctx.subscriptions.push(
      app.ui.registerView("canvas", {
        mount(container: HTMLElement) {
          mountApp(container);
        },
        unmount(container: HTMLElement) {
          unmountApp(container);
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
            version: "0.0.1",
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
