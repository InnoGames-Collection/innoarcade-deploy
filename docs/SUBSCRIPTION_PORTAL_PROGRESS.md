# Subscription Portal Integration — Progress Log

**Repo:** `innoarcade-deploy`  
**Supabase:** `https://kuoxbflcxruwtgbjclet.supabase.co`  
**Source plan:** [`SUBSCRIPTION_PORTAL_INTEGRATION.md`](./SUBSCRIPTION_PORTAL_INTEGRATION.md)  
**OpenAPI:** [`partner-mt-and-webhooks.openapi.yaml`](../partner-mt-and-webhooks.openapi.yaml)  
**Last updated:** 2026-07-15 (Phase 3 deployed + `PORTAL_ENABLED=true` on staging)

Track scaffolding A→G was deployed; **Phases 1–2 code aligned to OpenAPI**. Phase 3 (subscribe-gated OTP login) and live credentials remain.

---

## Summary

| Step | Goal | Status |
| --- | --- | --- |
| **A** | Copy integration doc into deploy repo | **Done** |
| **B** | Schema + shared lib + webhook stubs | **Done** (superseded by Phase 1–2) |
| **C** | Phase 0 handoff tracker | **Done** — awaiting credentials / serviceIds |
| **D** | Phase 1 SMS path (`/api/v1/mt/send` + MT callback) | **Deployed** — needs API key for live MT smoke |
| **E** | Phase 2 subscription notify + HMAC + serviceId map | **Deployed** — needs webhook secret + serviceIds |
| **F** | Phase 3 payment webhook | **Deferred** — not in OpenAPI |
| **G** | Hardening notes + env + deploy | Updated secrets list |
| **H** | OpenAPI analysis + plan update | **Done** |
| **I** | Plan Phase 3 — subscribe-gated OTP | **Deployed** + `PORTAL_ENABLED=true` |

### Deployed on `kuoxbflcxruwtgbjclet`

**2026-07-14**

- Migration `20260714120000_subscription_portal`
- Functions scaffold: `send-sms`, `subscribe`, `portal-*`

**2026-07-15 (Phases 1–2 OpenAPI align)**

- Migration `20260715010000_portal_openapi_align`
- Redeployed: `send-sms`, `subscribe`, `portal-subscription-webhook`, `portal-sms-dlr`, `portal-payment-webhook`
- Note: CLI warned `no SMS provider is enabled. Disabling phone login` — expected until Auth SMS hook + provider/`SMS_MODE=portal` are wired; does not mean functions failed.

---

## Implementation track (post-OpenAPI)

See plan §8 for full task lists. Condensed board:

| Phase | Goal | Status | Blockers |
| --- | --- | --- | --- |
| **0** | Contract + credentials | Schemas done; creds open | API key, secret, serviceIds, sandbox URL |
| **1** | MT send + status callback | **Deployed** (2026-07-15) | API key for live MT smoke |
| **2** | Notify webhook + HMAC + serviceId map | **Deployed** (2026-07-15) | Webhook secret + `PORTAL_SERVICE_*` |
| **3** | Subscribe-gated OTP | **Deployed** (2026-07-15) | Portal credentials / serviceIds; optional allowlist |
| **4** | Prod hardening | Not started | Phase 3 + portal go-live checklist |

### Phase 1–2 deliverables (2026-07-15)

| Area | Change |
| --- | --- |
| `_shared/portal.ts` | OpenAPI MT client, notify HMAC + skew, serviceId map, MT callback token guard |
| Migration `20260715010000_portal_openapi_align.sql` | `portal_service_id`, SMS ext/tx cols, `success`/`failed` statuses |
| `portal-subscription-webhook` | `subscription` / `unsubscription` + `request_id` idempotency |
| `portal-sms-dlr` | MT `result` callback correlated by `ext_transaction_id` |
| `send-sms` | `type: otp` via `portalSendMt`; resolves serviceId from entitlement |
| `subscribe` + Account UX | Shortcode CTA copy when portal pending |

### Phase 3 deliverables (2026-07-15)

