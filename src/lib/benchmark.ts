// Performance benchmark suite for ERD Studio
// Run in browser console: window.benchmark.run()

import { useStore } from '@/store';
import { generateId } from '@/lib/id';
import type { Table, Column, Relationship } from '@/types/schema';

function createTestColumn(name: string, overrides?: Partial<Column>): Column {
  return {
    id: generateId(),
    name,
    dataType: 'VARCHAR',
    nullable: true,
    autoIncrement: false,
    isPrimaryKey: false,
    isUnique: false,
    ...overrides,
  };
}

function createTestTable(name: string, columnCount: number): Table {
  const columns: Column[] = [
    createTestColumn('id', { dataType: 'BIGINT', isPrimaryKey: true, autoIncrement: true, nullable: false }),
  ];
  for (let i = 1; i < columnCount; i++) {
    columns.push(createTestColumn(`col_${i}`, { dataType: i % 3 === 0 ? 'INT' : i % 3 === 1 ? 'VARCHAR' : 'TIMESTAMP' }));
  }
  return {
    id: generateId(),
    name,
    columns,
    indexes: [],
  };
}

function generateTestSchema(tableCount: number, avgColumns: number, fkRatio: number) {
  const tables: Record<string, Table> = {};
  const relationships: Record<string, Relationship> = {};
  const tableList: Table[] = [];

  for (let i = 0; i < tableCount; i++) {
    const prefix = ['user', 'order', 'product', 'payment', 'inventory', 'shipping', 'auth', 'notification', 'analytics', 'config'][i % 10];
    const table = createTestTable(`${prefix}_table_${i}`, avgColumns);
    tables[table.id] = table;
    tableList.push(table);
  }

  // Create FK relationships
  const relCount = Math.floor(tableCount * fkRatio);
  for (let i = 0; i < relCount && i < tableList.length - 1; i++) {
    const source = tableList[i + 1];
    const target = tableList[i % (i + 1)]; // point to earlier table
    const fkCol = createTestColumn(`${target.name}_id`, { dataType: 'BIGINT' });
    source.columns.push(fkCol);

    const relId = generateId();
    relationships[relId] = {
      id: relId,
      sourceTableId: source.id,
      targetTableId: target.id,
      type: '1:N',
      sourceColumnIds: [fkCol.id],
      targetColumnIds: [target.columns[0].id],
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    };
  }

  return { tables, relationships };
}

async function measure(_label: string, fn: () => void | Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  const duration = performance.now() - start;
  return duration;
}

function waitForFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let frames = 0;
    function tick() {
      frames++;
      if (frames >= count) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

export const benchmark = {
  async run(tableCount = 500, avgColumns = 10) {
    const results: Record<string, string> = {};
    const store = useStore.getState();

    console.log(`%c=== ERD Benchmark: ${tableCount} tables x ${avgColumns} cols ===`, 'color: #3b82f6; font-weight: bold; font-size: 16px');

    // 1. Generate test data
    let schema: ReturnType<typeof generateTestSchema>;
    const genTime = await measure('1. Generate test data', () => {
      schema = generateTestSchema(tableCount, avgColumns, 0.8);
    });
    results['1. Generate data'] = `${genTime.toFixed(0)}ms`;

    // 2. Load into store (simulates import)
    store.clearSchema();
    const loadTime = await measure('2. Load into store', () => {
      store.loadSchema(schema!.tables, schema!.relationships);
    });
    results['2. Store load'] = `${loadTime.toFixed(0)}ms`;

    // 3. Wait for React to render
    const renderTime = await measure('3. Initial render', async () => {
      await waitForFrames(10);
    });
    results['3. Initial render'] = `${renderTime.toFixed(0)}ms`;

    // 4. Trigger auto layout
    const layoutStart = performance.now();
    store.triggerAutoLayout();
    // Wait for worker to complete + render
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        // Check if nodes have positions (layout done)
        const positions = useStore.getState().nodePositions;
        if (Object.keys(positions).length >= tableCount * 0.5) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      // Timeout after 30s
      setTimeout(() => { clearInterval(check); resolve(); }, 30000);
    });
    await waitForFrames(10);
    const layoutTime = performance.now() - layoutStart;
    results['4. Auto layout'] = `${layoutTime.toFixed(0)}ms`;

    // 5. Measure zoom/pan FPS
    const fpsFrames: number[] = [];
    const fpsDuration = 2000;
    const fpsStart = performance.now();
    while (performance.now() - fpsStart < fpsDuration) {
      const frameStart = performance.now();
      await waitForFrames(1);
      fpsFrames.push(performance.now() - frameStart);
    }
    const avgFPS = Math.round(1000 / (fpsFrames.reduce((a, b) => a + b, 0) / fpsFrames.length));
    results['5. Idle FPS'] = `${avgFPS} fps`;

    // 6. Memory
    if ('memory' in performance) {
      const mem = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      results['6. Memory'] = `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(0)}MB`;
    }

    // Report
    console.log('%c=== Results ===', 'color: #10b981; font-weight: bold; font-size: 14px');
    console.table(results);

    // Pass/Fail criteria
    console.log('%c=== Pass/Fail ===', 'color: #f59e0b; font-weight: bold');
    const criteria = [
      { label: 'Store load < 100ms', pass: +loadTime < 100 },
      { label: 'Auto layout < 5000ms', pass: +layoutTime < 5000 },
      { label: 'FPS > 30', pass: avgFPS > 30 },
    ];
    for (const c of criteria) {
      console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}`);
    }

    return results;
  },

  // Quick smoke test
  async smoke() {
    return this.run(50, 8);
  },

  // Stress test
  async stress() {
    return this.run(1000, 15);
  },
};

// Expose to window
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).benchmark = benchmark;
}
