# soksak-plugin-erd

soksak 터미널 앱을 위한 LLM-native 데이터베이스 스키마 설계(ERD) 플러그인.

모든 기능이 명령 하나로 노출되어, GUI 없이 데이터베이스 스키마를 설계·발전시킨다 — `sok` CLI, MCP 도구, e2e 소켓으로. 플러그인은 작업 스키마 하나(단일 진실)를 들고 있고, 뷰가 열려 있으면 그걸 반영할 뿐이다.

## 기능

- **헤드리스 완결** — 테이블/컬럼/관계 생성, 검증, 자동 배치, SQL 생성까지 전부 명령으로. GUI 불필요.
- **하나의 정본 모델 → 다이얼렉트별 SQL** — 한 번 설계하면 SQLite / MySQL / PostgreSQL 별로 완벽한 DDL 출력.
- **파일 기반 `.mig` 마이그레이션** — DB 독립 마이그레이션 DSL. 증분 diff 에서 생성, 임의 다이얼렉트로 렌더, 적용/되돌림.
- **방향 있는 관계** — `source` = 참조/PK 측, `target` = FK 보유 측. `autoFk` 가 target 에 FK 컬럼 자동 생성.
- **배치·원자성** — `apply` 하나로 전체 스키마 구성. 한 op 라도 실패하면 전체 롤백(단일 undo).
- **임포트/익스포트** — DBML, Prisma, Mermaid, SQL.

## 사용

라이브 명령 표면 발견(이름·파라미터는 바뀌니 추측 금지):

```
sok commands | grep plugin.soksak-plugin-erd
sok help plugin.soksak-plugin-erd.<command>
```

원자적 apply 하나로 스키마 구성 후 검증·배치·SQL 출력:

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

규약: 모든 명령은 `{ok:true,…}` 또는 `{ok:false,error}` 를 돌려준다 — `ok` 로 분기, throw 없음. 테이블/컬럼은 이름으로 지칭(id 선택). 다단계 구성은 `apply`(배치) 권장.

동봉된 `soksak-erd` 스킬(`contributes.skill`)이 AI 에이전트용 멘탈모델과 워크플로 전체를 담는다.

## 투명성 (UI 노드)

툴바 컨트롤은 DOM 요소다. 각각 `contributes.nodes` 로 선언하고 같은 이름의 `data-node` 로 배선한다 — `sok ui.tree` 가 주소로 노출하고 `sok ui.input.click` 이 클릭한다: `add-table`, `undo`, `auto-layout`, `fit-view`, `dialect-mysql`, `dialect-postgresql`.

캔버스는 면제한다. 테이블과 관계 엣지는 DOM 이 아니라 Pixi/WebGL 로 그린다 — `data-node` 가 없으니 `ui.tree` 에도 뜨지 않는다. 캔버스 내부 개체에 노드 노출은 무의미하다. 캔버스 조작은 커맨드로 한다: `create-table`, `select`, `set-position`, `drop-table`, `add-relationship`, `set-viewport`, `get-render-state`. 이 경로는 헤드리스이며 모든 캔버스 동작을 덮는다.

## 개발

```
npm install
npm test
node build.mjs   # src → main.js 번들(esbuild)
```
