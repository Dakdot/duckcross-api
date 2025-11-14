# Authentication (Login) — Client Guide

This document explains how to authenticate with the DuckCross API (login strategy) and how to use the tokens returned by the server.

Base path

- All auth endpoints are mounted under: `/v1/auth`

Summary

- Login: POST `/v1/auth/login` — exchange email/password for an access token; server also sets a refresh cookie.
- Register: POST `/v1/auth/register` — create an account (behaves like login: returns access token + sets refresh cookie).
- Refresh: POST `/v1/auth/refresh` — exchange the refresh cookie for a new access token.
- Current user: GET `/v1/auth/` — returns the user for a valid access token (sent in Authorization header).

Concepts & token lifecycle

- Access token: a short-lived JSON Web Token (JWT). Expires in ~30 minutes. Returned in the JSON response (field `accessToken`).
- Refresh token: a long-lived JWT stored as an HTTP-only cookie named `DC_REFRESH_TOKEN`. Expires in ~30 days. The cookie path is `/v1/auth/refresh`.
- Strategy: client authenticates with email + password to receive an `accessToken` and the server sets the refresh cookie. Use the `accessToken` in the Authorization header for protected endpoints. When the `accessToken` expires, call the refresh endpoint (the browser will send the refresh cookie) to get a new `accessToken`.

Authentication flows (client responsibilities)

1. Login (first-party web or native app)

- Request

  POST /v1/auth/login

  Request body (JSON):

  {
  "email": "user@example.com",
  "password": "correct-horse-battery-staple"
  }

- Response (success: 200)

  - JSON body contains:

    {
    "message": "Log in was successful.",
    "user": { /_ user object without password/refreshToken _/ },
    "accessToken": "<JWT here>"
    }

  - Server also sets an HTTP-only cookie:

    Set-Cookie: DC_REFRESH_TOKEN=<refresh-jwt>; HttpOnly; Path=/v1/auth/refresh; Max-Age=2592000; SameSite=Strict; Secure (in production)

- Client notes

  - In browsers: use fetch/axios with credentials included so the refresh cookie is accepted and stored. Example: fetch(url, { credentials: 'include' }).
  - Store the `accessToken` in memory (recommended) or in a secure storage mechanism for your platform. Avoid storing it in localStorage if you want to reduce exposure to XSS.
  - Use the access token in subsequent requests as an Authorization header: `Authorization: Bearer <accessToken>`.

2. Using protected endpoints

- Include the access token in the Authorization header on requests that require authentication.

  Example header:

  Authorization: Bearer <accessToken>

- If the server responds with 401 (invalid credentials) or you detect the access token is expired, call the refresh endpoint.

3. Refreshing the access token

- Endpoint

  POST /v1/auth/refresh

- Request

  - No JSON body required. The server expects the refresh cookie (`DC_REFRESH_TOKEN`) to be sent.
  - In browsers, call with credentials so the cookie is included: fetch('/v1/auth/refresh', { method: 'POST', credentials: 'include' }).

- Response (success: 200)

  {
  "message": "New access token created.",
  "accessToken": "<new JWT>"
  }

- Client notes

  - The refresh cookie is HTTP-only so JavaScript cannot read it. This is intentional for security. The browser will attach it automatically for same-site requests if `credentials: 'include'` is used.
  - Cookie attributes: `HttpOnly`, `SameSite=Strict`, `Path=/v1/auth/refresh`, `Max-Age=30 days`, `Secure` when running in production. Because of `SameSite=Strict`, cross-site fetches will not include the cookie; refresh flow should be performed from the same origin.

4. Register (create account)

- Endpoint: POST /v1/auth/register
- Request body: same shape as login (email and password).
- Response: returns `accessToken`, sets the same refresh cookie, and returns the created `user` object.

5. Get current user

- Endpoint: GET /v1/auth/
- Authorization: requires header `Authorization: Bearer <accessToken>`.
- Response: user object (no password or refreshToken fields).

Errors and status codes (common)

- 200 — success (login/register/refresh returned accessToken)
- 400 — bad request (missing fields or missing refresh cookie)
- 401 — invalid credentials (wrong email or password), or missing/invalid Authorization header for protected endpoints
- 404 — user not found (for get-current-user)
- 500 — internal server error

Client examples

1. Browser `fetch` example — login

```js
const resp = await fetch("/v1/auth/login", {
  method: "POST",
  credentials: "include", // important: accept and send cookies
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

const data = await resp.json();
if (resp.ok) {
  const accessToken = data.accessToken;
  // store in memory and use for Authorization header
}
```

2. Browser `fetch` example — refresh

```js
const resp = await fetch("/v1/auth/refresh", {
  method: "POST",
  credentials: "include", // sends DC_REFRESH_TOKEN cookie to server
});
const data = await resp.json();
if (resp.ok) {
  const newAccessToken = data.accessToken;
}
```

3. cURL example (non-browser clients / testing)

# Log in and save cookies to a cookiejar

curl -i -c cookiejar -X POST -H "Content-Type: application/json" \
 -d '{"email":"user@example.com","password":"hunter2"}' \
 https://api.example.com/v1/auth/login

# Then refresh using saved cookies

curl -i -b cookiejar -X POST https://api.example.com/v1/auth/refresh

Security recommendations (client)

- Keep the access token in memory where possible; refresh tokens are stored in HTTP-only cookies on purpose to reduce XSS exposure.
- Try to avoid storing access tokens in localStorage. If you must persist them across reloads (e.g., native apps), use secure storage recommended for the platform.
- On 401 responses, attempt a silent refresh (POST /v1/auth/refresh). If refresh fails, redirect the user to the login screen.

Notes for integrators

- The server sets the refresh cookie with path `/v1/auth/refresh`. Ensure your refresh request is sent to exactly that path on the same origin so the browser will attach the cookie.
- Cookies will be sent only for same-site requests because of `SameSite=Strict`; cross-origin clients will need to coordinate auth differently (for example, through a backend-for-frontend approach).

Contact

If anything is unclear or you need example client code for a particular platform (React, React Native, Android, iOS), ask and we'll produce it.
