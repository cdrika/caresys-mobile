# CareSys Mobile

Repository for the CareSys mobile client, separate from the [CareSys backend](https://github.com/cdrika/caresys-backend).

## Current status

This repository now contains an Expo/React Native client for device pairing and agency subscription onboarding: card verification, free trials, module selection and estimates, invoice download/sharing, explicit Stripe payment approval, and owner/member lock notices. Operational care-module screens are not yet implemented. The backend's test-device page remains a separate development helper.

## Run the mobile client

1. Use Node.js 22+ and run `npm ci`.
2. Copy `.env.example` to ignored `.env` and set reachable, trusted **HTTPS** API and web host URLs. The API URL ends in `/mobile/v1`. No secret key belongs in a mobile environment variable.
3. Run `npm start` and open the project in an Expo development client/Expo Go compatible with SDK 58, or run `npm run android` / `npm run ios` with the appropriate device toolchain.
4. Get a pairing code in the app, open browser pairing, sign in to CareSys and approve the code. Mobile credentials expire after 15 minutes and are kept in platform SecureStore.
5. Select an agency. Owners can save a card through Stripe, select modules, issue/share invoices, and approve payment after trial expiry. Other users receive only a locked-account notice when their agency expires.

Run `npm test` for client API/deadline tests and `npm run export:android` to validate the Android JavaScript bundle. Native signed binaries and physical-device testing require Android/iOS tooling. Local loopback URLs are not reachable from a physical phone; use a reachable API hostname and trusted certificate. Never disable TLS validation.

## Trial and payment behavior

The free trial defaults to 30 elapsed days, starting only after server-verified card setup and module selection. No subscription charge occurs during the free period. An explicit owner approval and successful Stripe verification are required to unlock the agency after expiry. Payment provides 30 days of access; there is no automatic renewal. The backend owns the configurable trial policy, invoice calculations, access gate and payment verification.

App checkout opens only `https://checkout.stripe.com/` URLs in the system browser. Tokens never appear in URLs, logs or ordinary app storage. After checkout, tap **Verify completed checkout**; an authenticated API request confirms provider state. Pending checkout references survive app restarts in SecureStore. Invoice PDFs are fetched with bearer authentication into temporary private cache, shared/saved through the device share sheet, then removed from cache.

The Expo CLI's transitive `zod` dependency is overridden to the patched 4.6.6+ release; CLI schema checks and bundle export validate compatibility. `npm install` reports no known vulnerabilities with the committed lockfile.

See [trial and billing integration](docs/trial-billing.md).

## Backend integration

- Mobile API: `/mobile/v1`, served from the dedicated API host.
- Authentication: browser-approved device pairing and scoped bearer tokens, expiring after 15 minutes.
- Store credentials in the platform secure credential store. Never embed backend credentials or shared API secrets in the app.
- The backend owns tenant authorization, business rules, migrations and API deployment.

See [the integration guide](docs/backend-integration.md). The authoritative endpoint contract and JSON fields are maintained in the backend's [mobile API documentation](https://github.com/cdrika/caresys-backend/blob/main/docs/mobile-api.md).

## Local backend

On the development machine, the API runs at `https://127.0.0.1:8443/mobile/v1` and browser approval at `https://localhost:8444/mobile-enrollment`. Loopback URLs refer to the device making the request; a physical phone needs a reachable development hostname and a matching trusted TLS certificate. These addresses are configuration, not production defaults.

To exercise the flow without a native app, open the backend's development-only test device at `https://127.0.0.1:8443/mobile/v1/pairing/test-device`.
