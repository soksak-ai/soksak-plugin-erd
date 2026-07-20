import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, ShieldCheck, EyeOff, Scissors } from 'lucide-react';

// 순수 표현 컴포넌트 — 상태는 props/콜백으로만 흐른다. 실제 명령 호출(query-run 등)은 배선 층이 한다.
// BottomPanel 의 새 탭 'query' 내용물로 삽입된다(plan §6-P4).
//
// 마스킹 계약: query-run 은 민감 컬럼을 사이드카에서 마스킹한 뒤 결과를 내보낸다(plugin.json query-run
// description). 따라서 masked 컬럼의 평문은 애초에 클라이언트에 도달하지 않는다. 그리드는 masked 컬럼
// 셀을 '●●●●' 로 렌더하고 select-none 을 준다 — 네이티브 선택 복사는 평문(비마스킹) 컬럼만 담는다.

export type QueryCell = string | number | boolean | null;

export interface QueryColumn {
  name: string;
  // 사이드카가 마스킹한 민감 컬럼. 셀은 '●●●●' 로 렌더되고 복사 대상에서 빠진다.
  masked?: boolean;
}

export interface QueryResult {
  columns: QueryColumn[];
  rows: QueryCell[][];
  // rowLimit 에 걸려 잘렸는가. 잘렸다면 chip + [더 불러오기] 를 노출한다.
  truncated?: boolean;
  // 잘림 chip 문구용 — 반환된 행 수(예: '1,000행에서 잘림'). 없으면 rows.length 로 대체.
  rowLimit?: number;
}

export interface QueryProfileInfo {
  id: string;
  name: string;
  dialect: 'sqlite' | 'mysql' | 'postgresql';
  readOnly?: boolean;
}

export interface QueryPanelProps {
  // SQL 실행 요청 — 배선 층이 query-run 서비스 op 를 호출한다.
  onRun(sql: string): void;
  // 잘린 결과의 다음 페이지 요청(선택). 없으면 [더 불러오기] 는 숨는다.
  onLoadMore?(): void;
  // 마지막 실행 결과(없으면 빈 상태).
  result?: QueryResult | null;
  // 현재 대상 프로필(없으면 '프로필 없음').
  profile?: QueryProfileInfo | null;
  // 실행 진행 중 표시(버튼 비활성).
  running?: boolean;
}

const DIALECT_LABEL: Record<QueryProfileInfo['dialect'], string> = {
  sqlite: 'SQLite',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
};

const MASK_GLYPH = '●●●●'; // ●●●●

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

function renderCell(value: QueryCell): { text: string; muted: boolean } {
  if (value === null) return { text: 'NULL', muted: true };
  if (typeof value === 'boolean') return { text: value ? 'true' : 'false', muted: false };
  return { text: String(value), muted: false };
}

