#!/usr/bin/env node
/**
 * Push test phone OTP map to the hosted Supabase project via Management API.
 * Updates ONLY auth.sms.test_otp — does not touch redirect URLs, storage, etc.
 *
 * Requires a personal access token (same as `supabase login`):
 *   https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_… node supabase/push-test-phones.mjs
 *   # or export SUPABASE_ACCESS_TOKEN once, then: npm run setup:test-phones
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

function projectRef() {
  const fromEnv = process.env.SUPABASE_PROJECT_REF || process.env.PROJECT_REF;
  if (fromEnv) return fromEnv.trim();
  try {
    return readFileSync(join(__dir, '.temp', 'project-ref'), 'utf8').trim();
  } catch {
    const toml = readFileSync(join(__dir, 'config.toml'), 'utf8');
    const m = toml.match(/^project_id\s*=\s*"([^"]+)"/m);
    if (m) return m[1];
  }
  throw new Error('Project ref not found. Run `supabase link` or set SUPABASE_PROJECT_REF.');
}

function loadPhones() {
  const raw = JSON.parse(readFileSync(join(__dir, 'test-phones.json'), 'utf8'));
  const otp = String(raw.otp ?? '123456');
  const entries = (raw.phones ?? []).map((p) => {
    const digits = String(p.dashboard ?? p.e164 ?? '').replace(/\D/g, '');
    if (!digits) throw new Error(`Invalid phone entry: ${JSON.stringify(p)}`);
    return `${digits}=${otp}`;
  });
  if (!entries.length) throw new Error('No phones in supabase/test-phones.json');
  return { otp, smsTestOtp: entries.join(',') };
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error('Missing SUPABASE_ACCESS_TOKEN.');
    console.error('Create one at https://supabase.com/dashboard/account/tokens');
    console.error('Then: SUPABASE_ACCESS_TOKEN=sbp_… npm run setup:test-phones');
    process.exit(1);
  }

  const ref = projectRef();
  const { otp, smsTestOtp } = loadPhones();
  const validUntil = process.env.SMS_TEST_OTP_VALID_UNTIL
    ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  console.log(`Patching sms_test_otp on project ${ref} …`);
  console.log(`Phones: ${smsTestOtp.split(',').length} · OTP: ${otp}`);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_phone_enabled: true,
      sms_test_otp: smsTestOtp,
      sms_test_otp_valid_until: validUntil,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`Management API error (${res.status}):`, body);
    process.exit(1);
  }

  console.log('Done. Test sign-in: 0911000000 … 0911000010 with OTP', otp);
  console.log('See supabase/test-phones.json for the full list.');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
