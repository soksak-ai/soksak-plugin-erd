# ERD 라이브 DB 연동 개발 플랜 — 접속·리버스/포워드 동기화·마이그레이션 실행·쿼리

> 상태: 설계 확정 전 초안. 리서치(경쟁제품·AI-DB보안·코어표면·erd표면 4갈래) + 설계(기능·보안·UI) + 적대적 비평 + 코어 실코드 검증으로 도출.
> 원칙: R1(원인을 계약·경계에서 고침), R2(RED→GREEN), R6(원칙 먼저), R7(강결합 금지·인터페이스 우선), C1(코어 도메인 무지).

---

## 0. 목표와 범위

ERD 플러그인은 지금 헤드리스로 스키마를 설계하고 다이얼렉트별 SQL·`.mig` 마이그레이션을 **생성**한다. 여기에 **실제 DB에 붙어 실행하는** 축을 추가한다:

1. **접속(connect)** — SQLite / MySQL / PostgreSQL 프로필 관리·연결.
2. **리버스 동기화(DB→ERD, `db-pull`)** — 라이브 스키마를 introspection 해서 모델로 복원.
3. **포워드 동기화(ERD→DB, `db-push`)** — 모델 diff → DDL 을 dev DB 에 적용.
4. **마이그레이션 실행(`migration-run`)** — 저장된 `.mig` 를 실 DB 에 순서 적용(이력·체크섬).
5. **쿼리 실행(`query-run` / `db-exec`)** — 결과 그리드, read/write 분리.

### 지배 질문
> "공격자는 침입하지 않는다. 로그인한다." — 그리고 이제 **로그인하는 주체가 AI 에이전트**다. 우리 명령은 전부 CLI/MCP/socket 으로 AI 에게 직접 노출된다. **AI 에게 DB 를 열어주면서 무엇을 막아야 하는가**가 이 플랜의 중심이다.

### v1 비범위(명시적 제외)
- MSSQL / Oracle / 기타 다이얼렉트 (v1 지원 매트릭스는 §7).
- SSH 터널·점프호스트 경유 접속 (미결 §8-B).
- 뷰·CHECK·트리거·generated column 의 모델 1급 승격 (passthrough 보존으로 v1 처리, §3.2).

---

## 1. 아키텍처 결정 — 3층 소유권

플러그인 웹뷰 JS 는 **raw TCP 소켓 표면이 없다**(`app.network` = HTTP+WebSocket 뿐, `api.ts:1105-1131`). MySQL/PostgreSQL 와이어 프로토콜을 웹뷰에서 말할 수 없다. 코어에 DB 드라이버를 넣는 것은 C1(코어는 특정 도메인을 모른다) 위반이다. 따라서:

| 레이어 | 소유물 | 신설 여부 |
|---|---|---|
| **사이드카** `soksak-sidecar-db-studio` (신규 repo, Rust) | DB 드라이버·커넥션 풀·다이얼렉트별 introspection 쿼리·SQL 실행·**신뢰경계(read-only role 검증)**·결과 마스킹·감사 원장·`.mig` ledger·**destructive 확인 권위(PendingConfirms)** | **신설** — 유일한 새 바이너리 |
| **ERD 플러그인** | 접속 프로필 메타(durable-doc 3번째 문서)·모델 diff(`diffSchemas` 재사용)·`.mig`→SQL 생성(`parseMig`+`generateBatch` 재사용)·오케스트레이션 명령·UI | 기존 층에 편입 |
| **코어** | 스폰·생명주기(`ServiceManager`)·vault write-only+`vault_env` 주입·`remote.confirm` 사람 모달·registry 자동 CLI/MCP 노출 | **신규 기능 0** (전부 재사용) |

**사이드카 = `service` 모델**(별도 프로세스, stdio NDJSON, headless). `soksak-spec-service` 의 `serve(handlers)` 하니스를 차용한다(PS17 — 루프 손수 재작성 금지). 배포는 `sidecars[].reach.fetch` per-platform url+sha256, immutable-forward(발행 전 완성, 변경은 bump). 직접 선례 = `workflow` 플러그인(core-routed service: 상주·시크릿 env·headless).

- 근거: `docs/PLUGIN-SERVICE.md:36-46`, `src-tauri/src/service.rs:607-661`(spawn), `512-520`(drain restart), `docs/SIDECARS.md`(모델 표).
- DB 풀은 **앱과 함께 죽는 게 올바른 의미론** → UDS 생존 서비스(terminal-alacritty 류) 아님, stdio 서비스로 충분(자원 회수 보장).

---

## 2. ★ 보안의 중심 정정 — 게이트는 HITL 이 아니다 (실코드 검증)

설계 1차안은 코어 `danger:"destructive"` 게이트를 "AI 승인 게이트(HITL)"로 가정했다. **실코드 검증 결과 이는 사실과 다르다:**

