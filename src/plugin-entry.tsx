// soksak ERD 플러그인 엔트리 — loader 가 blob-URL 로 import 하는 단일 ESM.
// P1: 전체 abyss-erd 앱(<App/>)을 Shadow DOM 에 마운트한다. 워커는 build.mjs(Stage A)가
// IIFE 문자열로 인라인(__ERD_WORKER_*), Tailwind+allotment CSS 는 Stage B 가 __ERD_CSS__ 로 주입.
// 헤드리스 커맨드(registerCommands)는 그대로 유지 — 뷰 미오픈에도 sok/MCP/소켓 E2E 전부 동작.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/App";
import { useStore } from "@/store";
import { registerCommands } from "@/plugin/commands";

// 렌더 크래시(예: Pixi WebGL 컨텍스트 한계, 컴포넌트 예외)를 잡아 빈 화면 대신 오류를 표시.
// console.error 로 원인도 남긴다(소켓/dev 진단).
class ErrBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[erd] App 렌더 오류:", err, info.componentStack);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 16, color: "#f88", fontFamily: "system-ui", fontSize: 13 }}>
          ERD 렌더 오류: {this.state.err.message || String(this.state.err)}
        </div>
      );
    }
    return this.props.children;
  }
}

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
  // attachShadow 는 요소당 1회만 가능(리로드/재마운트 시 같은 container 재사용 → 기존 것 재사용).
  const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });
  shadow.replaceChildren(); // 재마운트 시 이전 style/host 잔여 제거

  // 컴파일된 CSS(Tailwind + allotment)를 shadow 안 <style> 로 삽입.
  const style = document.createElement("style");
  style.textContent = __ERD_CSS__;
  shadow.appendChild(style);

  // React 루트 host — width/height 100% 로 컨테이너를 채운다. soksak 코어가 mount 컨테이너
  // (.plugin-view-container)를 definite 픽셀 박스로 보장(host absolute inset:0)하므로 100% 가
  // 풀린다 → App 의 h-full/allotment 가 전체를 채운다. (예전엔 컨테이너가 indefinite 라 flex/
  // h-screen 우회가 필요했음 — 코어 host 수정으로 정공법 100% 가능.)
  // App 의 portalRoot(Radix 포털 컨테이너 + 다크모드 class 미러 타깃)이기도 하다.
  const host = document.createElement("div");
  host.style.width = "100%";
  host.style.height = "100%";
  host.style.overflow = "hidden";
  // 다크 기본값 — App 의 theme effect 가 portalRoot 에 light/dark 를 즉시 미러하지만,
  // 첫 페인트 깜빡임 방지로 dark 를 선반영(store 기본 theme='dark').
  host.classList.add("dark");
  shadow.appendChild(host);

  const root = createRoot(host);
  root.render(
    <ErrBoundary>
      <App portalRoot={host} />
    </ErrBoundary>,
  );
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
