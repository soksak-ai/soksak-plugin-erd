import { parseCreateTables } from '@/features/sql/sql-parser';
import { parseMermaid } from '@/features/mermaid/mermaid-parser';

export type ImportWorkerRequest =
  | { type: 'parseSQL'; payload: { sql: string } }
  | { type: 'parseMermaid'; payload: { text: string } };

export type ImportWorkerResponse =
  | { type: 'parseResult'; schema: ReturnType<typeof parseCreateTables> }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<ImportWorkerRequest>) => {
  const { type, payload } = e.data;

  try {
    if (type === 'parseSQL') {
      const schema = parseCreateTables(payload.sql);
      self.postMessage({ type: 'parseResult', schema } satisfies ImportWorkerResponse);
    } else if (type === 'parseMermaid') {
      const schema = parseMermaid(payload.text);
      self.postMessage({ type: 'parseResult', schema } satisfies ImportWorkerResponse);
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown parsing error',
    } satisfies ImportWorkerResponse);
  }
};