- `src/state/settings.ts:78` → **`remoteDestructive: "allow"` (기본값)**.
- `src/commands/executor.ts:62-71` → 게이트는 `allow`/`deny` **정적 정책 토글**. `deny` 만 차단, 그 외 통과. **per-call 사람 프롬프트 없음.**
- `src/commands/registry.ts:1165` → `ctx.remote`(CLI/MCP/socket)에만 적용, UI 우회.
- `confirm:'<테이블명>'` 같은 파라미터는 **원격 호출자(AI)가 스스로 채운다** → 사람 승인 아님.

**⇒ 기본 설치에서 prompt-injection 된 에이전트가 `db-exec`/`db-push`/`migration-run` 을 사람 개입 0으로 실행할 수 있다.** 이것이 "AI 에게 DB 를 열어주기"의 최대 공격면이다.

### 정정된 설계: destructive = 사이드카 소유 PendingConfirms + 코어 `remote.confirm` 사람 모달

코어에는 이미 **진짜 per-call 사람 게이트**가 있다 — `remote.confirm`(`catalogRemote.ts`). remote-iroh 사이드카가 destructive 결정을 파킹(PendingConfirms·TTL·토큰)하고 **사람 결정만 코어 모달**에 위임하는 라이브 커맨드다. ERD DB 사이드카가 **정확히 이 패턴을 재사용**한다:

1. destructive op(DDL·`migration-run`·`db-exec` write·`db-push` apply) 요청 도착 → 사이드카가 PendingConfirms 에 파킹(대상·SQL 전문·영향 객체·트랜잭션 보장 수준 포함).
2. 사이드카 → 코어 `remote.confirm` 호출 → **코어가 사람 모달**을 띄운다(헤드리스면 타임아웃=거부).
3. 사람 approve → 사이드카가 그 토큰으로만 실행. deny/타임아웃 → 거부.

이로써 "게이트=HITL" 주장이 **실제로 성립**한다. 정적 `remoteDestructive` 정책은 보조적 coarse 차단으로만 쓰고, 설치 시 `deny` 권고 문구를 고지한다. **최종 시행층은 사이드카(사람 확인 토큰 없이 실행 불가)와 DB role 이다.**

---

## 3. 위협 모델과 5겹 방어

전제: 신뢰경계는 파서·프롬프트·트랜잭션 래퍼가 **아니다**. 오직 (a) DB 엔진 최소권한 role, (b) 코어 vault 의 get-불가 구조, (c) 사이드카 소유 확인 토큰 세 곳이다.

```
[겹1] DB role 최소권한   ← 유일한 진짜 신뢰경계 (파서 우회 전부 무력화)
[겹2] 리소스 상한        ← timeout·행수·바이트 (DoS·대량유출)
[겹3] 구문 위생          ← 단일문 prepared (semicolon stacking) — "경계" 아님, 위생일 뿐
[겹4] 결과 마스킹         ← 사이드카 후처리 (LLM 닿기 전) — 표시 은닉일 뿐, §3.5 한계
[겹5] 감사 + 사람확인     ← append-only 원장 + §2 PendingConfirms
```

### 3.1 겹1 — 진짜 read-only 는 DB role (파서는 경계가 아니다)

파서 allowlist 만으로 부족한 실증: **(a)** semicolon stacking `COMMIT; DROP ...`(Anthropic 공식 postgres MCP 아카이브 사유), **(b)** SELECT 내부 volatile 함수 부수효과 `lo_export`(서버 파일쓰기→RCE)·`COPY TO`(유출), **(c)** `DO` 블록·dollar-quote 익명코드, **(d)** `generate_series`·recursive CTE 리소스 고갈 — 전부 "SELECT만 허용" 파서를 통과한다. 함수 실행권한을 실제로 뺏는 것은 **DB role 뿐**이다.

- **read 프로필** = SELECT-only GRANT + DML/DDL/위험함수(`lo_export`/`lo_import`/`pg_read_file`/`COPY TO PROGRAM`) REVOKE 된 전용 계정. 세션 속성도 강제: PG `default_transaction_read_only=on`, MySQL `SET SESSION TRANSACTION READ ONLY`, SQLite `mode=ro`.
- **admin 프로필** = 마이그레이션 실행 전용, AI 상시 보유 금지(Supabase anon/service_role 패턴).
- **`db-provision-readonly`** 명령이 read-only role 생성 SQL 을 **산출만**(관리자가 검토·실행) 해 프로비저닝을 돕는다.
- role 강등 불가 접속(공유 계정)은 프로필에 **`readonly_verified:false`** 로 정직 표기하고 — 파서를 경계로 승격하는 R1 위반 대신 — 그 커넥션의 모든 명령을 write 등급으로 상향(§3.6 미결).

**SQLite 특례(비평 검증 gap):** SQLite 에는 role 이 없다 → "유일한 신뢰경계"가 이 다이얼렉트에서 부재. 대체 경계를 명시한다:
- `SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION=off`, `ATTACH` 차단(authorizer 콜백), `file` 경로 allowlist(홈 밖·`~/.soksak` 내부 금지). **이 다이얼렉트는 파일권한+authorizer 가 경계**임을 문서·UI 에 명시.

### 3.2 겹2+3 — 리소스 상한 + 구문 위생