| Area | Change |
| --- | --- |
| Migration `20260715020000_portal_login_gate.sql` | `msisdn_portal_login_status` RPC |
| `portal-login-gate` EF | Pre-OTP check; allow when ungated / sub / pending / admin / allowlist |
| `auth.ts` | `assertPortalLoginAllowed` + `PortalNotEntitledError` |
| `send-sms` | When `PORTAL_ENABLED`, deny OTP for all SMS modes if not entitled |
| Sign-in UX | Clear “Text OK…” copy on deny |
| Welcome MT | Optional `PORTAL_SEND_WELCOME=true` after subscription notify |

### Remaining

1. Deploy Phase 3 migration + `portal-login-gate` (+ redeploy `send-sms`, `portal-subscription-webhook`).
2. Set `PORTAL_ENABLED=true` (+ allowlist admin phones) when ready to enforce.
3. Confirm promo ownership before enabling `PORTAL_SEND_WELCOME`.

---

## A — Copy doc

- Added [`docs/SUBSCRIPTION_PORTAL_INTEGRATION.md`](./SUBSCRIPTION_PORTAL_INTEGRATION.md).
- **2026-07-14:** rewritten around OpenAPI (gaps, asks, Phases 1–4).

---

## B — Scaffold

### Migration

`supabase/migrations/20260714120000_subscription_portal.sql`

- `portal_events`, `sms_messages`, portal cols on `subscriptions`, `portal_pending_entitlements`
- RPCs: `msisdn_digits`, `user_id_for_msisdn`, `claim_pending_portal_entitlements`

### Shared Deno module

`supabase/functions/_shared/portal.ts` — **stub contracts**; must match OpenAPI (Phase 1–2).

### New Edge Functions (`verify_jwt = false`)

| Function | Role | OpenAPI note |
| --- | --- | --- |
| `portal-subscription-webhook` | Opt-in / opt-out | → `subscription` / `unsubscription` |
| `portal-sms-dlr` | Delivery receipts | → MT final `result` callback |
| `portal-payment-webhook` | Charge / renew | **No OpenAPI** — leave dormant |

---

## C — Phase 0 handoff

See [`SUBSCRIPTION_PORTAL_PHASE0_HANDOFF.md`](./SUBSCRIPTION_PORTAL_PHASE0_HANDOFF.md).

**Closed by OpenAPI:** MT path, notify schema, MT callback schema, HMAC algorithm, free-text messages.  
**Still blocked:** API key, webhook secret, serviceIds, sandbox URL, grace/promo clarifications.  
**Ready to give portal:** staging function URLs + copy/paste ask block in Phase 0 doc.

---

## D — Phase 1 SMS (superseded stub)

- Current: `SMS_MODE=portal` → `portalSendMessage` with **wrong path** (`/api/v1/messages/generate-send`) and templates.
- Target: OpenAPI MT send + MT status callback (plan Phase 1).

---

## E — Phase 2 subscriptions (partial)

- `PORTAL_ENABLED` pending path + cancel reject: **keep**.
- Parsers / HMAC / serviceId: **rework** to OpenAPI (plan Phase 2).

---

## F — Phase 3 payments

- **Deferred.** OpenAPI has no payment events. Subscription charging is portal-side; lifecycle is notify only.
- Coin / TeleBirr demo rails remain separate unless a later portal spec arrives.

---

## G — Hardening & go-live checklist

### Secrets (Edge Functions — **not** `VITE_`*)

```bash
supabase secrets set \
  PORTAL_ENABLED=false \
  PORTAL_WEBHOOK_SKIP_VERIFY=true \
  PORTAL_BASE_URL= \
  PORTAL_API_KEY= \
  PORTAL_WEBHOOK_SECRET= \
  PORTAL_MT_SEND_PATH=/api/v1/mt/send \
  PORTAL_MT_CALLBACK_URL=https://kuoxbflcxruwtgbjclet.supabase.co/functions/v1/portal-sms-dlr \
  PORTAL_SERVICE_DAILY= \
  PORTAL_SERVICE_WEEKLY= \
  PORTAL_SERVICE_MONTHLY= \
  PORTAL_DEFAULT_SERVICE_ID= \
  PORTAL_LOGIN_ALLOWLIST= \
  PORTAL_SEND_WELCOME=false \
  PORTAL_SHORTCODE_HINT= \
  SMS_MODE=mock
```

