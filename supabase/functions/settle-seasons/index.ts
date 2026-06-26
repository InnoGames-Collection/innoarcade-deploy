// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// settle-seasons — close any season whose end time has passed, pay the top
// finishers in coins, reset season points, and open the next month. Designed to
// be hit on a schedule (e.g. a daily cron / scheduled trigger). The actual work
// is the SECURITY DEFINER SQL function settle_due_seasons(); this is just a
// service-role wrapper so it can be invoked over HTTP. Idempotent.
//
// Deploy: supabase functions deploy settle-seasons

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Make sure a window always exists, then settle anything due.
  await admin.rpc('ensure_active_season');
  const { data, error } = await admin.rpc('settle_due_seasons');
  if (error) return json({ error: error.message }, 500);
  return json({ settled: Number(data ?? 0) });
});