사이드카가 모든 실행에 강제: `statement_timeout` 기본 5s(상한 30s), 최대 반환 행수 1000(초과 `truncated:true` 명시), 결과 바이트 상한 4MB. 쿼리는 **단일문 prepared statement/파라미터 바인딩만** — 문자열 연결 SQL 조립을 사이드카 코드에서 원천 배제. 단 이 겹은 문서·주석에서 **"구문 위생"으로만** 부르고 안전경계로 광고하지 않는다(R4 정직성).

### 3.3 겹4 — 민감 컬럼 마스킹 (사이드카 결과 후처리)

마스킹은 **쿼리 재작성이 아니라 결과 후처리** — 사이드카가 NDJSON 프레임 방출 직전 수행하므로 플러그인 JS·명령 응답·AI 컨텍스트 어디에 닿기 전 이미 가려진다. 탐지 3원: **(a)** 컬럼명 정규식 기본셋 `/(password|passwd|pwd|hash|salt|ssn|social|token|secret|api_?key|access_?key|private_?key|credit_?card|card_?number|cvv|iban|auth)/i`, **(b)** 사용자 지정 목록(`db-mask-add/remove`, durable-doc), **(c)** 별칭·표현식(`substr(password,1,3)`)으로 출처가 가려진 컬럼은 원본 쿼리 AST 에 민감 컬럼 참조가 있으면 마스킹 쪽으로 기운다. 형태 `<redacted:password>`. `db-introspect` 는 컬럼명·타입만 반환, **샘플 데이터 0**(스키마 노출이 데이터 노출로 번지는 경로 차단, Vanna 원칙).

### 3.4 자격증명 — vault write-only, 평문은 Rust 경계 밖으로 절대 불출

- 비밀번호는 vault(`ns=soksak-plugin-db-studio`)의 키 **`env:DBSTUDIO_DB_<profileId>_PASSWORD`** 로 저장. **`secret.get` 명령 부재**(`catalogSecrets.ts`) — 평문 readback 원천 차단.
- 사이드카 스폰 시 `vault_env`(PS9, 커밋 `0ec9101c`, `service.rs:607-631`)가 `env:` 접두 키를 env 로 주입, vault 변경 시 이벤트 구동 드레인 재시작(폴링 0). 사이드카만이 유일한 평문 접점.
- 호스트·포트·유저·dialect·environment 등 **비밀 아닌 메타만** durable-doc 에 저장.
- **DSN 스크러버**(사이드카 전 출력 경로): 에러·프레임·로그에서 `://user:pass@`·`password=` 패턴 자동 마스킹(드라이버 에러가 DSN 되뱉는 흔한 유출면 차단).
- **`CREDENTIALS_LOCKED` loud 실패**: `vault_env` 는 잠김 시 무음 빈 주입(`service.rs:627-628` 코어 공백) → 사이드카가 기동 시 기대 env 부재를 감지해 크게 실패. 무자격 무음 동작 금지.

### 3.5 마스킹·read 의 한계 (비평 검증 — 정직 고지)

마스킹과 무게이트 read 는 **완전한 차단이 아니다**. 플랜은 이를 숨기지 않고 명시한다:
- **WHERE 오라클**: `WHERE password LIKE 'a%'` 이진탐색(무게이트 read 반복)으로 마스킹된 원문을 복원 가능. 컬럼 보호의 실체는 role 의 **column-level SELECT 거부**뿐. → 진짜 민감 컬럼은 read 프로필 role 에서 아예 SELECT 불허를 권장.
- **`row_to_json`/`json_agg`/`CAST`**: 결과가 단일 JSON 컬럼으로 직렬화되면 컬럼명 정규식·AST 추적 둘 다 무력. → 사이드카가 이 함수 사용 시 전체 결과를 보수적으로 마스킹 후보로 표기.
- **무게이트 read 총량**: `rowLimit` 은 쿼리당 상한일 뿐, 페이지네이션 반복으로 전 테이블 덤프가 승인 0 으로 성립. 에이전트는 사이드카 밖 egress(터미널 등)를 이미 보유하므로 **"trifecta 유출축 차단"은 시스템 범위에서 완전하지 않다** — 감사는 **차단이 아니라 사후 탐지**임을 정직히 규정.
- **`EXPLAIN ANALYZE` 오분류**: PG 의 `EXPLAIN ANALYZE` 는 대상 문을 실제 실행 → tier0 "SELECT/EXPLAIN 허용"이 `EXPLAIN ANALYZE INSERT` 를 read 로 통과시키면 안 됨. AST 로 `ANALYZE` 옵션 감지해 write 로 분류.

### 3.6 감사 — 사이드카 소유 append-only (변조 방지)

비평 검증: 감사 원장을 `app.data` 에 두면 **피감사 주체(플러그인 런타임=AI 접근 명령 표면)가 쓰기·삭제 가능**해 append-only 가 선언일 뿐 강제가 아니다. → **감사 원장은 사이드카 소유 append-only 파일(체인 해시)로 확정**하고 조회만 `db-audit` 명령으로 노출. `app.data` 는 캐시/투영으로 격하. 기록 실패 시 op 도 실패(audit-or-die). 리터럴은 `?` 치환 정규화(감사로그 자체가 PII 저장소 되는 것 방지). 발화 주체 구분(remote:mcp / remote:cli / ui + 세션 id).

