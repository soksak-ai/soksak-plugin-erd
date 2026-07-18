# soksak-plugin-erd

LLM-native database schema design (ERD) for the soksak terminal app.

Every capability is exposed as a command, so you design and evolve a database schema with no GUI — over the `sok` CLI, as MCP tools, or the e2e socket. The plugin holds one working schema (the single source of truth); a view, if open, just reflects it.

## Features

- **Headless-complete** — create tables/columns/relationships, validate, auto-layout, and emit SQL entirely by command; you never need the GUI.
- **One canonical model → per-dialect SQL** — design once, export DB-perfect DDL for SQLite / MySQL / PostgreSQL.
- **File-based `.mig` migrations** — a DB-independent migration DSL; generate from an incremental diff, render to any dialect, apply/revert.
- **Directional relationships** — `source` = referenced/PK side, `target` = FK holder; `autoFk` auto-creates the FK column on the target.
- **Batch & atomic** — build a whole schema in one `apply`; any op fails → the whole batch rolls back as a single undo entry.
- **Durable by default** — every edit is debounce-written to the host's durable store and restored on the next activation; a plugin reload or app restart does not lose the working schema (positions, viewport, and dialect included). `persist-flush` forces the write; `persist-status` reports backend/restored/dirty. The contract lives in `src/plugin/persist.ts` and is enforced by `src/plugin/persist.test.ts`.
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

Conventions: every command returns `{ok:true,…}` or `{ok:false,code,message}` — branch on `ok`, never throws. Address tables/columns by name (id optional). Prefer `apply` (batch) for multi-step builds.

The bundled `soksak-erd` skill (`contributes.skill`) carries the full mental model and workflow for AI agents.

## Transparency (UI nodes)

The toolbar controls are DOM elements. Each is declared in `contributes.nodes` and wired with a matching `data-node`, so `sok ui.tree` addresses them and `sok ui.input.click` drives them: `add-table`, `undo`, `auto-layout`, `fit-view`, `dialect-mysql`, `dialect-postgresql`.

The canvas is exempt. Tables and relationship edges are drawn in Pixi/WebGL, not the DOM — they carry no `data-node`, so `ui.tree` will not list them. Node exposure there is meaningless. Manipulate canvas content over commands instead: `create-table`, `select`, `set-position`, `drop-table`, `add-relationship`, `set-viewport`, `get-render-state`. That path is headless and covers every canvas operation.

## Development

```
npm install
npm test
node build.mjs   # bundle src → main.js (esbuild)
```

한국어 설명은 [README.ko.md](README.ko.md) 참고.
