# Subscription Portal — Phase 0 Handoff Tracker

**Project:** `innoarcade-deploy` · Supabase ref `kuoxbflcxruwtgbjclet`  
**Backend decision:** Hosted Supabase (not self-hosted Postgres)  
**OpenAPI:** [`partner-mt-and-webhooks.openapi.yaml`](../partner-mt-and-webhooks.openapi.yaml) (received 2026-07-14)  
**Status:** Contract schemas largely locked — blocked on **credentials + serviceIds + sandbox**

Staging callback base:

`https://kuoxbflcxruwtgbjclet.supabase.co/functions/v1`

| Callback | Staging URL | Register as |
|---|---|---|
| Subscription / unsubscription | `…/portal-subscription-webhook` | Portal **notification URL** |
| MT delivery status | `…/portal-sms-dlr` | Our `callbackUrl` on `/mt/send` (not a portal-console DLR product) |
| Payment / renew | `…/portal-payment-webhook` | **Dormant** — not in OpenAPI |

Ack shape: `{ "ok": true }` (HTTP 2xx after durable write).

**Opening these URLs in a browser is a GET.** Partners must **POST** JSON for real events. A browser click now returns a health probe:

```json
{ "ok": true, "endpoint": "…", "status": "ready", "accepts": ["POST"], "note": "…" }
```

`method_not_allowed` before 2026-07-15 redeploy was expected for GET — not a broken webhook.

Full working plan: [`SUBSCRIPTION_PORTAL_INTEGRATION.md`](./SUBSCRIPTION_PORTAL_INTEGRATION.md).

---

## From portal owners

| Item | Owner | Status | Notes |
|---|---|---|---|
| OpenAPI / integration guide | Portal | **Done** | `partner-mt-and-webhooks.openapi.yaml` |
| Sample payloads (success + errors) | Portal | **Done** | In OpenAPI examples |
| Auth scheme (outbound) | Portal | **Done** | `X-API-Key` |
| Subscription webhook schema | Portal | **Done** | `subscription` / `unsubscription` + HMAC |
| MT send contract | Portal | **Done** | `POST /api/v1/mt/send` |
| MT status callback schema | Portal | **Done** | `result` success/failed |
| Template codes | Portal | **N/A** | Free-text `message`; no templates |
| Generate-message / old path | Portal | **N/A** | Replaced by `/mt/send` |
| Service provider account | Portal | Not started | |
| Sandbox / UAT **base URL** | Portal | **Needed** | OpenAPI lists only `http://168.119.53.26:8484` |
| Production base URL confirmation | Portal | Partial | IP:8484 in OpenAPI — prefer HTTPS hostname |
| API key (staging + prod) | Portal | **Needed** | → `PORTAL_API_KEY` |
| Webhook HMAC shared secret | Portal | **Needed** | → `PORTAL_WEBHOOK_SECRET` |
| `serviceId` for daily / weekly / monthly | Portal | **Needed** | → `PORTAL_SERVICE_*` |
| Shortcode / keyword map (`OK`/`STOP`/…) | Portal | Not started | Map keyword → serviceId |
| Grace expiry as `unsubscription`? | Portal | **Ask** | No distinct event in OpenAPI |
| MT callback signed? | Portal | **Ask** | Not in OpenAPI |
| Webhook retry policy + timestamp skew | Portal | **Ask** | |
| Multi-`serviceId` per MSISDN? | Portal | **Ask** | |
| Who sends promo / game URL SMS? | Portal | **Ask** | |
| Billing SoT | Portal | **Locked by call** | Portal owns charging |
| Renewal / payment webhook | Portal | **Absent** | Defer `portal-payment-webhook` |
| Plan catalogue + trial/grace rules | Portal | Partial | Confirm 3/15/35 ETB + grace days |
| MSISDN normalisation | Portal | **Done (examples)** | `2519…` no plus |
| Sandbox test MSISDNs + trigger | Portal | **Needed** | |
| IP allowlist / SLA contacts | Portal | Not started | |

## From us

| Item | Owner | Status | Notes |
|---|---|---|---|
| Backend hosting decision (Supabase) | Us | **Done** | This repo / project |
| Staging webhook URLs delivered | Us | **Ready** | Table above — send to portal |
| Align code to OpenAPI (Phases 1–2) | Us | **Done** | Deployed to `kuoxbflcxruwtgbjclet` (2026-07-15) |
| Subscribe-gated OTP (Phase 3) | Us | **Done** | Deployed on staging; `PORTAL_ENABLED=true` |
| Service profile + legal URLs | Us | Not started | Hub / privacy / ToS |
| Plan/pricing catalogue submitted | Us | Draft | daily 3 / weekly 15 / monthly 35 ETB |
| OTP / WELCOME copy | Us | Stub | Free-text in MT `message` |
| Consent + unsubscribe | Us | **Locked** | STOP / unsubscription only — **no in-app cancel** |
| Cold opt-in / login order | Us | **Locked** | SMS OK → mirror → app OTP |
| Prod webhook URLs | Us | Pending | Same paths on prod project |

### Product decisions (locked)