| When going live with portal | Set |
| --- | --- |
| Enable portal subscription path | `PORTAL_ENABLED=true` |
| Enforce subscribe-gated OTP | `PORTAL_ENABLED=true` (client gate + send-sms) |
| Ops phones without a sub | `PORTAL_LOGIN_ALLOWLIST=+2519…` |
| Route Auth OTP via portal | `SMS_MODE=portal` + base URL + API key + serviceIds |
| Require notify signatures | `PORTAL_WEBHOOK_SKIP_VERIFY=false` + webhook secret |
| Optional welcome SMS | `PORTAL_SEND_WELCOME=true` (+ game URL / message) |
| Wire Auth Send SMS hook | Dashboard → Auth → Hooks → `send-sms` |

### Local dry-run (OpenAPI-shaped notify, skip verify)

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/portal-subscription-webhook" \
  -H "content-type: application/json" \
  -H "apikey: $ANON" \
  -d '{
    "event":"subscription",
    "request_id":"7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "service_id":4,
    "msisdn":"251911000001",
    "time":"2026-07-14T19:00:00.123Z"
  }'
```

(Requires `PORTAL_WEBHOOK_SKIP_VERIFY=true` for unsigned local posts, or valid `X-Timestamp` + `X-Signature`.)

### Deploy commands (Phases 1–2)

```bash
cd innoarcade-deploy
supabase db push --linked --yes
supabase functions deploy send-sms subscribe portal-login-gate \
  portal-subscription-webhook portal-sms-dlr portal-payment-webhook --use-api
```

### Known follow-ups

- [x] Implement Phases 1–2 against OpenAPI
- [x] Deploy migration + functions to staging (`kuoxbflcxruwtgbjclet`) — Phases 1–2
- [x] Implement Phase 3 subscribe-gated OTP (code)
- [x] Deploy Phase 3 migration + `portal-login-gate` (+ `PORTAL_ENABLED=true`)
- [ ] Smoke: portal subscription webhook → login allowed → OTP
- [ ] Admin UI for `portal_events` / `sms_messages`
- [ ] Load-test webhook acks + retry behaviour
- [ ] Register **prod** notification URL when cutting over
- [ ] Confirm TeleBirr vs portal-only for **coins** (subs already portal)

---

## File index (new / touched)

| Path | Change |
|---|---|
| `partner-mt-and-webhooks.openapi.yaml` | Portal-provided contract |
| `docs/SUBSCRIPTION_PORTAL_INTEGRATION.md` | Working plan + gap analysis |
| `docs/SUBSCRIPTION_PORTAL_PHASE0_HANDOFF.md` | Tracker + owner email draft |
| `docs/SUBSCRIPTION_PORTAL_PROGRESS.md` | This log |
| `supabase/migrations/20260714120000_subscription_portal.sql` | Schema scaffold |
| `supabase/migrations/20260715010000_portal_openapi_align.sql` | Phase 1–2 OpenAPI schema align |
| `supabase/migrations/20260715020000_portal_login_gate.sql` | Phase 3 login status RPC |
| `supabase/functions/_shared/portal.ts` | MT client, HMAC, login entitlement |
| `supabase/functions/portal-login-gate/index.ts` | Pre-OTP entitlement probe |
| `supabase/functions/portal-*/index.ts` | Notify + MT callback + optional welcome |
| `supabase/functions/send-sms/index.ts` | OTP MT + portal login hard gate |
| `supabase/functions/subscribe/index.ts` | Pending path; cancel rejected |
| `src/platform/auth.ts` / `signInGate.ts` / `hub/signin.ts` | Subscribe-gated OTP UX |

---

## Discovery log — portal owner calls

Living notes from sessions with the subscription portal provider.  
**Newest first.**

### Call / artifact — 2026-07-14: OpenAPI `partner-mt-and-webhooks.openapi.yaml`

#### What the spec locks

| Topic | Detail |
|---|---|
| Title | Partner Messaging & Notification API v1.0.0 |
| Server | `http://168.119.53.26:8484` (Production) — no sandbox entry |
| MT send | `POST /api/v1/mt/send` |
| MT auth | `X-API-Key` |
| MT body | `serviceId`, `msisdn`, `type` (`optin\|optout\|business\|otp`), `message`; optional `extTransactionId`, `callbackUrl` |
| MT hard rule | Active subscription required or `MT_NO_ACTIVE_SUBSCRIPTION` |
| Notify webhook | `event`: `subscription` \| `unsubscription`; `request_id`, `service_id`, `msisdn`, `time` |
| Notify HMAC | `X-Timestamp`, `X-Signature: sha256=<hex>` over `"{timestamp}.{body}"`; also `X-Request-Id` |
| MT callback | `service_id`, `msisdn`, `ext_transaction_id`, `result` (`success`\|`failed`), `time`, optional `reason` — **no signature in spec** |
| Not included | Payment/renew webhooks, template catalog, grace-specific event, sandbox URL |