> ⚠️ 코어 활동로그 잔존 유출면: `query-run` params(`sql`·인라인 리터럴)는 사이드카 `?`치환 **이전**에 코어 명령 로그·MCP 트랜스크립트에 원문으로 남는다. → 클라이언트가 바인딩 파라미터를 쓰도록 스킬·UI 가 강제하고, `WHERE ssn='...'` 류 인라인 리터럴을 지양하게 안내(코어 로그 스크러빙은 별도 미결).

---

## 4. 명령 표면 — 단일 정본 표

> 비평 검증: 1차안은 세 섹션이 명령 이름·vault 키·감사 이름을 서로 다르게 써 정본이 없었다. **아래 표가 유일 정본이다.** UI·핸들러·스킬은 이 표를 참조한다.

| 명령 | bind | params | 목적 | 게이트 |
|---|---|---|---|---|
| `db-profile-add` | plugin | `{name, dialect, host?, port?, database, user?, environment(dev\|staging\|prod), readOnly?, ssl?, file?}` | 접속 프로필 메타 등록(비밀 제외). vault 키 안내 hint | **destructive** (§4-note) |
| `db-profile-list` / `db-profile-remove` | plugin | list `{}` / remove `{profile}` | 목록(비밀 필드 0) / 삭제(+vault 키 정리) | remove=destructive |
| `db-profile-secret` | plugin | `{profile, password}` | 비밀번호를 vault `env:DBSTUDIO_DB_<id>_PASSWORD` 봉인. readback 없음 | 값 스크러빙 (§4-note) |
| `db-test` | service | `{profile}` | 일회 접속 프로브: 지연·버전·**read-only 시행 수준 판정**(role/session/unverified) | 없음 |
| `db-connect` / `db-disconnect` / `db-status` | service | `{profile}` / `{profile}` / `{}` | 풀 수립·해제·상태 | 없음(접속은 매니페스트 caution 동의로 고지) |
| `db-pull` | plugin→service | `{profile, tables?, mode: preview\|replace\|merge}` | 리버스: introspection→모델(옵트인). preview 기본 | 모델 덮어쓰기만 confirm |
| `db-pull-paste` | plugin | `{dialect, mode}` 또는 `{dialect, payload}` | 무접속 폴백: 카탈로그 쿼리 발급→결과 JSON 붙여넣기(ChartDB) | 모델 덮어쓰기 confirm |
| `db-diff` | plugin→service | `{profile, direction}` | 드리프트 감지: 라이브 vs 모델 diff(destructive 후보 표시) | 없음(읽기) |
| `db-push` | plugin→service | `{profile, confirm?, allowDestructive?, only?, renameHints?}` | 포워드(dev): diff→DDL. dev 전용, prod 거부 | **destructive+PendingConfirms** (§2) |
| `migration-plan` | plugin | `{profile, dir?, to?}` | dry-run: pending+SQL+트랜잭션 보장 수준+체크섬 | 없음(읽기) |
| `migration-run` | plugin→service | `{profile, dir?, to?, confirm}` | `.mig` pending 순서 적용+ledger+진행 ev | **destructive+PendingConfirms** |
| `migration-rollback` | plugin→service | `{profile, id?, confirm}` | downOps→적용+ledger 삭제. down 불가면 거부 | **destructive+PendingConfirms** |
| `migration-history` | service | `{profile}` | 대상 DB `_soksak_migrations` ledger 열람 | 없음 |
| `query-run` | service | `{profile, sql, params?, rowLimit?, timeoutMs?, cursor?}` | 읽기: 단일문 prepared, 상한, 마스킹, `{columns,rows,rowCount,truncated,durationMs}` | 없음(read 무마찰) |
| `db-exec` | service | `{profile, sql, params?, force?}` | 쓰기/DDL 단일문. WHERE 없는 DELETE/UPDATE 는 `force` 없이 거부 | **destructive+PendingConfirms**. readOnly 프로필=무조건 거부 |
| `db-mask-add` / `db-mask-remove` | plugin | `{profile, table, column}` | 사용자 지정 마스킹 컬럼 관리 | mask-remove=destructive(보호 축소) |
| `db-unmask` | plugin→service | `{profile, columns?}` | 세션 한정 마스킹 해제. 감사 기록 | **destructive+PendingConfirms** |
| `db-audit` | service | `{profile?, limit?, since?}` | 사이드카 append-only 원장 열람 | 없음 |
| `db-provision-readonly` | plugin | `{profile, dialect}` | read-only role 생성 SQL **산출만**(실행 안 함) | 없음 |

