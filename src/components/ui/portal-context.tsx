// R6 — Radix 포털 컨테이너 컨텍스트.
// Radix(dialog/dropdown/select/popover/tooltip/context-menu)는 기본 document.body 로
// 포털한다 → Shadow DOM 밖으로 탈출해 Tailwind 스타일이 적용되지 않는다.
// App 이 portalRoot(=Shadow DOM 안 host)를 이 컨텍스트로 내려주고, 각 ui Portal 래퍼가
// container={usePortalRoot()} 를 지정해 Shadow DOM 안에 머물게 한다.
import { createContext, useContext } from "react";

// null = 컨테이너 미지정(Radix 기본 document.body). 일반 웹(main.tsx)에서는 Shadow DOM 이
// 없으므로 null 이 올바른 동작이다 — 번들 플러그인(plugin-entry)에서만 host 를 주입한다.
const PortalRootContext = createContext<HTMLElement | null>(null);

export function PortalRootProvider({
  value,
  children,
}: {
  value: HTMLElement | null;
  children: React.ReactNode;
}) {
  return (
    <PortalRootContext.Provider value={value}>
      {children}
    </PortalRootContext.Provider>
  );
}

// Radix *Portal/Content 의 container prop 에 그대로 넘긴다.
// undefined 를 주면 Radix 가 기본(document.body)을 쓰므로, null 일 때는 undefined 로 변환.
export function usePortalRoot(): HTMLElement | undefined {
  return useContext(PortalRootContext) ?? undefined;
}