#### Gaps vs our scaffold

| Area | Was | Must become |
|---|---|---|
| Outbound path | `/api/v1/messages/generate-send` + templates | `/api/v1/mt/send` + free-text |
| Auth header | Bearer + x-api-key | `X-API-Key` only |
| Notify events | Flexible optin/start/… | Prefer `subscription` / `unsubscription` |
| Idempotency | assorted ids | `request_id` |
| Plan | `period` in body | `service_id` → config map |
| HMAC | Standard Webhooks or body-only | `{timestamp}.{body}` formula |
| DLR | Classic DELIVRD | `result` success/failed |
| Payments EF | Stubbed | Defer |
| Login | Auth OTP anytime | Gate on active/pending entitlement first |

#### Actions

| Status | Action |
|---|---|
| **Done** | OpenAPI committed in repo; plan §4–8 rewritten; Phase 0 statuses updated; progress track H |
| **Todo** | Send Phase 0 copy/paste asks to owner |
| **Todo** | Implement plan Phases 1–3 |
| **Todo** | Add `portal_service_id` migration when coding Phase 2 |

#### Remaining questions for owner

1. API key + webhook secret + sandbox URL  
2. `serviceId` triad (daily/weekly/monthly) + shortcodes  
3. Grace → `unsubscription`?  
4. MT callback signing?  
5. Promo SMS sender?  
6. Multi-service per MSISDN?  
7. Retry / skew policy?

---

### Call — 2026-07-14 (phone): MT send, status callback, portal-first lifecycle

#### What they described

| Topic | Detail |
|---|---|
| Service registration | Separate live services; issued **`serviceId`** + category |
| SMS MT API | `{base}/mt/send` (path in OpenAPI: `/api/v1/mt/send`) |
| Status callback | `success` / `failed` (+ `reason`) — not full handset DLR |
| Subscribe path | User texts **OK** → portal notifies → we mirror MSISDN |
| Unsubscribe | **STOP** or grace → deactivate both sides |
| Login | Only if subscribed → OTP → play |
| OTP | Prefer we generate; portal delivers |
| Rails | Portal: SMS + payments; us: entitlement mirror + play |

#### Decisions locked

| Decision | Choice |
|---|---|
| Unsubscribe | No in-app cancel |
| Onboarding | Portal-first |
| OTP | Partner-generated + MT delivery |
| Cold opt-in | Pending MSISDN → claim on signup |

#### Open questions from call (several answered by OpenAPI)

| # | Question | OpenAPI answer |
|---|---|---|
| 1 | Who POSTs opt-in to us? | **They POST** notify webhook to our URL |
| 2 | Step-2 JSON outbound vs inbound? | Separated: MT request vs notify payload vs callback |
| 3 | OTP ownership | Example shows partner message with code — our approach OK |
| 4 | Grace push vs pull | Still **ask** (likely `unsubscription`) |
| 5 | Multi-service | Still **ask** |
| 6 | Promo sender | Still **ask** |

---

*Add the next call as `### Call — YYYY-MM-DD (channel): short title` above this line (newest first).*