**§4-note (비평 검증 — 프로필 변이 게이트):** 프로필 메타(`host`·`environment`·`readOnly`)가 **보안통제 전체의 입력**이다(prod 차단·egress 자기제한·read-only 강제가 이 세 필드에 의존). 통제의 입력이 통제 밖이면 안 된다 → `db-profile-add`/수정에서 **`host` 변경·`environment` 하향(prod→dev)·`readOnly` 해제를 destructive 등급으로 승격**, `environment` 하향은 사이드카가 **서버 신원(호스트+서버버전 지문) 대조로 거부**. `db-profile-secret` 의 평문 password 는 코어 활동로그에서 스크러빙(또는 코어 secrets 입력 표면 직결 검토 — 미결 §8).

**bind 규율:** DB 와이어를 직접 말하는 명령(`db-test`/`db-connect`/`query-run`/`db-exec`/`db-*` service)은 매니페스트에 `bind:"service"` spec 선언(PS3) → 코어가 네이티브 라우팅, **창 불필요**(headless CLI/MCP). 모델·파일이 필요한 오케스트레이션(`db-pull`/`db-push`/`migration-*`)은 플러그인 런타임 명령으로 두고 내부에서 service-bound 명령을 호출.

---

## 5. 무엇을 허가 / 무엇을 차단 — 4등급 게이트 매트릭스

| 등급 | 대상 | 허가/차단 | 시행 지점 |
|---|---|---|---|
| **0 read** | `query-run`(SELECT/EXPLAIN)·`db-introspect`·`db-diff`·`migration-plan`·`migration-history`·`db-audit` | **자동 허가**(무마찰) — read 를 매끄럽게 통과시켜야 write 승인이 의미를 가진다(approval fatigue 방지). 안전은 게이트가 아니라 겹1~4 가 담보 | — |
| **1 write DML** | `db-exec`(WHERE 있는 INSERT/UPDATE/DELETE) | **PendingConfirms 사람 확인**. `WHERE` 없으면 등급3 상향 | 사이드카 AST + §2 확인 |
| **2 DDL** | `migration-run`·`db-push` | **PendingConfirms + 플랜 제시 의무**(대상 DB·SQL 전문·다이얼렉트 트랜잭션 보장·영향 객체). **raw DDL 문자열 실행 명령 부재** — DDL 은 `.mig`/diff 경유만(검토 가능한 아티팩트 강제) | 사이드카 + §2 |
| **3 위험** | DROP TABLE/SCHEMA·TRUNCATE·WHERE 없는 대량 변경 | **prod 프로필=사이드카 무조건 거부(협상 불가, 게이트 이전)**. dev/staging=PendingConfirms + `confirm:'<테이블명>'` 명시 요구(대상 자각 강제) | 사이드카 최후겹 |

- **environment 필수 선언**(dev/staging/prod) + prod 상향 정책. prod 는 `db-push` 자체 거부(migration 트랙 강제), `migration-run` 은 plan 선행+추가 경고.
- **UI 경로**: 코어 게이트가 원격 전용(UI 우회)이므로 UI 는 동일 확인을 자체 다이얼로그로 시행하되, **판정 규칙은 언어중립 데이터(JSON 규칙표)**로 빼서 TS(UI)·Rust(사이드카)가 **같은 픽스처로 conformance 테스트**(비평 검증: `gate.ts` TS 단일모듈은 Rust 사이드카가 공유 못 함 → 이중구현 drift 를 계약 테스트로 봉인).

### 추가 차단(비평 검증 missedThreats)
- **프로필 host 재지정 자격증명 탈취**: 공격자 서버로 `host` 만 바꾸면 `vault_env` 가 진짜 비밀번호를 그 서버에 전달(PG cleartext) → §4-note 로 host 변경 destructive+지문 대조.
- **Rogue MySQL `LOAD DATA LOCAL INFILE`**: 공격자 MySQL 서버가 클라이언트 로컬 파일 요구 → 사이드카에서 `local_infile=0` 강제.
- **TLS 미강제 MITM**: 기본 `sslmode=require`+인증서 검증, 평문 다운그레이드 거부.
- **egress 자기제한**: 사이드카는 등록 프로필 `host:port` 에만 아웃바운드(OS egress 게이트는 코어 공백 → 동의 화면에 정직 고지). 단 프로필 등록이 무게이트면 "등록 프로필만"이 항진명제가 되므로 §4-note 게이트가 전제.
- **결과 그리드 XSS**: SQL 결과=untrusted → `textContent`-only 렌더, 복사 경로 플레인텍스트 보장.
- **식별자 인젝션**: 모델 테이블·컬럼명(AI 저작·위조 카탈로그 유래)이 DDL 에 들어갈 때 문법 allowlist 정규식+다이얼렉트 quoting 을 `sql-generator` 계약 테스트로 강제.

---

## 6. UI 설계 (요약)

원칙: UI = 커맨드의 투영(UI 전용 경로 0, E2E via CLI + R3 스크린샷). 비밀은 DOM 에 오지 않는다. 위험은 계층 게이트. 상태는 이벤트 구독(폴링 0).

