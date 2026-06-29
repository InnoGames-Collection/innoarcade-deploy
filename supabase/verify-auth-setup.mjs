#!/usr/bin/env node
/**
 * Check hosted Supabase auth config for phone sign-in readiness.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_… node supabase/verify-auth-setup.mjs
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
  throw new Error('Project ref not found.');
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error('Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)');
    process.exit(1);
  }

  const ref = projectRef();
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`API error (${res.status}):`, body);
    process.exit(1);
  }

  const cfg = JSON.parse(body);
  const testOtp = String(cfg.sms_test_otp ?? '');
  const validUntil = cfg.sms_test_otp_valid_until ?? '(not set)';
  const phoneEnabled = cfg.external_phone_enabled;
  const smsProvider = cfg.sms_provider ?? '(default)';

  console.log(`Project: ${ref}\n`);
  console.log(`Phone auth enabled: ${phoneEnabled === true ? 'YES ✓' : phoneEnabled === false ? 'NO ✗ — enable in Dashboard → Auth → Phone' : phoneEnabled}`);
  console.log(`SMS provider: ${smsProvider}`);
  console.log(`Test OTP valid until: ${validUntil}`);

  if (!testOtp) {
    console.log('\nTest phones: NONE ✗');
    console.log('Fix: SUPABASE_ACCESS_TOKEN=sbp_… npm run setup:test-phones');
    console.log('Or add manually: Dashboard → Authentication → Phone → Test phone numbers');
    process.exit(1);
  }

  const pairs = testOtp.split(',').filter(Boolean);
  console.log(`\nTest phones configured: ${pairs.length}`);
  const sample = pairs.slice(0, 3).map((p) => p.replace('=', ' → OTP ')).join(', ');
  console.log(`  Sample: ${sample}${pairs.length > 3 ? ', …' : ''}`);

  const has911 = pairs.some((p) => p.startsWith('251911000000='));
  console.log(`  251911000000 (0911000000): ${has911 ? 'YES ✓' : 'MISSING ✗'}`);

  if (phoneEnabled !== true) {
    console.log('\n⚠ Enable Phone provider in the dashboard, then retry sign-in.');
    process.exit(1);
  }
  if (!has911) {
    console.log('\n⚠ Run npm run setup:test-phones to register test numbers.');
    process.exit(1);
  }

  console.log('\nAuth config looks OK. Sign in with 0911000000 and OTP 123456.');
  if (smsProvider && smsProvider !== 'twilio' && smsProvider !== '(default)') {
    console.log(`Note: provider is "${smsProvider}" — if OTP still fails, check provider credentials.`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
