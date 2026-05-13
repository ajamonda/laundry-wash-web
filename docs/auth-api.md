# Auth API

Base: `http://localhost:3000` · Swagger: `/docs`.

## `POST /auth/staff/wash/dev-login`

- **Auth**: none
- **Body**: `{ staffId: string }`
- **Resp**: `StaffSession`
- **Transitions**: none
- **Idem**: yes (login is repeatable; no server-side state created)

```ts
type StaffSession = {
  accessToken: string;            // JWT
  staff: {
    staffId: string;
    role: 'WASH';                 // endpoint-locked
    displayName: string | null;
    phoneNumber: string | null;
  };
};
```

JWT payload (decoded server-side): `{ subjectType: 'STAFF', staffId, staffRole: 'WASH' }`.

**Errors**

| Code | Condition |
|---|---|
| 404 | Staff with `staffId` not found |
| 403 | Staff exists but role is not `WASH` |

## Token usage

Every other request: header `Authorization: Bearer {accessToken}`.

| Server response | Client action |
|---|---|
| 401 | clear `useAppStore.session`, route to login |
| 403 | clear `useAppStore.session`, route to login |

- Server guard accepts roles `WASH` and `ADMIN`.
- Customer tokens are rejected on wash endpoints (treated as 403).
- No refresh endpoint exists — token expiry path is logout + re-login.

## Persistence

`accessToken` stored in `useAppStore.session` via zustand persist middleware (localStorage key `laundry-wash-web-state`). Survives reload until explicit logout.
