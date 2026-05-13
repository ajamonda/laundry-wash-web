# laundry-wash-web

세탁 공장 스태프(역할 `WASH`)가 사용하는 웹 클라이언트입니다. 백 스캔 → 태깅/경로 배정 → 스텝 스캔 → 패키징, 그리고 예외 처리/경로 변경 요청까지 다룹니다. 모든 상태는 백엔드(`laundry-api`)가 권위이고, 이 앱은 거의 순수 클라이언트입니다.

---

## 0. 시작하기 전에

이 앱 혼자서는 동작하지 않습니다. **백엔드 서버(`laundry-api`)가 같이 떠 있어야 합니다.** 아래 순서대로 진행하세요.

필요한 것:

| 항목 | 권장 버전 | 확인 명령 |
|---|---|---|
| Node.js | 20.x 이상 | `node -v` |
| npm | Node에 포함 | `npm -v` |
| Git | 최신 | `git --version` |
| 백엔드 (`laundry-api`) | 같은 리포지토리의 형제 디렉토리 | `../laundry-api` 존재 확인 |

> 윈도우에서 `nvm4w`를 쓰고 있다면, PowerShell 세션마다 한 번 PATH를 잡아줘야 할 수 있습니다:
> ```powershell
> $env:PATH = 'C:\nvm4w\nodejs;' + $env:PATH
> ```

---

## 1. 의존성 설치

프로젝트 루트(`laundry-wash-web`)에서:

```powershell
npm install
```

설치 완료 후 `node_modules/`가 생성됩니다.

---

## 2. 백엔드 먼저 띄우기

새 터미널을 열고 백엔드 디렉토리로 이동해서 띄웁니다. 자세한 절차는 `../laundry-api/README.md`를 따르되, 보통은 다음 흐름입니다:

```powershell
cd ../laundry-api
npm install                  # 처음 한 번
npm run prisma:migrate       # DB 스키마 (PostgreSQL 필요)
npm run prisma:seed          # 시드 데이터 (스태프 계정, 카탈로그 등)
npm run start:dev            # 개발 서버 (기본 포트 3000)
```

브라우저에서 `http://localhost:3000/openapi.json`이 JSON으로 응답하면 백엔드 준비 완료입니다. 이 터미널은 그대로 열어둡니다.

