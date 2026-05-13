# Wash Web Overview

SPA for factory operators (staff). Built with React + Vite, TanStack Query, Zustand, and socket.io-client.

## Actor

- Auth: staff
- Role: `WASH` (server-side guard also allows `ADMIN`)
- Login: `POST /auth/staff/wash/dev-login` ({ staffId })

## Screens

| Step | Component | Entry |
|---|---|---|
| `login` | `LoginScreen` | Unauthenticated |
| `bag-scan` | `BagScanScreen` | Home after login |
| `bag-items` | `BagItemsScreen` | After scanning a bag |
| `order-search` | `OrderSearchScreen` | Top nav |
| `queue` | `ProcessingQueueScreen` | Top nav |
| `step-scan` | `StepScanScreen` | Top nav |
| `packaging` | `PackagingScreen` | Top nav |

Top nav: `Bag Scan / Order Search / Processing Queue / Step Scan / Packaging`. Rendered by `AppChrome`.

## Core Flows

### 1. Bag scan → tagging → route assignment

1. On `bag-scan`, enter the pickup-bag barcode → `GET /wash/bags/:barcode`
2. `bag-items` lists item cards in the bag (`WashItemCard`)
3. Actions per status:
   - `PICK_UP`: attach tag → `POST /wash/items/:id/tag` (→ `TAGGED`; a BASE billing row is created at this moment but not notified yet)
   - `TAGGED`: assign route → `POST /wash/tags/:tagBarcode/assign-route` (→ `SORTED`)

### 2. Processing (step scan)

- On `step-scan`, enter a tag barcode → `GET /wash/tags/:tagBarcode` to look up the item
- `POST /wash/tags/:tagBarcode/scan-step` completes the current step and advances to the next
- When `isPlanCompleted = true`, the item becomes `READY_TO_PACKAGE` and billing notifications are flushed at once (all unnotified BASE/SUPPLEMENT billings for the order are sent together)

### 3. Exception handling

The "Exception" button appears on inspection steps (`INSPECTING`, `RE_INSPECTION`, `PREMIUM_INSPECTING`).

- `ExceptionForm` calls `POST /wash/items/:id/raise-issue` then `POST /wash/items/:id/activate-exception-flow`
- Flows that require customer approval pause at the `WAIT_CUSTOMER_DECISION` step
- See `exception-api.md`

### 4. Route change

The "Change route" button is shown for `SORTED`/`PROCESSING` items (hidden during an active override).

- `RouteChangeForm`: pick laundry item → pick new route → (for repair routes) pick repair options → enter reason
- The form reads `cleaning_method` / `repair` option prices from the catalog (`GET /catalog/items/:code`) and computes the additional cost automatically (negative allowed — savings)
- `POST /wash/items/:id/request-route-change` → awaits customer approval
- On approval, backend: updates `OrderItemOption.cleaning_method`, adjusts `OrderItem.estimatedMinAmount`, and creates a supplement billing row

### 5. Packaging

- `packaging` screen calls `POST /wash/packages`
- Groups all `READY_TO_PACKAGE` items by order into `ItemPackage` records → items move to `READY_FOR_DELIVERY`

### 6. Order search

Look up all items in an order by orderId. `GET /wash/orders/:orderId/items` → reuses the same `WashItemCard` UI as the bag-items screen. The last searched orderId persists in the Zustand store (localStorage). On mount, the screen connects to the `/exception` namespace with the staff JWT so the view auto-refreshes when the customer approves/rejects a pending request.

## State Management

- **Auth**: `useAppStore` (zustand + persist) — `session`, `lastSearchedOrderId`
- **Server state**: TanStack Query — every API call

## Realtime

`useWashStaffExceptionSocket` connects to the `/exception` namespace with the staff JWT.

- Server: staff (WASH) clients join the `wash-staff` room
- Subscribed events:
  - `exception:approval-resolved` (customer responded to an approval request)
  - `exception:route-change-resolved` (customer responded to a route change request)
- Used today by `OrderSearchScreen`. If a matching item is currently displayed, the screen refetches automatically.

## Component Reuse

- `WashItemCard`: a single item card — status badge, current/next step, selected options, and status-aware action buttons (attach tag, assign route, raise exception, request route change). Shared by `BagItemsScreen` and `OrderSearchScreen`.
- `ExceptionForm`: issue + flow activation
- `RouteChangeForm`: route change request
- `ItemDetailsSection`: shows selected options and input values
- `repair-utils`: repair option picker and pricing utilities (`calcPrice`, `RepairOptionPicker`, `SelectedRepairOption`)

## Environment Variables

- `VITE_API_BASE_URL`: backend base URL (default `/api`)
- `VITE_SOCKET_BASE_URL`: WebSocket base URL (defaults to `VITE_API_BASE_URL` with trailing `/api` stripped; falls back to `http://localhost:3000`)