- **P1 접속 관리** — LeftSidebar `Connections` 섹션(dialect 아이콘·환경 배지 dev회색/staging황/prod적·read-only 실드·상태점) + `ConnectionDialog`. 비밀번호 필드는 마스킹 입력만, 저장됨 상태는 `●●●● (vault 저장됨)` 정적 표시+[변경]만, **readback UI 부재**(vault get 부재와 대칭). `db-test` 결과에 read-only **3수준 실드**(role=녹/session=황/unverified=회+경고).
- **P2 동기화** — BottomPanel `sync` 탭: 객체 트리(+추가녹/~변경황/−삭제적/?rename보라, destructive 는 **기본 체크 해제**) + diff 상세 + SQL 미리보기 + **캔버스 Pixi 테두리 diff 틴팅**(R3 한 장으로 diff 전모). rename 은 자동 추측 금지, 인라인 `[rename]`/`[drop+add]` 선택. Apply 는 `ApplyConfirmDialog`(SQL 전문·destructive 적색 목록·트랜잭션 보장문·dev=체크/prod=타이핑).
- **P3 마이그레이션** — BottomPanel `migrations` 탭: `.mig` 목록(체크섬 ✓/⚠·적용상태·lint) + `[Plan]` 아코디언(SQL+보장 라벨) + `[Run]` 스테퍼(파일별 진행 ev, 실패 시 MySQL 부분적용 경고+drift 검사) + 이력 서브탭(ledger). drift 상시 배지.
- **P4 쿼리** — BottomPanel `query` 탭(기존 `sql` 탭은 `DDL` 로 표시명 개명, id/data-node 불변). 에디터+결과 그리드(가상화 DOM, 마스킹 셀 `●●●●`, 잘림 칩, `[더 불러오기]` 커서). read=무마찰, write=게이트.
- **P5 상태·확인** — StatusBar 접속 칩(prod=적색 테두리 상시 긴장)+감사 카운터. 감사 뷰(console 탭 필터)에 **발화 주체 아이콘**(사람/CLI/AI)·AI 행 미세 틴트(사람이 에이전트 DB 활동 감시). 4-tier 확인 체계.
- 신규 data-node 약 60종 전량 `contributes.nodes` 등재(미등재=ui.tree 불가시화). 테마는 시맨틱 토큰(하드코딩 hex 금지), 라이트·다크 각 1회 `window.snapshot` 검증.

---

## 7. v1 지원 매트릭스

| 기능 | SQLite | MySQL | PostgreSQL |
|---|---|---|---|
| introspection(리버스) | PRAGMA+sqlite_master | INFORMATION_SCHEMA+SHOW | information_schema+pg_catalog |
| read-only 경계 | 파일권한+authorizer(role 부재) | SET SESSION READ ONLY + role | default_transaction_read_only + role |
| 파일당 트랜잭션 롤백 | ✅ 원자 | ⚠️ **DDL 암묵 커밋 — 부분 적용 가능**(정직 고지) | ✅ 원자 |
| SQL 생성기(migration) | **신설 필요**(현재 mysql·pg 만) | ✅ | ✅ |
| export-sql | ✅(기존) | ✅ | ✅ |

- **선행 정리**: DDL 생성 3계통(레거시 `generateDDL` vs dialect registry vs migration `sql-generator`) 중 UI 의 `generateDDL` 사용을 **dialect registry 로 수렴**(db 기능이 `dialect.caps` 의존 → 드리프트=실 DB 오동작). migration `sql-generator` 의 **sqlite 부재 보완**(실행축 다이얼렉트 대칭).

---

## 8. v1 정책 결정 (채택 — 2026-07-20)

> 멀티에이전트 심층분석(각 결정을 코어 실코드 위에서)+적대적 정합성 검증(7개 충돌 보정)으로 도출. v1 기본값이며 사용자가 뒤집을 수 있다.

**공통 자세**: 읽기 무마찰, 쓰기·파괴·prod 는 사람 손. 코어 정적 게이트(`remoteDestructive`)는 `allow` 유지하되 **백스톱으로 신뢰하지 않는다 — 유일 시행층은 사이드카**이고 미배포·미도달 시 DB 실행 경로 자체가 부재(fail-closed). 사이드카의 "모든 destructive 파킹"은 §5 언어중립 JSON 규칙표 TS/Rust conformance 로 봉인.

**A. 게이트 = 사이드카 PendingConfirms + `remote.confirm` 사람 채널.** destructive(쓰기·DDL·마이그레이션)는 사이드카가 파킹 → 코어 `remote.confirm`(iroh 결합 0, `device_id="db-studio:<profile>"` 재사용) 사람 모달. 헤드리스=TTL→Deny(fail-closed, `catalogRemote.ts:82-89`). 정적 `remoteDestructive:"deny"` 강제는 **채택 안 함** — `remote.confirm` 자체가 `danger:destructive`+remote=true 라 함께 차단돼 HITL 을 영구 Deny 로 만든다(자기모순). deny 는 "AI destructive 불가, UI 만" 원하는 사용자용 문서화 옵트인. **정합성 정정**: "사람-승인 유일 채널"이며 그 위에 C·D 의 협상불가 하드거부 pre-filter 가 얹힌다(prod raw db-exec 사람모달 경로는 애초에 없음).

