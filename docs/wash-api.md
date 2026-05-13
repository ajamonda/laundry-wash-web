# Wash API

Factory operations. All staff endpoints require `WASH` role (header `Authorization: Bearer {accessToken}`).

Base: `http://localhost:3000`.

## Shared types

```ts
type WashItemView = {
  itemId: string;
  orderId: string;
  catalogItemCode: string;
  displayNameSnapshot: string;
  status: OrderItemStatus;
  location: OrderItemLocation;
  tagBarcode: string | null;
  estimatedMinAmount: number;             // updates on route-change approval
  processingState: CurrentStateView | null;   // null until SORTED
  selectedOptions: SelectedOption[];
  inputs: { inputCode: string; inputValue: string }[];
};

type SelectedOption = {
  groupCode: string;                      // e.g. 'cleaning_method', 'repair'
  optionCode: string;                     // e.g. 'regular_wash', 'premium_wash'
  displayName: string;
  inputValue: string | null;
  quantity: number | null;
};

type CurrentStateView = {
  orderItemId: string;
  planId: string;
  routeCode: string;
  currentStepSource: 'ROUTE' | 'OVERRIDE';
  currentStep: { stepId: string; stepType: string; displayName: string; sortOrder: number; status: 'IN_PROGRESS' | 'COMPLETED' } | null;
  nextStep:    { stepId: string; stepType: string; displayName: string; sortOrder: number } | null;
  isPlanCompleted: boolean;
};
```

## Enums

```
OrderItemStatus:    PICK_UP | TAGGED | SORTED | PROCESSING | READY_TO_PACKAGE | READY_FOR_DELIVERY | ...
OrderItemLocation:  CUSTOMER_PICK_UP | IN_HOUSE | PREMIUM | VENDOR | ...
StepStatus:         IN_PROGRESS | COMPLETED
StepSource:         ROUTE | OVERRIDE
```

## Route codes / `cleaning_method`

The 12 seeded routes (`prisma/seed.ts`). The third column is the `cleaning_method` option code that the route implies — used by route-change approval to update `OrderItemOption`. `–` = route has no `cleaning_method` group.

| code | label | cleaning_method |
|---|---|---|
| `GENERAL_CLOTHES_CLEANING` | 일반 의류 세탁 | `regular_wash` |
| `REPAIR_AND_CLEANING` | 수선 + 일반 세탁 | `regular_wash` |
| `PREMIUM_CLEANING` | 프리미엄 세탁 | `premium_wash` |
| `REPAIR_AND_PREMIUM_CLEANING` | 수선 + 프리미엄 세탁 | `premium_wash` |
| `STANDARD_SHOES_CLEANING` | 신발 세탁 | `regular_wash` |
| `PREMIUM_SHOES_CLEANING` | 프리미엄 신발 세탁 | `premium_wash` |
| `REPAIR_AND_SHOES_CLEANING` | 수선 + 신발 세탁 | `regular_wash` |
| `REPAIR_AND_PREMIUM_SHOES_CLEANING` | 수선 + 프리미엄 신발 세탁 | `premium_wash` |
| `OUTSOURCED_CLEANING` | 외주 수선 + 신발 세탁 | `regular_wash` |
| `OUTSOURCED_PREMIUM_SHOES_CLEANING` | 외주 수선 + 프리미엄 신발 세탁 | `premium_wash` |
| `OUTSOURCED_ONLY_CLEANING` | 외주 세탁 | – |
| `QUICK_LAUNDRY` | 생활 빨래 | `water_wash_high_temperature_dry` |

---

## `GET /wash/bags/:barcode`

- **Auth**: STAFF(WASH)
- **Body**: none
- **Resp**: `{ bagBarcode: string, items: WashItemView[] }`
- **Transitions**: none
- **Idem**: yes (read)

**Errors**

| Code | Condition |
|---|---|
| 404 | bag not found |
| 400 | bag is not at the factory (`status !== TAKE_BACK`) |

---

## `GET /wash/orders/:orderId/items`

- **Auth**: STAFF(WASH)
- **Body**: none
- **Resp**: `{ orderId: string, items: WashItemView[] }`
- **Transitions**: none
- **Idem**: yes (read)

Returns every item in the order, ordered by `createdAt` ascending.

**Errors**

| Code | Condition |
|---|---|
| 404 | order not found |

---

## `POST /wash/items/:id/tag`

- **Auth**: STAFF(WASH)
- **Body**: `{ tagBarcode: string }`
- **Resp**: `WashItemView`
- **Transitions**: item `PICK_UP → TAGGED`
- **Idem**: yes — UNIQUE on `BillingRequestItem.orderItemId`. Repeat call returns the existing item + existing BASE billing row.

**Effects**
- Create BASE `billing_request` for the item with `notifiedAt = null`.

**Errors**

| Code | Condition |
|---|---|
| 409 | `tagBarcode` already used by another item |
| 409 | item is not `PICK_UP` |
| 404 | item not found |

---

## `GET /processing-routes`

