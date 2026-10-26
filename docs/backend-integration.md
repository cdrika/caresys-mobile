# Backend integration

The backend lives in [cdrika/caresys-backend](https://github.com/cdrika/caresys-backend). Keep mobile release/build configuration and platform UI here; maintain API authorization and domain rules in the backend.

## Device authentication

1. POST JSON `{"device_name":"My phone"}` to `/mobile/v1/pairing/requests`, without cookies or Authorization. The response's `data` contains `device_code`, `user_code`, `verification_uri`, `expires_in` and `interval`.
2. Keep `device_code` private. Display `user_code` on the device and open `verification_uri` in the system browser. The user enters the actual code, reviews the device, signs in and confirms their password. Pairing requests expire in five minutes.
3. Poll `/mobile/v1/pairing/token` with JSON `{"device_code":"<private device code>"}` no more frequently than the returned interval (currently five seconds). HTTP 428 with `AUTHORIZATION_PENDING` means continue waiting. Honor HTTP 429 and Retry-After; handle expiry by starting a new request.
4. Successful one-time redemption returns `data.access_token`, `token_type: Bearer`, and `expires_in: 900`. Store the credential in the platform secure store. Use `Authorization: Bearer <access_token>` for protected requests and omit cookies.
5. On logout call `DELETE /mobile/v1/auth/token`, then clear the stored credential. Handle revocation or expiry by pairing again. There is currently no refresh-token endpoint.

## API conventions

Use HTTPS and `Content-Type: application/json` for mutations. Responses use `data` or `error` envelopes. Preserve record versions, consent fields, password step-up and idempotency keys where the backend requires them. Agency routes include an explicit agency reference; the server checks current membership and permissions for every action.

Do not log tokens, private device codes, passwords or care data. Do not disable TLS verification in release builds. Keep environment-specific hostnames outside the source code. User-facing pairing codes must come from a fresh request; example strings cannot be used as real codes.

See the backend's [mobile API guide](https://github.com/cdrika/caresys-backend/blob/main/docs/mobile-api.md) for resource coverage and the [route declarations](https://github.com/cdrika/caresys-backend/blob/main/app/Config/Routes.php) for current endpoints.
