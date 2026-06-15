import type { ERDSchema } from '@/types/schema';

export function generateMermaid(schema: ERDSchema): string {
  const lines: string[] = ['erDiagram'];

  // Build a set of FK column IDs for annotation
  const fkColumnIds = new Set<string>();
  for (const rel of Object.values(schema.relationships)) {
    for (const id of rel.sourceColumnIds) fkColumnIds.add(id);
    for (const id of rel.targetColumnIds) fkColumnIds.add(id);
  }

  for (const table of Object.values(schema.tables)) {
    lines.push(`    ${table.name} {`);
    for (const col of table.columns) {
      const typeName = col.dataType.replace(/\(.*\)/, '');
      let line = `        ${typeName} ${col.name}`;
      const flags: string[] = [];
      if (col.isPrimaryKey) flags.push('PK');
      if (fkColumnIds.has(col.id) && !col.isPrimaryKey) flags.push('FK');
      if (col.isUnique && !col.isPrimaryKey) flags.push('UK');
      if (!col.nullable && !col.isPrimaryKey) flags.push('"NOT NULL"');
      if (flags.length > 0) line += ' ' + flags.join(' ');
      lines.push(line);
    }
    lines.push('    }');
  }

  for (const rel of Object.values(schema.relationships)) {
    const source = schema.tables[rel.sourceTableId];
    const target = schema.tables[rel.targetTableId];
    if (!source || !target) continue;

    let arrow = '';
    switch (rel.type) {
      case '1:1': arrow = '||--||'; break;
      case '1:N': arrow = '||--o{'; break;
      case 'N:M': arrow = '}o--o{'; break;
    }
    lines.push(`    ${source.name} ${arrow} ${target.name} : "${rel.name ?? ''}"`);
  }

  return lines.join('\n');
}