**B. read 프로필 기본, admin 별도 gated 등록**(Supabase anon/service_role). host 당 read/admin 2행·각 별개 vault 키(`env:DBSTUDIO_DB_<id>_PASSWORD`). admin 생성은 §4-note destructive 등급 → PendingConfirms 통과 필요. **정합성 정정**: 접속 실드는 role 시행 확인=**verified-green**, 미검증=**amber**(보장 아님, E 의 `readonly_verified` 에 종속). 미검증 접속을 "보장된 읽기전용"으로 절대 칠하지 않는다.

**C. prod `db-exec` 협상불가 하드거부** + break-glass. prod write 는 검토된 `.mig` `migration-run` 만. 긴급 hotfix 는 break-glass(TTL 시한부·사람전용·프로필명 타이핑·audit-or-die). D 에 종속(prod 라벨 신뢰 전제).

**D. 서버신원 토큰 각인·대조.** environment 자기신고 금지 — 최초 접속 시 durable 토큰(PG `system_identifier`/MySQL `@@server_uuid`/SQLite 절대경로)+prod baseline 각인, 하향 요청 시 라이브 지문이 prod 지문과 일치하면 사이드카 하드거부. **정합성 정정**: 프록시(pgbouncer/RDS proxy/Vitess) 뒤 토큰 미도달 배치는 **UNTRUSTED=prod 등급 fail-safe-high** 기본, 약한 host+버전 지문으로의 조용한 강등 금지.

**E. `readonly_verified:false` 는 세션 1회 read-grant**(read 한정·TTL·idle 만료·행수/바이트 예산·커넥션 스코프), write/DDL 은 grant 무관 항상 per-call `remote.confirm`. 매쿼리 read 게이트 금지(피로가 write 승인을 무디게 함). 모든 auto-pass read 는 audit-or-die(F).

**F(신설). audit-or-die.** auto-pass read·break-glass 의 유일 사후통제. 감사 원장 = **사이드카 소유 append-only(체인 해시, 변조탐지)**, app.data 는 캐시/투영으로 격하. 감사 기록 실패 시 op 를 fail-closed 로 막는다.

**정합성 검증이 남긴 범위 정직**: read-side 통제(B·E·마스킹)는 **기밀성 보장이 아니라 무결성·마찰 통제** — 에이전트는 사이드카 밖 터미널 egress 를 이미 보유(WHERE-oracle·pagination 덤프로 승인0 유출 성립). 사람 모달엔 command 문자열이 아니라 **구조화 영향**(문장종류·대상객체·행수추정·트랜잭션 보장)을 실어 rubber-stamp 차단, dev write 도 rich ApplyConfirmDialog(§6-P2)로 라우팅.

### 연기 가능 미결
- SSH 터널/점프호스트(사이드카 내장 vs 미지원 명시), shadow DB 도입(MySQL/PG diff 정규화), 드라이버 전략(per-DB 크레이트 vs sqlx — 5플랫폼 정적 링크 CI 실측), N:M 중간 테이블 push 규약, 감사 보존·회전 정책, 결과 페이지네이션(커서 vs keyset), 쿼리 에디터 구현체(textarea vs CodeMirror), per-connection 시크릿 갱신 입도.

---

## 9. 단계별 개발 계획 (RED→GREEN)

각 Phase 는 실패하는 재현 테스트(RED)에서 시작하고, 실 DB 왕복 E2E(CLI 경유)로 GREEN 을 증명한다. UI 는 `window.snapshot` R3.

- **Phase 0 — 선행 정리·결정** — §8 A~E 결정. DDL 생성 3계통 수렴, migration sqlite 생성기 보완. 게이트 규칙 JSON 규칙표 초안+TS/Rust conformance 픽스처. `plugin.json` 매니페스트 확장(permissions += service/secrets/commands:destructive, sidecars, service 블록).
- **Phase 1 — 사이드카 스캐폴드** — `soksak-sidecar-db-studio` repo `git init`+초기 커밋(신규 플러그인 규율). `soksak-spec-service` `serve()` 차용, `ping`/`db-connect`/`db-disconnect`/`db-status`. 드라이버 1종(SQLite 먼저)+커넥션 풀. RED: `db-test` 로 실 SQLite 파일 접속·버전 반환.
- **Phase 2 — read 경로** — `query-run`(단일문 prepared·상한·마스킹 후처리)+`db-introspect`(카탈로그→JSON)+`db-audit`(사이드카 append-only). read-only 세션 강제+3수준 판정. RED: SELECT 왕복+민감 컬럼 마스킹+행수 truncated.
- **Phase 3 — 리버스** — `db-pull`(introspection→ERDSchema 매핑, 옵트인, passthrough 보존)+`db-pull-paste`. RED: 실 DB 스키마→모델 복원(FK·인덱스·복합PK), 표현불가 객체 손실 리포트.
- **Phase 4 — 포워드(dev)** — `db-diff`+`db-push`(diff→DDL, ALTER 승격, destructive 분류, rename hints). PendingConfirms+`remote.confirm` 배선. RED: 모델 편집→push→라이브 반영, destructive 는 확인 없이 거부.
- **Phase 5 — 마이그레이션 실행** — `migration-plan`/`migration-run`/`migration-rollback`/`migration-history`. ledger `_soksak_migrations`(체크섬·파일당 트랜잭션·MySQL 정직 고지). RED: `.mig` pending 적용+ledger 기록+체크섬 변조 거부+롤백.
- **Phase 6 — write·위험 게이트** — `db-exec`(WHERE 가드·prod 거부)+등급3 최후겹+§5 추가 차단(local_infile·TLS·EXPLAIN ANALYZE·식별자 allowlist). RED: prod 프로필 DROP 거부, WHERE 없는 DELETE force 요구.
- **Phase 7 — UI** — P1~P5 표면+data-node 등재+R3 스냅샷(라이트/다크). E2E: CLI 로 접속→pull→push→migration-run→query-run→audit 전 사이클 완결.
- **Phase 8 — 멀티다이얼렉트·배포** — MySQL/PG 드라이버 추가, 5플랫폼 사이드카 빌드+sha256 핀+immutable-forward 발행. `soksak-db-studio` SKILL.md 동시 갱신(스킬 drift 방지).