| Decision | Choice | Implied behaviour |
|---|---|---|
| Subscribe order | **Portal-first** | Text OK → webhook → MSISDN entitled → then OTP. Confirmed by `MT_NO_ACTIVE_SUBSCRIPTION`. |
| Unsubscribe / cancel | **STOP or unsubscription only** | No Cancel in app. |
| Cold opt-in | Pending by MSISDN | `portal_pending_entitlements` → claim on signup |
| In-app Subscribe when portal live | Shortcode CTA only | Must not invent entitlement |
| Free grant (`subscribe` EF) | Only if `PORTAL_ENABLED` unset | Demo-only |
| OTP | **We generate**; portal delivers | `type: otp` + message body (OpenAPI example) |
| Plan mapping | **`service_id` → period** | No `period` field on webhook |

### Message to portal owner (copy/paste)

> We received `partner-mt-and-webhooks.openapi.yaml` and can implement against it. To start sandbox integration please send:
>
> 1. Staging and production `X-API-Key`  
> 2. Webhook HMAC shared secret for `X-Signature`  
> 3. `serviceId` for our daily / weekly / monthly offers  
> 4. Sandbox/UAT base URL (if different from `http://168.119.53.26:8484`)  
> 5. Confirmation that our notification URL is:  
>    `https://kuoxbflcxruwtgbjclet.supabase.co/functions/v1/portal-subscription-webhook`  
> 6. Whether grace expiry arrives as `event: unsubscription`  
> 7. Whether MT delivery callbacks are signed  
> 8. 1–2 test MSISDNs and how to trigger a test subscription notify  
>
> Our MT `callbackUrl` will be:  
> `https://kuoxbflcxruwtgbjclet.supabase.co/functions/v1/portal-sms-dlr`

---

## Working session — finalize integration (prep)

**Primary test MSISDN (ours):** `251923026799` / `+251923026799`  
Staging project: `kuoxbflcxruwtgbjclet` · Phases 1–3 deployed · `PORTAL_ENABLED=true`

### What we bring / do before the call

| Ready | Item |
|---|---|
| Yes | Staging notification URL + MT callback URL (POST; GET = health only) |
| Yes | Login gate + subscription mirror live |
| Yes | Test phone entitled in staging (pending seed + allowlist) |
| Bring | Laptop with Supabase Dashboard + function logs open |
| Bring | Curl snippets for POST notify / MT (signed once secret arrives) |
| Bring | Hub URL + ability to sign in with `251923026799` |
| Bring | Draft pricing: daily 3 / weekly 15 / monthly 35 ETB |
| Do | Confirm Auth Send SMS hook points at `send-sms` (if flipping `SMS_MODE=portal` live) |
| Do | Legal/hub URLs if they ask for partner profile |

### What portal owners must bring / do in the session

| Must have | Why |
|---|---|
| `X-API-Key` (sandbox or prod they want to use) | Live `/api/v1/mt/send` |
| Webhook HMAC shared secret | Signed `subscription` / `unsubscription` POSTs |
| `serviceId` map (daily / weekly / monthly) + shortcode(s) | Plan mapping + OK/STOP keywords |
| Notification URL registered to our staging webhook | They POST to us on OK/STOP |
| Ability to trigger test subscribe on `251923026799` | End-to-end: OK → notify → OTP → play |
| Sandbox/base URL confirmation | Prefer HTTPS hostname over bare IP |
| Answers: grace = `unsubscription`? promo sender? multi-service? MT callback signed? | Close open product gaps |

### Suggested session agenda (~60–90 min)

1. **Credentials exchange** (5–10 min) — key, secret, serviceIds, shortcodes → we set Supabase secrets live  
2. **Register URLs** (5 min) — paste staging notification URL; show GET health = ready  
3. **Subscribe path** (15 min) — text OK from `251923026799` → we confirm webhook in logs + entitlement → login gate allows  
4. **OTP / MT** (15 min) — set `SMS_MODE=portal` → request OTP → SMS arrives → verify + play  
5. **Unsubscribe** (10 min) — STOP → `unsubscription` → gate denies OTP  
6. **Close outs** (10 min) — grace, promo, retries, go-live checklist / prod URLs  

### Success criteria for the session

- [ ] Live signed `subscription` received for our test MSISDN  
- [ ] Login works only when subscribed  
- [ ] OTP delivered via portal MT (`type=otp`)  
- [ ] `unsubscription` / STOP deactivates us  
- [ ] Secrets + `serviceId`s stored; `PORTAL_WEBHOOK_SKIP_VERIFY=false` if signing works  

### After session → Phase 4 (hardening / prod)

Not a blocker for tomorrow’s sandbox finalize. Phase 4 = turn verify hard-on, prod project URLs, observability, idempotency soak, runbook, optional admin audit views. Payments webhook stays deferred (not in OpenAPI).

---

## Discovery log

Full call + OpenAPI notes:

→ [`SUBSCRIPTION_PORTAL_PROGRESS.md` § Discovery log](./SUBSCRIPTION_PORTAL_PROGRESS.md#discovery-log--portal-owner-calls)
