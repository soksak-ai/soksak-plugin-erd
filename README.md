# soksak-plugin-erd

LLM-native database schema design (ERD) for the soksak terminal app.

Every capability is exposed as a command, so you design and evolve a database schema with no GUI — over the `sok` CLI, as MCP tools, or the e2e socket. The plugin holds one working schema (the single source of truth); a view, if open, just reflects it.

## Features

- **Headless-complete** — create tables/columns/relationships, validate, auto-layout, and emit SQL entirely by command; you never need the GUI.
- **One canonical model → per-dialect SQL** — design once, export DB-perfect DDL for SQLite / MySQL / PostgreSQL.
- **File-based `.mig` migrations** — a DB-independent migration DSL; generate from an incremental diff, render to any dialect, apply/revert.
- **Directional relationships** — `source` = referenced/PK side, `target` = FK holder; `autoFk` auto-creates the FK column on the target.
- **Batch & atomic** — build a whole schema in one `apply`; any op fails → the whole batch rolls back as a single undo entry.
- **Import / export** — DBML, Prisma, Mermaid, SQL.

## Usage

Discover the live command surface (names/params evolve — never guess):

```
sok commands | grep plugin.soksak-plugin-erd
sok help plugin.soksak-plugin-erd.<command>
```

Build a schema in one atomic apply, then validate, lay out, and emit SQL:

```
sok plugin.soksak-plugin-erd.apply title='shop' ops='[
  {"command":"create-table","params":{"name":"users","columns":[
     {"name":"id","dataType":"INT","isPrimaryKey":true,"autoIncrement":true},
     {"name":"email","dataType":"VARCHAR(255)","isUnique":true}]}},
  {"command":"add-relationship","params":{"source":"users","target":"orders","type":"1:N","autoFk":true}}
]'
sok plugin.soksak-plugin-erd.validate
sok plugin.soksak-plugin-erd.auto-layout direction=TB
sok plugin.soksak-plugin-erd.export-sql dialect=postgresql
```

Conventions: every command returns `{ok:true,…}` or `{ok:false,error}` — branch on `ok`, never throws. Address tables/columns by name (id optional). Prefer `apply` (batch) for multi-step builds.

The bundled `soksak-erd` skill (`contributes.skill`) carries the full mental model and workflow for AI agents.

## Development

```
npm install
npm test
node build.mjs   # bundle src → main.js (esbuild)
```

한국어 설명은 [README.ko.md](README.ko.md) 참고.
