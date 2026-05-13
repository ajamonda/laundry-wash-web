# Exception & Route Change API

Three sub-flows wash-web drives + the staff `/exception` WebSocket. All staff endpoints: `Authorization: Bearer {accessToken}` (`WASH`).

Base: `http://localhost:3000`.

## Enums

```
IssueType:        REPAIR_REQUIRED | VENDOR_REQUIRED | PREMIUM_REQUIRED | REWASH_REQUIRED
                | DAMAGE_RISK | STAIN_REMOVAL_FAILED | PAYMENT_PENDING

FlowCode:         REPAIR_APPROVAL_FLOW | ADDITIONAL_REPAIR_FLOW
                | VENDOR_APPROVAL_FLOW | ADDITIONAL_VENDOR_FLOW
                | PREMIUM_APPROVAL_FLOW
                | DAMAGE_RISK_APPROVAL_FLOW
                | STAIN_REMOVAL_FAILED_FLOW
                | REWASH_FLOW

ApprovalDecision: APPROVE_REPAIR | APPROVE_VENDOR | APPROVE_PREMIUM
                | CLEAN_WITHOUT_REPAIR | APPROVE_AS_IS
                | RETURN_WITHOUT_PROCESSING

RequestStatus:    WAITING (approval) | PENDING (route change) → RESOLVED | APPROVED | REJECTED
```

## FlowCode → approval / approval flow

| flowCode | needs approval | first override step | last override step |
|---|---|---|---|
| `REPAIR_APPROVAL_FLOW` | ✓ | repair estimate | `WAIT_CUSTOMER_DECISION` |
| `ADDITIONAL_REPAIR_FLOW` | ✓ | repair estimate | `WAIT_CUSTOMER_DECISION` |
| `VENDOR_APPROVAL_FLOW` | ✓ | vendor estimate | `WAIT_CUSTOMER_DECISION` |
| `ADDITIONAL_VENDOR_FLOW` | ✓ | vendor estimate | `WAIT_CUSTOMER_DECISION` |
| `PREMIUM_APPROVAL_FLOW` | ✓ | premium estimate | `WAIT_CUSTOMER_DECISION` |
| `DAMAGE_RISK_APPROVAL_FLOW` | ✓ | damage assessment | `WAIT_CUSTOMER_DECISION` |
| `STAIN_REMOVAL_FAILED_FLOW` | ✓ | stain assessment | `WAIT_CUSTOMER_DECISION` |
| `REWASH_FLOW` | ✗ | rewash step | rewash final step |

## ApprovalDecision → server effect

| decision | plan effect | extra side effect |
|---|---|---|
| `APPROVE_REPAIR` | advance to next override step | if `extraAmount ≠ 0` → SUPPLEMENT billing |
| `APPROVE_VENDOR` | advance to next override step | if `extraAmount ≠ 0` → SUPPLEMENT billing |
| `APPROVE_PREMIUM` | advance to next override step | if `extraAmount ≠ 0` → SUPPLEMENT billing |
| `CLEAN_WITHOUT_REPAIR` | skip remaining overrides, resume route | mark `ItemExceptionContext` resolved |
| `APPROVE_AS_IS` | skip remaining overrides, resume route | mark `ItemExceptionContext` resolved |
| `RETURN_WITHOUT_PROCESSING` | skip overrides, end plan; item → `READY_FOR_DELIVERY` | mark `ItemExceptionContext` resolved |

---

## `POST /wash/items/:id/raise-issue`

- **Auth**: STAFF(WASH)
- **Body**: `{ issueType: IssueType, note?: string }`
- **Resp**: `IssueResult`
- **Transitions**: none
- **Idem**: no — every call appends an `item_issues` row

```ts
type IssueResult = {
  id: string;
  orderItemId: string;
  issueType: IssueType;
  note: string | null;
  raisedBy: string;        // staffId
  createdAt: string;
};
```

**Effects**
- Insert `item_issues` row.
- Audit log entry.
- No processing-state change.

`ExceptionForm` always calls this immediately before `activate-exception-flow`.

**Errors**

| Code | Condition |
|---|---|
| 404 | item not found |
| 400 | invalid `issueType` |

---

## `POST /wash/items/:id/activate-exception-flow`

- **Auth**: STAFF(WASH)
- **Body**: `{ flowCode: FlowCode, additionalCost?: number }` (`additionalCost ≥ 0`, integer)
- **Resp**: `CurrentStateView` with `currentStepSource: 'OVERRIDE'`
- **Transitions**: `processingState.currentStepSource: ROUTE → OVERRIDE`
- **Idem**: no

**Effects**
- Insert override steps from the flow template after the current route step.
- Set first override step `IN_PROGRESS`.
- If flow requires approval: create `approval_request` (status `WAITING`); emit `exception:approval-requested` to `customer:{customerId}` on `/exception`.

**Errors**

| Code | Condition |
|---|---|
| 404 | unknown `flowCode` |
| 404 | item not found |
| 409 | item is not `SORTED` / `PROCESSING` |
| 409 | item already has an active override |
| 409 | item has a `PENDING` route-change request |

---

## Override progression (no dedicated endpoint)