export function QueryPanel({ onRun, onLoadMore, result, profile, running }: QueryPanelProps) {
  const [sql, setSql] = useState('');

  const run = useCallback(() => {
    const text = sql.trim();
    if (!text || running) return;
    onRun(text);
  }, [sql, running, onRun]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.nativeEvent as KeyboardEvent).isComposing) return;
      // ⌘↵ / Ctrl↵ — 실행.
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        run();
      }
    },
    [run],
  );

  const dialectLabel = profile ? DIALECT_LABEL[profile.dialect] : null;

  return (
    <div className="flex h-full flex-col">
      {/* ── SQL 에디터 ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-gray-200 dark:border-zinc-800 p-2">
        <div className="flex items-center gap-2">
          {profile ? (
            <Badge
              variant="secondary"
              className="font-mono text-[11px]"
              title={`${profile.name} · ${dialectLabel}`}
            >
              {profile.name}
            </Badge>
          ) : (
            <span className="text-xs text-gray-400 dark:text-zinc-600">프로필 없음</span>
          )}
          {dialectLabel && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-600">
              {dialectLabel}
            </span>
          )}
          {profile?.readOnly && (
            // read-only 실드 — 이 프로필로는 쓰기가 차단된다(SELECT 만).
            <Badge
              variant="outline"
              className="gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
              title="읽기 전용 프로필 — SELECT 만 실행됩니다"
            >
              <ShieldCheck className="size-3" />
              읽기 전용
            </Badge>
          )}
          <div className="ml-auto">
            <Button
              data-node="query-run"
              size="xs"
              onClick={run}
              disabled={!sql.trim() || running}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Play className="size-3" />
              실행
              <kbd className="ml-0.5 rounded bg-white/20 px-1 text-[10px] font-medium">⌘↵</kbd>
            </Button>
          </div>
        </div>
        <textarea
          data-node="query-editor"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder={profile?.readOnly ? 'SELECT … (읽기 전용)' : 'SELECT * FROM …'}
          className={cn(
            'min-h-20 w-full resize-y rounded-md border border-gray-200 dark:border-zinc-700',
            'bg-gray-50 dark:bg-zinc-950 px-3 py-2 font-mono text-sm',
            'text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600',
            'outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/40',
          )}
        />
      </div>

      {/* ── 결과 그리드 ─────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {!result ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-gray-400 dark:text-zinc-600">
            SQL 을 실행하면 결과가 여기에 표시됩니다.
          </div>
        ) : result.columns.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-gray-400 dark:text-zinc-600">
            반환된 컬럼이 없습니다.
          </div>
        ) : (
          <ResultGrid result={result} onLoadMore={onLoadMore} />
        )}
      </div>
    </div>
  );
}

function ResultGrid({
  result,
  onLoadMore,
}: {
  result: QueryResult;
  onLoadMore?: QueryPanelProps['onLoadMore'];
}) {
  const { columns, rows, truncated } = result;
  const returned = result.rowLimit ?? rows.length;

  return (
    <div className="flex h-full flex-col">
      <div data-node="query-result-grid" className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left font-mono text-xs">
          <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-zinc-800">
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={`${col.name}-${ci}`}
                  className="whitespace-nowrap border-b border-gray-200 dark:border-zinc-700 px-3 py-1.5 font-semibold text-gray-600 dark:text-zinc-300"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.name}
                    {col.masked && (
                      <EyeOff
                        // 각 마스킹 컬럼 헤더의 아이콘. 주소 그램마 준수 슬러그(컬럼명 소문자화·비허용문자 '-').
                        data-node={`query-mask-icon/${col.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`}
                        className="size-3 text-amber-500"
                        aria-label={`${col.name} 마스킹됨`}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="even:bg-gray-50 dark:even:bg-zinc-900/50">
                {columns.map((col, ci) => {
                  if (col.masked) {
                    return (
                      <td
                        key={ci}
                        // select-none 으로 마스킹 셀은 네이티브 복사 선택에서 빠진다(복사시도 평문만).
                        className="select-none whitespace-nowrap px-3 py-1 text-amber-500/70"
                      >
                        {MASK_GLYPH}
                      </td>
                    );
                  }
                  const { text, muted } = renderCell(row[ci]);
                  return (
                    <td
                      key={ci}
                      className={cn(
                        'whitespace-nowrap px-3 py-1',
                        muted
                          ? 'italic text-gray-400 dark:text-zinc-600'
                          : 'text-gray-700 dark:text-zinc-300',
                      )}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center text-gray-400 dark:text-zinc-600"
                >
                  0 행
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 잘림 chip + 더 불러오기 */}
      {truncated && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 px-3 py-1.5">
          <Badge
            variant="outline"
            className="gap-1 text-[11px] text-amber-600 dark:text-amber-400 border-amber-500/40"
          >
            <Scissors className="size-3" />
            {formatCount(returned)}행에서 잘림
          </Badge>
          {onLoadMore && (
            <Button
              data-node="query-load-more"
              size="xs"
              variant="outline"
              onClick={onLoadMore}
              className="text-xs"
            >
              더 불러오기
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