---

## 10. 경쟁 제품 참조 (채택/회피)

- **채택** — 리버스=카탈로그 SQL(ChartDB Smart Query, SchemaSpy 벤더별 보충) · push(dev)/generate+migrate(prod) 2트랙(Drizzle/Prisma) · 이력테이블+체크섬+파일당 트랜잭션(Flyway/Liquibase) · destructive 승인에 영향 행수(Bytebase) · 객체별 선택 스크립트(pgAdmin Schema Diff) · OS 키체인 저장·위험시 재인증(TablePlus) · 권한을 DB role 에 위임(PostgREST/Supabase) · read-only 2겹+WHERE 경고(DataGrip) · Safe Mode 읽기전용 기본·스키마만 AI 전송(Text2SQL/Vanna) · 접속=별도 프로세스(Azimutt Gateway/Beekeeper Utility).
- **회피** — 자체 암호키 소스 박제(DBeaver CE DES) · 파서 1겹 read-only(Anthropic 공식 postgres MCP 아카이브) · ngrok 로컬 노출(AI2SQL) · MySQL 에 거짓 롤백 약속 · rename 자동 추측.

---

## 11. 리스크·선행 의존성

- **사이드카 배포가 선행 의존성** — read/get 부재로 아키텍처가 사이드카 강제 → 멀티플랫폼 발행(per-platform sha256·immutable-forward) 파이프라인이 기능보다 먼저 서야 함.
- **모델 표현력 공백** — 뷰·CHECK·트리거·collation·generated column 이 ERDSchema 에 없음 → passthrough 보존(v1) 또는 모델 확장(비용: 캔버스·diff·`.mig` 전 층 관통).
- **이중 진실** — `.mig` fold 베이스라인 vs 실 DB ledger drift → `db-diff` 로 감지, **자동 화해 금지**(사용자 결정).
- **MySQL 부분 적용 복구** — DDL·ledger 사이 크래시 시 재실행 비멱등 → 문 단위 체크포인트+advisory lock(인스턴스 간 배타, in-process 뮤텍스로 부족).
- **TOCTOU** — `db-diff`↔`db-push` 사이 DB 변경 → diff 시 카탈로그 해시 발급, push 직전 재검증.
- **코어 공백 3종** — OS egress 게이트 부재·`vault_env` per-key 갱신 입도 부재·활동로그 SQL 원문 잔존 → 동의 고지·드레인 전체 재시작 감수(v1)·바인딩 파라미터 안내로 각각 보상, 장기적으로 코어 표면 승격 요청.

---

## 부록 — 근거 출처(코어/erd 실코드)

- 게이트 실체: `src/state/settings.ts:78`, `src/commands/executor.ts:62-71`, `src/commands/registry.ts:1165`, `src/commands/catalogRemote.ts`.
- 사이드카/service: `docs/PLUGIN-SERVICE.md:36-46`, `src-tauri/src/service.rs:607-661,512-520`, `docs/SIDECARS.md`.
- vault: `src/commands/catalogSecrets.ts`, `src/plugins/api.ts:1592-1608`, `service.rs:607-631`(vault_env, 커밋 `0ec9101c`).
- 네트워크 표면: `src/plugins/api.ts:1105-1131`(HTTP+WS만).
- erd 모델: `src/types/schema.ts:8-82`. `.mig`: `src/features/migration/serializer.ts:123-145`, `src/plugin/commands.ts:962-1147`. diff: `src/features/migration/diff.ts:79-84,218-274`. SQL 3계통: `src/features/db/dialect/registry.ts`, `src/features/migration/sql-generator`, `src/features/sql/ddl-generator.ts`. import 파서: `src/features/sql/sql-parser.ts:13-164`. 명령 등록: `src/plugin/commands.ts:220-247`. durable-doc: `src/plugin/durable-doc.ts`.