> 백엔드가 다른 포트나 호스트라면 [4. 환경 변수](#4-환경-변수-선택) 참고.

---

## 3. 개발 서버 실행

`laundry-wash-web` 디렉토리에서 (백엔드 터미널과 별개의 새 터미널):

```powershell
npm run dev
```

기본 주소: **http://localhost:5175**

브라우저에서 열면 로그인 화면이 보입니다. 시드 데이터에 포함된 스태프 ID(예: `wash-staff-1`)를 입력하고 "시작하기"를 누르면 백 스캔 화면으로 진입합니다.

> Vite 개발 서버가 `/api/*` 요청을 자동으로 `http://localhost:3000`으로 프록시합니다 ([vite.config.ts](vite.config.ts) 참고). 별도 CORS 설정 없이 그냥 동작합니다.

---

## 4. 환경 변수 (선택)

기본값으로 충분하지만, 백엔드 위치를 바꿀 경우 프로젝트 루트에 `.env.local` 파일을 만들어 덮어쓸 수 있습니다.

| 변수 | 기본값 | 의미 |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` (Vite 프록시 경유) | HTTP 베이스 URL |
| `VITE_SOCKET_BASE_URL` | `VITE_API_BASE_URL`에서 `/api` 제거, 폴백 `http://localhost:3000` | socket.io 베이스 URL |

예시 (`laundry-wash-web/.env.local`):

```
VITE_API_BASE_URL=http://localhost:3000
VITE_SOCKET_BASE_URL=http://localhost:3000
```

`.env.local`을 만들거나 수정한 뒤에는 `npm run dev`를 다시 시작해야 반영됩니다.

---

## 5. 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 (http://localhost:5175, HMR 활성) |
| `npm run build` | 타입체크 + 프로덕션 빌드 (`dist/` 생성) |
| `npm run preview` | 빌드 산출물을 로컬에서 미리보기 |
| `npm run typecheck` | TypeScript 타입체크만 실행 |
| `npm test` | 단위 테스트 실행 (Vitest, 1회) |
| `npm run test:watch` | 단위 테스트 watch 모드 |
| `npm run generate:api` | 백엔드 OpenAPI 스키마로부터 타입 재생성 (백엔드 실행 중이어야 함) |

---

## 6. 첫 화면이 보이지 않을 때

| 증상 | 원인/조치 |
|---|---|
| `npm install`이 ETIMEDOUT/EACCES로 실패 | 사내 프록시/방화벽 또는 권한 문제. `npm config get registry` 확인. |
| 로그인 시 "요청에 실패했어요. (500)" 등 표시 | 백엔드가 안 떠 있거나 시드가 안 들어감. `http://localhost:3000/openapi.json`을 브라우저로 직접 확인. |
| 로그인 시 401 | 입력한 스태프 ID가 시드에 없음. `../laundry-api`의 시드 데이터에서 `WASH` 역할 스태프 ID 확인. |
| 5175 포트가 이미 사용 중 | 다른 Vite 프로세스 종료, 또는 `vite.config.ts`의 `server.port` 변경. |
| 브라우저 콘솔에 CORS 에러 | `.env.local`로 `VITE_API_BASE_URL`을 절대 URL로 지정한 경우 발생 가능. 기본값(`/api`)으로 되돌리면 프록시가 해결해줌. |
| socket.io 연결 실패 | `VITE_SOCKET_BASE_URL`이 백엔드 호스트와 일치하는지 확인. 백엔드가 같은 호스트의 다른 포트라면 명시적으로 지정. |

---

## 7. 기술 스택

- **React 19** + **TypeScript** (`strict: true`)
- **Vite** — 개발 서버, 번들러
- **TanStack Query** — 서버 상태 캐싱/동기화
- **Zustand** (`persist`) — 세션과 마지막 검색 주문 ID 클라이언트 보관
- **socket.io-client** — 예외/경로변경 결과의 실시간 푸시 수신 (`/exception` 네임스페이스)
- **Vitest** — 단위 테스트 (node 환경, 도메인 순수 로직만)

---

## 8. 디렉토리 구조

```
laundry-wash-web/
├── docs/                  # 하네스 엔지니어링용 레퍼런스 (변경 시 동기화 필요)
│   ├── plan.md            # 전체 인덱스 (엔드포인트, 상태머신, 술어, 테스트 규칙)
│   ├── auth-api.md
│   ├── exception-api.md
│   ├── wash-api.md
│   └── DESIGN.md
├── src/
│   ├── App.tsx            # step 기반 라우팅
│   ├── main.tsx           # 엔트리
│   ├── api.ts             # fetch 래퍼, ApiError
│   ├── store.ts           # zustand 세션 스토어
│   ├── types.ts           # 백엔드 뷰 타입
│   ├── utils.ts           # 라벨 매핑
│   ├── useWashStaffExceptionSocket.ts
│   ├── styles.css
│   ├── components/        # 화면 컴포넌트
│   └── domain/            # 순수 로직 (테스트 대상)
│       ├── item-actions.ts        # 게이팅 술어
│       └── route-change.ts        # 경로 변경 비용 계산
└── vite.config.ts
```

새 화면 로직(특히 금액 계산, 가시성 분기)은 `src/domain/`에 순수 함수로 두는 것이 원칙입니다. 자세한 가이드는 [docs/plan.md](docs/plan.md)의 "Client-side derived logic"과 "Tests" 섹션 참고.

---

## 9. 더 알고 싶다면

- 백엔드 API 계약: [docs/wash-api.md](docs/wash-api.md), [docs/exception-api.md](docs/exception-api.md), [docs/auth-api.md](docs/auth-api.md)
- 화면별 동작/상태머신: [docs/plan.md](docs/plan.md)
- 시각/스타일 가이드: [docs/DESIGN.md](docs/DESIGN.md)
