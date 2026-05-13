# Wash API

Endpoints for factory operations. All require staff (WASH) authentication.

- Base URL: `http://localhost:3000`
- Header: `Authorization: Bearer {accessToken}`

`WashItemView` (the common item shape returned by most endpoints):

```ts
{
  itemId, orderId, catalogItemCode, displayNameSnapshot,
  status,                          // PICK_UP | TAGGED | SORTED | PROCESSING | READY_TO_PACKAGE | READY_FOR_DELIVERY ...
  location,                        // IN_HOUSE | PREMIUM | VENDOR ...
  tagBarcode,
  estimatedMinAmount,
  processingState: CurrentStateView | null,
  selectedOptions: { groupCode, optionCode, displayName, inputValue, quantity }[],
  inputs: { inputCode, inputValue }[],
}
```

`CurrentStateView`:

```ts
{
  orderItemId, planId, routeCode,
  currentStepSource: 'ROUTE' | 'OVERRIDE',
  currentStep: { stepId, stepType, displayName, sortOrder, status } | null,
  nextStep:    { stepId, stepType, displayName, sortOrder }         | null,
  isPlanCompleted: boolean,
}
```

---

## Get Bag Contents

`GET /wash/bags/:barcode`

Open a pickup bag and list the items it contains.

```json
{
  "bagBarcode": "BAG-001",
  "items": [ /* WashItemView[] */ ]
}
```

Errors:
- `404` bag not found
- `400` bag is not at the factory (`TAKE_BACK`)

---

## Get Order Items

`GET /wash/orders/:orderId/items`

List all items in an order. Used by the order search screen.

```json
{
  "orderId": "order-id",
  "items": [ /* WashItemView[] */ ]
}
```

---

## Attach Tag

`POST /wash/items/:id/tag`

`PICK_UP` → `TAGGED`. A BASE billing row is created at the same moment, but the customer is not notified yet — notification is flushed when the item reaches `READY_TO_PACKAGE`.

```json
{ "tagBarcode": "TAG-0001" }
```

Errors: `409` duplicate tag or wrong item status.

---

## List Processing Routes

`GET /processing-routes`

Active routes. Used by the route-assignment select.

```json
[
  {
    "id": "...",
    "code": "GENERAL_CLOTHES_CLEANING",
    "displayName": "General Clothing Wash",
    "active": true,
    "steps": [
      { "id": "...", "stepType": "WASHING", "displayName": "Wash", "sortOrder": 100 },
      { "id": "...", "stepType": "AIR_DRYING", "displayName": "Air Dry", "sortOrder": 200 },
      ...
    ]
  }
]
```

Currently seeded route codes (12):

| code | description |
|---|---|
| `GENERAL_CLOTHES_CLEANING` | General clothing wash |
| `REPAIR_AND_CLEANING` | Repair + general wash |
| `PREMIUM_CLEANING` | Premium wash |
| `REPAIR_AND_PREMIUM_CLEANING` | Repair + premium wash |
| `STANDARD_SHOES_CLEANING` | Shoe wash |
| `PREMIUM_SHOES_CLEANING` | Premium shoe wash |
| `REPAIR_AND_SHOES_CLEANING` | Repair + shoe wash |
| `REPAIR_AND_PREMIUM_SHOES_CLEANING` | Repair + premium shoe wash |
| `OUTSOURCED_CLEANING` | Outsourced repair + shoe wash |
| `OUTSOURCED_PREMIUM_SHOES_CLEANING` | Outsourced repair + premium shoe wash |
| `OUTSOURCED_ONLY_CLEANING` | Outsourced wash (tents, etc.) |
| `QUICK_LAUNDRY` | Quick laundry |

---

## Assign Route

`POST /wash/tags/:tagBarcode/assign-route`

`TAGGED` → `SORTED`. Creates an `ItemProcessingPlan` and sets the first step to `IN_PROGRESS`.

```json
{ "routeCode": "GENERAL_CLOTHES_CLEANING" }
```

Response: `{ item: WashItemView, processingState: CurrentStateView }`

---

## Find Item by Tag

`GET /wash/tags/:tagBarcode`

Search by tag barcode (used by step-scan). Returns `WashItemView`.

---

## Scan Step

`POST /wash/tags/:tagBarcode/scan-step`

Complete the current step and advance to the next.

- If `currentStepSource: 'OVERRIDE'`, advances the exception flow step.
- The `WAIT_CUSTOMER_DECISION` step cannot be completed by staff scan — only by customer action.
- When `isPlanCompleted = true`, the item moves to `READY_TO_PACKAGE` and a single batched billing notification is emitted (all unnotified BASE/SUPPLEMENT billings for the order).

Response: `{ item: WashItemView, processingState: CurrentStateView }`

Errors: `409` wrong status, current step not in progress, awaiting customer decision, pending route change, etc.

---

## Processing Queue

`GET /wash/processing-queue`

All items currently in `SORTED`, `PROCESSING`, or `READY_TO_PACKAGE`.

```json
{
  "items": [
    {
      "itemId", "orderId", "tagBarcode", "displayNameSnapshot",
      "status", "routeCode",
      "currentStep": { ... } | null,
      "nextStep": { ... } | null,
      "isPlanCompleted": false
    }
  ]
}
```

Also drives the home-screen nav badges (`SORTED|PROCESSING` count and `READY_TO_PACKAGE` count).

---

## Create Packages

`POST /wash/packages`

Group every `READY_TO_PACKAGE` item by order into an `ItemPackage`. Packaged items advance to `READY_FOR_DELIVERY`.

Response:

```json
{
  "packages": [
    {
      "packageId": "...",
      "orderId": "...",
      "items": [ { "itemId", "tagBarcode" }, ... ],
      "createdAt": "..."
    }
  ]
}
```

If there is nothing to package, `packages` is an empty array.

---

## Catalog (reference)

`GET /catalog/items/:code` — used by the route change form to look up `cleaning_method` / `repair` options and their prices. No auth required.
