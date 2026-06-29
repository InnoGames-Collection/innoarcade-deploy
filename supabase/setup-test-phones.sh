#!/usr/bin/env bash
# Push test phone numbers + OTP 123456 to the linked Supabase project.
# Requires: supabase CLI logged in (`supabase login`) and project linked.
#
# Usage (from innoarcade/):
#   supabase link --project-ref YOUR_REF
#   ./supabase/setup-test-phones.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Pushing auth.sms.test_otp from supabase/config.toml …"
echo "Phones: 251911000000 … 251911000010 · OTP: 123456"
supabase config push

echo ""
echo "Done. Test sign-in: 0911000000 … 0911000010 with OTP 123456"
echo "See supabase/test-phones.json for the full list."
