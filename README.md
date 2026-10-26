# CareSys Mobile

Repository for the CareSys mobile client, separate from the [CareSys backend](https://github.com/cdrika/caresys-backend).

## Current status

This initial commit contains integration documentation and repository configuration. A native mobile application has not yet been implemented, and no mobile framework has been selected. The backend's local test-device page is a development helper; it is not native app source.

## Backend integration

- Mobile API: `/mobile/v1`, served from the dedicated API host.
- Authentication: browser-approved device pairing and scoped bearer tokens, expiring after 15 minutes.
- Store credentials in the platform secure credential store. Never embed backend credentials or shared API secrets in the app.
- The backend owns tenant authorization, business rules, migrations and API deployment.

See [the integration guide](docs/backend-integration.md). The authoritative endpoint contract and JSON fields are maintained in the backend's [mobile API documentation](https://github.com/cdrika/caresys-backend/blob/main/docs/mobile-api.md).

## Local backend

On the development machine, the API runs at `https://127.0.0.1:8443/mobile/v1` and browser approval at `https://localhost:8444/mobile-enrollment`. Loopback URLs refer to the device making the request; a physical phone needs a reachable development hostname and a matching trusted TLS certificate. These addresses are configuration, not production defaults.

To exercise the flow without a native app, open the backend's development-only test device at `https://127.0.0.1:8443/mobile/v1/pairing/test-device`.