Override steps advance through the **same** `POST /wash/tags/:tagBarcode/scan-step` as route steps. Distinguishing rules for the harness:

- `processingState.currentStepSource === 'OVERRIDE'` while the override stack is non-empty.
- `scan-step` returns 409 when `currentStep.stepType === 'WAIT_CUSTOMER_DECISION'` — only a customer `respond` advances it.
- After the last override step, source returns to `ROUTE`; next `scan-step` resumes the original route at the step after the one where the override was inserted.

Customer respond endpoint (called by user-web): `POST /wash/approval-requests/:id/respond` with body `{ decision: ApprovalDecision, extraAmount?: number }`.

Server effects on customer respond:
1. `approval_request.status: WAITING → RESOLVED`, `decision`, `resolvedAt`.
2. Plan effect per decision table above.
3. If decision is approve-* with `extraAmount ≠ 0` → create SUPPLEMENT billing.
4. If plan ends → item `READY_FOR_DELIVERY`.
5. Emit `exception:approval-resolved` to `customer:{customerId}` AND `wash-staff`.

---

## `POST /wash/items/:id/request-route-change`

- **Auth**: STAFF(WASH)
- **Body**: `{ toRouteCode: string, additionalCost?: number, reason: string }`
- **Resp**: `RouteChangeRequestView`
- **Transitions**: none on item; creates `route_change_request` row in `PENDING`
- **Idem**: no

```ts
type RouteChangeRequestView = {
  id: string;
  orderItemId: string;
  fromRouteCode: string;        // server snapshots current routeCode
  toRouteCode: string;
  additionalCost: number | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;          // staffId
  createdAt: string;
};
```

**Validation** (DTO `request-route-change.dto.ts`)

| field | rule |
|---|---|
| `toRouteCode` | `@IsString()` |
| `additionalCost` | `@IsOptional() @IsInt()` — **may be negative** (savings/refund) |
| `reason` | `@IsString() @MinLength(1)` |

**Effects**
- Insert `route_change_request` row, `status='PENDING'`.
- Emit `exception:route-change-requested` to `customer:{customerId}` on `/exception`.

**Errors**

| Code | Condition |
|---|---|
| 404 | item not found |
| 409 | item is not `SORTED` / `PROCESSING` |
| 409 | another `PENDING` route-change request exists for this item |
| 409 | item has an active override (`currentStepSource === 'OVERRIDE'`) |
| 400 | DTO validation failure |

### Customer approve (`POST /wash/route-change-requests/:id/approve`)

Atomic side-effect sequence (`ApproveRouteChangeUseCase`):

1. `routeEngine.switchRoute()` — supersede the active plan, create a new plan for `toRouteCode`, set its first step `IN_PROGRESS`.
2. If the new route has a `cleaning_method` (see [wash-api.md](wash-api.md#route-codes--cleaning_method)): update the matching `OrderItemOption(groupCodeSnapshot='cleaning_method')` row's `catalogOptionId`, `optionCodeSnapshot`, `displayNameSnapshot` to the new option.
3. If `additionalCost ≠ 0`:
   - `OrderItem.estimatedMinAmount += additionalCost` (Prisma `increment` — negative OK).
   - Create SUPPLEMENT `billing_request` with `sourceType='ROUTE_CHANGE_REQUEST', sourceId=requestId, notifiedAt=null`. **Idempotent** on `(sourceType, sourceId)`.
4. `route_change_request.status: PENDING → APPROVED`, `respondedAt` set.
5. Emit `exception:route-change-resolved` to `wash-staff` with `{ requestId, orderItemId, status: 'APPROVED' }`.

### Customer reject (`POST /wash/route-change-requests/:id/reject`)

1. `route_change_request.status: PENDING → REJECTED`, `respondedAt` set.
2. Emit `exception:route-change-resolved` to `wash-staff` with `status: 'REJECTED'`.

No other side effects on reject (no plan change, no billing, no option update).

---

## WebSocket (`/exception`, staff)

Connect: `io('/exception', { auth: { token: 'Bearer {accessToken}' }, transports: ['websocket'] })`.

Server connection handling (`ExceptionGateway.handleConnection`):

| principal | room |
|---|---|
| `subjectType=CUSTOMER` | `customer:{customerId}` |
| `subjectType=STAFF && staffRole=WASH` | `wash-staff` |
| anything else | disconnect |

Events delivered to `wash-staff`:

### `exception:approval-resolved`

```ts
{
  approvalRequestId: string;
  decision: ApprovalDecision;
  orderItemId: string;
}
```

Triggered by: customer `respond`. Also delivered to `customer:{customerId}` for the user-web.

### `exception:route-change-resolved`

```ts
{
  routeChangeRequestId: string;
  orderItemId: string;
  status: 'APPROVED' | 'REJECTED';
}
```

Triggered by: customer approve or reject.

### Consumer

`useWashStaffExceptionSocket(accessToken, handlers)` — `src/useWashStaffExceptionSocket.ts`.

Currently used only by `OrderSearchScreen`: when an event's `orderItemId` matches any item currently displayed in the order, the screen invalidates the `['order-items', orderId]` query.

Harness can rely on `orderItemId` always being present in both events.
