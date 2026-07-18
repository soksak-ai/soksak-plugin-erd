// C2 투명성 — 뷰의 조작 가능한 모든 DOM 컨트롤이 data-node 로 노출되고
// plugin.json contributes.nodes 선언과 정확히 일치하는지 단언한다(양방향 conformance).
// 코어 nodeScan.ts 가 Shadow DOM 을 재귀 순회해 data-node 를 ui.tree 로 노출하므로,
// 소스의 data-node 리터럴 집합이 곧 ui.tree 노드 집합이다.
//
// 대상: 툴바 컨트롤 + 캔버스 DOM 크롬(캔버스 컨테이너, 인라인 rename 입력 등 실제 DOM 요소).
// 캔버스 내부 개체(테이블/엣지)는 Pixi/WebGL 로 그려지는 비-DOM 이라 노드 노출 대상이 아니다 —
// 그 조작은 헤드리스 커맨드(create-table/select/set-position/drop-table …)로 노출된다.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Toolbar } from '@/components/toolbar/Toolbar';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(here, '../../plugin.json');
// 캔버스 DOM 크롬(컨테이너·인라인 rename 입력 등)의 data-node 는 정적 리터럴이라 소스에서 스캔한다.
// Pixi/WebGL 을 헤드리스로 렌더할 수 없어 render 대신 소스 스캔.
const canvasSource = path.resolve(here, '../components/canvas/pixi/PixiERDCanvas.tsx');

// contributes.nodes 선언 id 집합.
function declaredNodeIds(): string[] {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const nodes = manifest?.contributes?.nodes ?? [];
  return nodes.map((n: { id: string }) => n.id);
}

// 배선된 data-node base id 집합 = 툴바 렌더 HTML(계산된 data-node 포함) ∪ 캔버스 소스 리터럴.
// 인스턴스 접미(<id>/<key>) 제거 후 base id — 코어 nodeConformance 규칙(path.split('/')[0])과 동일.
function wiredBaseIds(): string[] {
  const found = new Set<string>();
  const html = renderToStaticMarkup(createElement(Toolbar));
  for (const m of html.matchAll(/data-node="([^"]+)"/g)) found.add(m[1].split('/')[0]);
  const canvas = readFileSync(canvasSource, 'utf8');
  for (const m of canvas.matchAll(/data-node="([^"{]+)"/g)) found.add(m[1].split('/')[0]);
  return [...found];
}

describe('C2 transparency — DOM nodes', () => {
  it('exposes a non-empty set of control nodes via data-node', () => {
    expect(wiredBaseIds().length).toBeGreaterThan(0);
  });

  it('declared contributes.nodes equals wired data-node base ids (bidirectional)', () => {
    const declared = new Set(declaredNodeIds());
    const wired = new Set(wiredBaseIds());
    const missing = [...declared].filter((id) => !wired.has(id)); // 선언했으나 미배선
    const orphan = [...wired].filter((id) => !declared.has(id)); // 배선했으나 미선언
    expect({ missing, orphan }).toEqual({ missing: [], orphan: [] });
  });
});