- **Auth**: STAFF(WASH)
- **Body**: none
- **Resp**: `ProcessingRoute[]` — filtered to `active=true`
- **Transitions**: none
- **Idem**: yes (read)

```ts
type ProcessingRoute = {
  id: string;
  code: string;                           // see route-codes table above
  displayName: string;
  active: boolean;
  steps: { id: string; stepType: string; displayName: string; sortOrder: number }[];
};
```

---

## `POST /wash/tags/:tagBarcode/assign-route`

- **Auth**: STAFF(WASH)
- **Body**: `{ routeCode: string }`
- **Resp**: `{ item: WashItemView, processingState: CurrentStateView }`
- **Transitions**: item `TAGGED → SORTED`
- **Idem**: no — second call hits the "no active plan exists" guard

**Effects**
- Create `ItemProcessingPlan` (status `ACTIVE`).
- First step `IN_PROGRESS`, source `ROUTE`.

**Errors**

| Code | Condition |
|---|---|
| 404 | no item with that tag |
| 404 | unknown `routeCode` |
| 409 | item is not `TAGGED` |

---

## `GET /wash/tags/:tagBarcode`

- **Auth**: STAFF(WASH)
- **Body**: none
- **Resp**: `WashItemView`
- **Transitions**: none
- **Idem**: yes (read)

**Errors**

| Code | Condition |
|---|---|
| 404 | no item with that tag |

---

## `POST /wash/tags/:tagBarcode/scan-step`

- **Auth**: STAFF(WASH)
- **Body**: none
- **Resp**: `{ item: WashItemView, processingState: CurrentStateView }`
- **Transitions**: item `SORTED → PROCESSING` (first scan) · `PROCESSING → PROCESSING` (intermediate) · `PROCESSING → READY_TO_PACKAGE` (final scan)
- **Idem**: no

**Effects** (always)
- Complete current step; advance to next step in route or override stack.

**Effects** (when `isPlanCompleted` becomes true)
- Item → `READY_TO_PACKAGE`.
- Atomic claim of all `WAITING` billings for this `orderId` where `notifiedAt IS NULL` → emit `billing:created` with the full `WAITING` set to `customer:{customerId}` on `/billing`.
- Emit suppressed when zero new rows claimed.

**Errors**

| Code | Condition |
|---|---|
| 404 | no item with that tag |
| 409 | item is not `SORTED` / `PROCESSING` |
| 409 | current step is not `IN_PROGRESS` |
| 409 | current step is `WAIT_CUSTOMER_DECISION` |
| 409 | item has a `PENDING` route-change request |

---

## `GET /wash/processing-queue`

- **Auth**: STAFF(WASH)
- **Body**: none
- **Resp**: `{ items: ProcessingQueueItem[] }`
- **Transitions**: none
- **Idem**: yes (read)

```ts
type ProcessingQueueItem = {
  itemId: string;
  orderId: string;
  tagBarcode: string | null;
  displayNameSnapshot: string;
  status: 'SORTED' | 'PROCESSING' | 'READY_TO_PACKAGE';
  routeCode: string;
  currentStep: { stepType: string; displayName: string; sortOrder: number; status: string } | null;
  nextStep:    { stepType: string; displayName: string; sortOrder: number } | null;
  isPlanCompleted: boolean;
};
```

Includes only items in `SORTED | PROCESSING | READY_TO_PACKAGE`. Shape differs from `WashItemView` — no `selectedOptions`, no `inputs`, no `estimatedMinAmount`, no `location`.

Used for: `BagScanScreen` nav badges (`SORTED|PROCESSING` count and `READY_TO_PACKAGE` count) and `ProcessingQueueScreen` listing.

---

## `POST /wash/packages`

- **Auth**: STAFF(WASH)
- **Body**: none
- **Resp**: `{ packages: PackageResult[] }`
- **Transitions**: every `READY_TO_PACKAGE` item → `READY_FOR_DELIVERY`
- **Idem**: effectively yes (no-op when nothing is in `READY_TO_PACKAGE`)

```ts
type PackageResult = {
  packageId: string;
  orderId: string;
  items: { itemId: string; tagBarcode: string | null }[];
  createdAt: string;
};
```

- One `ItemPackage` row per order. Items from different orders → separate packages.
- `packages` is `[]` when nothing was in `READY_TO_PACKAGE`.

---

## `GET /catalog/items/:code`

- **Auth**: none
- **Body**: none
- **Resp**: `CatalogItemDetail`
- **Transitions**: none
- **Idem**: yes (read)

Used only by `RouteChangeForm` to read prices. Wash-web only consumes:

- `optionGroups[code='cleaning_method'].options[].prices[0]`
- `optionGroups[code='repair'].options[]` (recurse into `.children`) and each option's `prices[0]`

Price math lives in `src/components/repair-utils.tsx` (`calcPrice` supports `FIXED | RANGE | UNIT | MATRIX`).

**Errors**

| Code | Condition |
|---|---|
| 404 | unknown `code` |
