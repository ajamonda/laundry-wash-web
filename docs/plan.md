# Wash Web — Harness Reference

Factory-staff frontend (role `WASH`). Pure client of laundry-api. No business logic locally — everything is HTTP/WebSocket and the backend is the source of truth.

This file is the index. Endpoint and event detail live in the per-domain files. Read this for: what exists, what transitions, what should be true.

- [Endpoints index](#endpoints-index)
- [WebSocket events index](#websocket-events-index)
- [OrderItem state machine](#orderitem-state-machine)
- [BillingRequest model](#billingrequest-model)
- [ApprovalRequest model](#approvalrequest-model)
- [RouteChangeRequest model](#routechangerequest-model)
- [Cross-cutting invariants](#cross-cutting-invariants)
- [Client persistence](#client-persistence)
- [Realtime hook](#realtime-hook)
- [Environment](#environment)

---

## Endpoints index

Every HTTP call wash-web makes. `S` = STAFF(WASH), `–` = no auth.

| Auth | Method | Path | Detail | Used by |
|---|---|---|---|---|
| – | POST | `/auth/staff/wash/dev-login` | [auth](auth-api.md) | login |
| S | GET | `/wash/bags/:barcode` | [wash](wash-api.md#get-washbagsbarcode) | bag-items screen |
| S | GET | `/wash/orders/:orderId/items` | [wash](wash-api.md#get-washordersorderiditems) | order-search screen |
| S | POST | `/wash/items/:id/tag` | [wash](wash-api.md#post-washitemsidtag) | WashItemCard |
| S | GET | `/processing-routes` | [wash](wash-api.md#get-processing-routes) | route picker |
| S | POST | `/wash/tags/:tagBarcode/assign-route` | [wash](wash-api.md#post-washtagstagbarcodeassign-route) | WashItemCard |
| S | GET | `/wash/tags/:tagBarcode` | [wash](wash-api.md#get-washtagstagbarcode) | step-scan |
| S | POST | `/wash/tags/:tagBarcode/scan-step` | [wash](wash-api.md#post-washtagstagbarcodescan-step) | step-scan |
| S | GET | `/wash/processing-queue` | [wash](wash-api.md#get-washprocessing-queue) | nav badges, queue screen |
| S | POST | `/wash/packages` | [wash](wash-api.md#post-washpackages) | packaging |
| S | POST | `/wash/items/:id/raise-issue` | [exc](exception-api.md#post-washitemsidraise-issue) | ExceptionForm |
| S | POST | `/wash/items/:id/activate-exception-flow` | [exc](exception-api.md#post-washitemsidactivate-exception-flow) | ExceptionForm |
| S | POST | `/wash/items/:id/request-route-change` | [exc](exception-api.md#post-washitemsidrequest-route-change) | RouteChangeForm |
| – | GET | `/catalog/items/:code` | [wash](wash-api.md#get-catalogitemscode) | RouteChangeForm |

Customer-side endpoints (called by user-web, not by wash-web; listed because wash-web depends on their side effects):

- `POST /wash/approval-requests/:id/respond`
- `POST /wash/route-change-requests/:id/approve`
- `POST /wash/route-change-requests/:id/reject`

---

## WebSocket events index

Namespace `/exception`, transport `websocket`, auth `{ token: 'Bearer {accessToken}' }`.

Server room policy on connect:
- `subjectType=CUSTOMER` → `customer:{customerId}`
- `subjectType=STAFF && staffRole=WASH` → `wash-staff`
- otherwise → disconnect

Events wash-web receives (in `wash-staff` room):

| Event | Payload | Trigger |
|---|---|---|
| `exception:approval-resolved` | `{ approvalRequestId, decision: string, orderItemId }` | customer responded to an approval request |
| `exception:route-change-resolved` | `{ routeChangeRequestId, orderItemId, status: 'APPROVED'\|'REJECTED' }` | customer approved/rejected route change |

Events wash-web does **not** subscribe to (but exist on `/exception` for customers): `exception:approval-requested`, `exception:route-change-requested`.

Separate namespace `/billing` exists for customer billing pushes (`billing:created`); wash-web does not subscribe.

---

## OrderItem state machine

Statuses wash-web encounters:

```
PICK_UP → TAGGED → SORTED → PROCESSING → READY_TO_PACKAGE → READY_FOR_DELIVERY
```

| from | trigger | to | notes |
|---|---|---|---|
| `PICK_UP` | `POST /wash/items/:id/tag` | `TAGGED` | also creates BASE billing row |
| `TAGGED` | `POST /wash/tags/:tagBarcode/assign-route` | `SORTED` | creates `ItemProcessingPlan`, first step `IN_PROGRESS` |
| `SORTED` | `POST .../scan-step` | `PROCESSING` | on first non-trivial advance |
| `PROCESSING` | `POST .../scan-step` | `PROCESSING` | repeated until plan complete |
| `PROCESSING` | `POST .../scan-step` | `READY_TO_PACKAGE` | when `isPlanCompleted=true`; triggers billing flush |
| `READY_TO_PACKAGE` | `POST /wash/packages` | `READY_FOR_DELIVERY` | grouped into `ItemPackage` |

Customer `RETURN_WITHOUT_PROCESSING` on an approval request also ends the plan and pushes the item to `READY_FOR_DELIVERY` regardless of remaining route steps.

`processingState`:
- `null` until `SORTED+`.
- `currentStepSource: 'OVERRIDE'` while an exception flow's override stack is non-empty.
- `currentStep.stepType === 'WAIT_CUSTOMER_DECISION'` blocks staff `scan-step` (409).

---

## Client-side derived logic

Wash-web is a thin client but performs three small derivations that are **the source of truth for the affected UI behaviors**. Server still authorizes; these only decide what to show / what to send.

All live under `src/domain/**`. AI changing UI logic must extend these modules, not duplicate logic into components.

### Gating predicates — `src/domain/item-actions.ts`

Pinned by `src/domain/item-actions.test.ts`.

| Predicate | Returns true iff | Used to gate |
|---|---|---|
| `isOverride(state)` | `state?.currentStepSource === 'OVERRIDE'` | OVERRIDE badge (`⚡ 예외 처리`), step row styling |
| `isAwaitingDecision(state)` | `state?.currentStep?.stepType === 'WAIT_CUSTOMER_DECISION'` | "고객 응답 대기 중" notice in step-scan |
| `canRaiseException(item, state)` | `item.status ∈ {SORTED, PROCESSING}` AND `state.currentStep.stepType ∈ {INSPECTING, RE_INSPECTION, PREMIUM_INSPECTING}` | "예외 처리" button (WashItemCard, StepScanScreen) |
| `canRequestRouteChange(item, state)` | `item.status ∈ {SORTED, PROCESSING}` AND `state.routeCode` truthy AND NOT `isOverride(state)` | "경로 변경" button (WashItemCard) — mirrors invariant 5 |
| `canScanStep(item, state)` | `item.tagBarcode` truthy AND NOT `state.isPlanCompleted` AND NOT `isAwaitingDecision(state)` | "스캔" button (StepScanScreen) — mirrors invariant 4 |

Harness implication: when asserting UI affordances after a state transition, derive the expected visibility from these predicates rather than the raw HTTP response shape.

### Route-change cost — `src/domain/route-change.ts`

Pinned by `src/domain/route-change.test.ts`.

| Export | Contract |
|---|---|
| `findOptionByCode(options, code)` | DFS over `CatalogOption[]` including `children`. Returns first match or `null`. |
| `buildRepairSelection(group, optionCode, inputValue)` | Resolves a `repair` option (top-level or first-level child) into a `SelectedRepairOption`. Returns `null` if the option has no price or code is not found. NUMBER inputs default to `"1"`. |
| `computeRouteChangeCost({ cleaningGroup, newCleaningMethodCode, repairSelections, estimatedMinAmount })` | Returns `{ newCleaningPrice, repairCost, totalNew, additionalCost, hasPriceInfo }`. `additionalCost = totalNew − estimatedMinAmount` and **is the value sent to `POST /wash/items/:id/request-route-change` as `additionalCost`** (rounded `min` by the form). May be negative. `hasPriceInfo = false` when `newCleaningMethodCode` is null/unknown or `cleaningGroup` is null — in that case the form omits `additionalCost` from the request body. |

Server side then writes `additionalCost` into the SUPPLEMENT billing row on approval (see RouteChangeRequest model). A regression in `computeRouteChangeCost` produces a wrong customer bill — harness should re-derive the expected `additionalCost` from `(new cleaning_method price + Σ repair price) − estimatedMinAmount` and compare against the request body when intercepting `request-route-change` calls.

`hasPriceInfo=false` cases the harness should be aware of:
- `OUTSOURCED_ONLY_CLEANING` maps to `cleaning_method=null` in [wash-api.md](wash-api.md#route-codes--cleaning_method).
- Catalog response missing `cleaning_method` group.
- Catalog has the group but no option matching the resolved method code.

---

## BillingRequest model

Two `type`s: `BASE`, `SUPPLEMENT`. Each has a `notifiedAt: Date | null`.

| Aspect | BASE | SUPPLEMENT |
|---|---|---|
| Created at | `POST /wash/items/:id/tag` | customer approval (route-change or extra-cost approval-respond) |
| Idempotency | UNIQUE on `BillingRequestItem.orderItemId` | UNIQUE on `(sourceType, sourceId)` |
| `totalAmount` | frozen at creation (never updated) | the additional cost (may be negative) |
| Initial `notifiedAt` | `null` | `null` |
| Notification | flushed at next `READY_TO_PACKAGE` (any item of the order) | same flush — sent together with BASE |

Notification mechanics (`BillingService.onItemReadyToPackage`):
1. Atomic CTE: claims every `WAITING` row of the order where `notifiedAt IS NULL`, marks them notified.
2. Re-selects the full `WAITING` set (claimed-now ∪ previously-notified) — user-web replaces messages by orderId, so the payload must be the full picture.
3. Emit suppressed when `justClaimedCount === 0`.

Status: `WAITING → PAID | CANCELLED`. Transition is CAS — only `WAITING` rows can move; concurrent pay/cancel: first wins, second sees 0 rows and throws `BillingAlreadyResolvedError`.

`findPendingByCustomerId` filters `notifiedAt IS NOT NULL` — un-flushed rows are never surfaced on reconnect.

Wash-web touches none of this directly, but harness assertions on billing-side effects should match the table above.

---

## ApprovalRequest model

Created by `activate-exception-flow` when the flow requires customer approval. Status: `WAITING → RESOLVED`.

Flow lifecycle:
1. Staff: `raise-issue` → `activate-exception-flow` (flow with approval=✓).
2. Override stack inserted; last override step is `WAIT_CUSTOMER_DECISION`.
3. `approval_request` row created (`WAITING`); customer notified via `exception:approval-requested`.
4. Staff scans override steps until reaching `WAIT_CUSTOMER_DECISION` (stuck).
5. Customer `respond` → status `RESOLVED`, decision recorded, override stack popped/skipped per decision.
6. Server emits `exception:approval-resolved` to both customer room and `wash-staff`.

Decision → side effect (server):

| decision | effect on plan | extra effect |
|---|---|---|
| `APPROVE_REPAIR` / `APPROVE_VENDOR` / `APPROVE_PREMIUM` | advance to next override step | if `extraAmount ≠ 0` → SUPPLEMENT billing |
| `CLEAN_WITHOUT_REPAIR` / `APPROVE_AS_IS` | skip remaining overrides; resume original route | mark exception context resolved |
| `RETURN_WITHOUT_PROCESSING` | skip overrides; end plan | item → `READY_FOR_DELIVERY` |

---

## RouteChangeRequest model

Created by `POST /wash/items/:id/request-route-change`. Status: `PENDING → APPROVED | REJECTED`.

Preconditions checked server-side:
- Item exists and is `SORTED` or `PROCESSING`.
- No other `PENDING` route-change request for this item.
- No active override (`processingState.currentStepSource !== 'OVERRIDE'`).

Approval side effects (atomic per use case, see `ApproveRouteChangeUseCase`):
1. `routeEngine.switchRoute()` — supersede old plan, create new plan for `toRouteCode`.
2. Update `OrderItemOption(groupCodeSnapshot='cleaning_method')` row to the new route's implied cleaning_method (table in [wash-api.md](wash-api.md#route-codes--cleaning_method)).
3. `OrderItem.estimatedMinAmount += additionalCost` (Prisma `increment`).
4. SUPPLEMENT billing row created with `sourceType='ROUTE_CHANGE_REQUEST', sourceId=requestId`. Idempotent.
5. `route_change_requests` → `APPROVED`, `respondedAt` set.
6. Emit `exception:route-change-resolved` to `wash-staff`.

Rejection: status → `REJECTED`, `respondedAt` set, emit `route-change-resolved`. No other side effects.

`additionalCost` is `Int` (no positivity constraint) — negative values represent savings/refund and are valid.

---

## Cross-cutting invariants

These should always hold; harness can assert.

1. `OrderItem.tagBarcode` is unique system-wide once non-null.
2. After successful `assign-route`, `processingState !== null` and `currentStep.status === 'IN_PROGRESS'`.
3. After successful `scan-step` that does not complete the plan, the response's `currentStep.sortOrder` is strictly greater than the prior `currentStep.sortOrder` OR the source changed (`ROUTE ↔ OVERRIDE`).
4. `scan-step` never advances when current step is `WAIT_CUSTOMER_DECISION`.
5. While `processingState.currentStepSource === 'OVERRIDE'`, `request-route-change` is rejected with 409.
6. A SUPPLEMENT billing for the same `(sourceType, sourceId)` cannot be created twice — second call returns the existing row.
7. A BASE billing for the same `orderItemId` cannot be created twice — second call returns the existing row.
8. `billing:created` is emitted at most once per `READY_TO_PACKAGE` trigger; if no new claim was made, the emit is suppressed.
9. `OrderItem.estimatedMinAmount` after N route-change approvals equals `original + Σ additionalCost_i`.
10. Approval and route-change resolved events always carry `orderItemId` — wash-web matches against displayed items by this field.

---

## Client persistence

Zustand store `useAppStore`, persist middleware key `laundry-wash-web-state`. Persisted keys:

| Key | Type | Behavior |
|---|---|---|
| `session` | `StaffSession \| null` | survives reload until logout |
| `lastSearchedOrderId` | `string \| null` | last orderId submitted on order-search; survives reload and nav |

No other client-side persistence. All server data is TanStack Query in-memory cache, dropped on reload.

---

## Realtime hook

`useWashStaffExceptionSocket(accessToken, { onApprovalResolved, onRouteChangeResolved })` in `src/useWashStaffExceptionSocket.ts`.

- Connects on first non-null `accessToken`; disconnects on unmount or token change.
- Single namespace `/exception`.
- Currently used only by `OrderSearchScreen`. Both handlers receive an event with `orderItemId`; the screen refetches if the event matches a displayed item.

---

## Environment

| Var | Default | Used by |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | HTTP base URL in `src/api.ts` |
| `VITE_SOCKET_BASE_URL` | `VITE_API_BASE_URL` − `/api` suffix, fallback `http://localhost:3000` | socket.io base in `useWashStaffExceptionSocket.ts` |

---

## Tests

Vitest, node environment. Run: `npm test`. No DOM, no MSW — only the three highest-ROI seams are pinned.

| File | What it pins | Why |
|---|---|---|
| `src/api.test.ts` | `ApiError` shape (status, message fallback, details), header/method/body construction, non-JSON & empty body handling | Every server-side error reaches the user through this layer; the Korean fallback string is the only thing displayed when the backend omits `message`. |
| `src/domain/item-actions.test.ts` | The five gating predicates above, including the OVERRIDE-blocks-route-change and WAIT_CUSTOMER_DECISION-blocks-scan rules (matches invariants 4 and 5) | These predicates control all conditional buttons in WashItemCard / StepScanScreen. Drift here causes silent UX regressions that backend tests don't catch. |
| `src/domain/route-change.test.ts` | `findOptionByCode`, `buildRepairSelection`, and `computeRouteChangeCost` — including negative `additionalCost`, `cleaning_method=null` (OUTSOURCED_ONLY_CLEANING), RANGE repair price propagation, and the missing-cleaning-group case | `computeRouteChangeCost.additionalCost` is the literal value posted to `request-route-change`. A regression here is a wrong customer bill on approval. |
| `src/components/repair-utils.test.ts` | `calcPrice` for all four `priceType` branches: `FIXED`, `MATRIX`, `RANGE`, `UNIT` — including ceil rounding, `extraUnitQuantity=0`, empty-string inputs, null amounts | Repair price computed client-side and sent as `additionalCost` in route-change requests. Any drift produces a wrong SUPPLEMENT billing amount on customer approval. |

**Out of scope** (intentionally not tested at MVP):
- Component rendering / RTL. Form layouts and styling change frequently; the logic they wrap is already covered above.
- Socket reconnection / handler dispatch. Single hook, single namespace, manually verified during exception flows.
- End-to-end against laundry-api. Backend has its own test suite; the contract between them is the OpenAPI types in `generated/`.

**Rules for adding tests**:
1. New test files go under `src/**/*.test.ts` (picked up by `vitest.config.ts`).
2. Do not add `*.test.tsx` (JSX) without first adding jsdom + RTL to devDependencies — the current config is node-only by design.
3. When adding a new gating predicate, add it to `src/domain/item-actions.ts` (not inline in a component) and extend the predicate table above.
4. When `calcPrice` gains a new `priceType` branch, add a test row for it before the branch lands.
5. Any new money calculation that ends up in a request body must live in `src/domain/` as a pure function and be tested. Do not inline arithmetic that becomes `additionalCost` or any cost-bearing field inside a component.
6. Do not import from `src/components/` into `src/domain/` **except** the `SelectedRepairOption` type and `calcPrice` from `repair-utils.tsx` (these are conceptually domain helpers that currently live under components; do not deepen the coupling further).
