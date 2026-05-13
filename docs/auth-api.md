# Auth API

- Base URL: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Auth type: staff (role `WASH`)
- Header: `Authorization: Bearer {accessToken}`

## Wash Staff Dev Login

`POST /auth/staff/wash/dev-login`

Request:

```json
{ "staffId": "staff-1" }
```

Response:

```json
{
  "accessToken": "jwt-token",
  "staff": {
    "staffId": "staff-1",
    "role": "WASH",
    "displayName": null,
    "phoneNumber": null
  }
}
```

- This app only calls the wash login endpoint. The role is not accepted in the body — the endpoint decides it.
- `accessToken` is persisted to localStorage via `useAppStore` persist middleware.

## Token Rules

- Staff JWT payload: `{ subjectType: "STAFF", staffId, staffRole }`
- The server guard accepts the `WASH` or `ADMIN` role.
- On `401`, clear the stored token and return to the login screen.
- On `403`, show an insufficient-role state.
- Customer tokens cannot be used on wash screens.
