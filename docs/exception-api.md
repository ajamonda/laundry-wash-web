# Exception & Route Change API

Exception flow activation, route change, and the WebSocket events staff clients consume.

- Base URL: `http://localhost:3000`
- Header: `Authorization: Bearer {accessToken}`
- Auth: staff (WASH) for most endpoints. A few are customer-authenticated and listed only for reference.

---

## 1. Raise Issue

`POST /wash/items/:id/raise-issue` (staff)

Record an issue on an item. Does not change processing state — only writes an audit log entry and an `item_issues` row.

```json
{ "issueType": "REPAIR_REQUIRED", "note": "Seam torn on the sleeve" }
```

`issueType`: `REPAIR_REQUIRED` · `VENDOR_REQUIRED` · `PREMIUM_REQUIRED` · `REWASH_REQUIRED` · `DAMAGE_RISK` · `STAIN_REMOVAL_FAILED` · `PAYMENT_PENDING`

`ExceptionForm` calls this immediately before activating a flow.

---

## 2. Activate Exception Flow

`POST /wash/items/:id/activate-exception-flow` (staff)

Insert the template's steps as overrides after the current route step. If the flow requires customer approval, an `approval_request` is created and the customer is notified over WebSocket.

```json
{ "flowCode": "REPAIR_APPROVAL_FLOW", "additionalCost": 5000 }
```

| flowCode | description | customer approval |
|---|---|---|
| `REPAIR_APPROVAL_FLOW` | Repair approval | ✓ |
| `ADDITIONAL_REPAIR_FLOW` | Additional repair approval | ✓ |
| `VENDOR_APPROVAL_FLOW` | Vendor approval | ✓ |
| `ADDITIONAL_VENDOR_FLOW` | Additional vendor approval | ✓ |
| `PREMIUM_APPROVAL_FLOW` | Premium approval | ✓ |
| `DAMAGE_RISK_APPROVAL_FLOW` | Damage-risk confirmation | ✓ |
| `STAIN_REMOVAL_FAILED_FLOW` | Stain-removal failure confirmation | ✓ |
| `REWASH_FLOW` | Rewash (no approval) | ✗ |

Response: `CurrentStateView` with `currentStepSource: 'OVERRIDE'`.

Errors:
- `404` unknown flowCode
- `409` item is not in `SORTED`/`PROCESSING`

---

## 3. Progressing Through the Flow

Active override steps are advanced through the same scan-step endpoint as normal route steps (`POST /wash/tags/:tagBarcode/scan-step`).

The `WAIT_CUSTOMER_DECISION` step is not advanced by staff scan. It is completed when the customer calls `POST /wash/approval-requests/:id/respond`.

After the customer decision:
- `APPROVE_*` → advance to the next override step
- `CLEAN_WITHOUT_REPAIR` / `APPROVE_AS_IS` → skip remaining overrides and resume the original route
- `RETURN_WITHOUT_PROCESSING` → skip remaining overrides; processing ends

---

## 4. Request Route Change

`POST /wash/items/:id/request-route-change` (staff)

A staff member requests a route change; customer approval is required. The item must be in `SORTED`/`PROCESSING` and must have no pending route-change request and no active override.

```json
{
  "toRouteCode": "PREMIUM_CLEANING",
  "additionalCost": 3000,
  "reason": "Customer follow-up request"
}
```

- `additionalCost` is optional. Negative values are allowed (savings/refund).
- The frontend reads `cleaning_method` prices from the catalog (`GET /catalog/items/:code`) and computes `(new total) - estimatedMinAmount` automatically.

Response:

```json
{
  "id": "request-uuid",
  "orderItemId": "...",
  "fromRouteCode": "GENERAL_CLOTHES_CLEANING",
  "toRouteCode": "PREMIUM_CLEANING",
  "additionalCost": 3000,
  "reason": "...",
  "status": "PENDING",
  "requestedBy": "staff-1",
  "createdAt": "..."
}
```

On customer approval the backend:
- Calls `routeEngine.switchRoute()` to activate the new route's plan
- Updates the `OrderItemOption.cleaning_method` row to match the new route
- Adjusts `OrderItem.estimatedMinAmount` by `additionalCost`
- Creates a supplement billing row (notifiedAt = null) — the notification is flushed together with the BASE billing when the item reaches `READY_TO_PACKAGE`

---

## 5. WebSocket (staff)

`useWashStaffExceptionSocket` connects to the `/exception` namespace with the staff JWT. The server verifies the staff (WASH) token and joins the socket to the `wash-staff` room.

Subscribed events:

### `exception:approval-resolved`

Customer responded to an exception approval request.

```json
{
  "approvalRequestId": "...",
  "decision": "APPROVE_REPAIR",
  "orderItemId": "..."
}
```

### `exception:route-change-resolved`

Customer approved or rejected a route change request.

```json
{
  "routeChangeRequestId": "...",
  "orderItemId": "...",
  "status": "APPROVED"
}
```

Current consumer: `OrderSearchScreen`. If a displayed item matches the event, the screen refetches automatically.

---

## Customer-side Endpoints (reference)

These are not called by wash-web, but are listed to make the flow easier to reason about.

- `POST /wash/approval-requests/:id/respond` — customer submits an exception-flow decision
- `POST /wash/route-change-requests/:id/approve` — customer approves a route change
- `POST /wash/route-change-requests/:id/reject` — customer rejects a route change
