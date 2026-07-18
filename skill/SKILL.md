---
name: soksak-erd
description: Use when designing, editing, or migrating a database schema (ERD) inside soksak — drive the ERD plugin entirely by CLI/MCP commands (`sok plugin.soksak-plugin-erd.*`) to create tables/columns/relationships, validate, auto-layout, generate per-dialect SQL (SQLite/MySQL/PostgreSQL), and produce file-based `.mig` migrations. Headless: works without opening the GUI. 데이터베이스 스키마 설계, ERD, 테이블/컬럼/관계 추가, 마이그레이션, SQL 생성도 여기.
---

# soksak ERD — LLM-native database design

The soksak ERD plugin exposes **every** capability as a command, so you design and evolve a database schema with no GUI. The same commands run via `sok plugin.soksak-plugin-erd.<name>` (CLI), as MCP tools, and over the e2e socket. The plugin holds one working schema (the single source of truth); a view, if open, just reflects it.

## Discover first

List the exact command surface — names/params evolve, so never guess:

```
sok commands | grep plugin.soksak-plugin-erd
```

Every command and its JSON params come from one registry (the source of truth for CLI + MCP + docs). `get-schema` returns the current model (`mode=compact` saves tokens; `mode=full` is the raw model).

## Core workflow (design from a prompt)

Build a whole schema in one atomic `apply`, then validate, lay out, and emit SQL. **`apply` takes `ops`, an array of `{command, params}`** — each entry is one command call:

```
sok plugin.soksak-plugin-erd.apply title='shop' ops='[
  {"command":"create-table","params":{"name":"users","columns":[
     {"name":"id","dataType":"INT","isPrimaryKey":true,"autoIncrement":true},
     {"name":"email","dataType":"VARCHAR(255)","isUnique":true}]}},
  {"command":"create-table","params":{"name":"orders","columns":[
     {"name":"id","dataType":"INT","isPrimaryKey":true,"autoIncrement":true},
     {"name":"total","dataType":"DECIMAL(12,2)"}]}},
  {"command":"add-relationship","params":{"source":"users","target":"orders","type":"1:N","autoFk":true}}
]'
```

- **`apply` is atomic** by default: any op fails → the whole batch rolls back (snapshot restore), one undo entry.
- **Address tables/columns by NAME** (id optional). Relationships: `source` = referenced/PK side, `target` = FK-holder side; `autoFk:true` auto-creates the `<source>_<pk>` FK column on the target.
- Mutations are **idempotent** (`ifNotExists`, no-op deletes). Returns `{ok:true,…}` or `{ok:false,code,message,…}` (often with `did_you_mean`/`candidates`).

Then: `validate` (→ `{issues}`, fix errors), `auto-layout direction=TB` (positions, headless), and single granular edits. For rollback, rely on `apply`'s atomic batch (any op fails → whole batch restored); the standalone `undo`/`redo` commands are not reliable history yet.

## Domain invariants (not in any single command's help)

- **One canonical model → per-dialect SQL.** You design once; `export-sql dialect=postgresql|mysql|sqlite` emits DB-perfect DDL. Don't model per-dialect.
- **Migrations are file-based `.mig` DSL, DB-independent.** `migration-generate` writes `migrations/migration_*.mig` from an incremental diff; `migration-sql` renders a `.mig` to a chosen dialect. The `.mig` is the source of truth, not raw SQL.
- **Relationships are directional**: `source` = referenced/PK side, `target` = FK holder. `autoFk` auto-creates the FK column on the target. Get this backwards and the FK lands on the wrong table.
- **The working schema persists automatically.** Every edit is debounce-written to the host's durable store and restored on the next activation — a plugin reload or app restart does not lose the schema. `persist-flush` forces the write immediately (use before reload-style operations); `persist-status` reports backend/restored/dirty.

## Conventions

- Every command returns `{ok:true,…}` or `{ok:false,code,message}`. No throws — branch on `ok`.
- Prefer `apply` (batch) for multi-step builds; prefer name-addressing over IDs. It is **headless-complete** — you never need the GUI.
