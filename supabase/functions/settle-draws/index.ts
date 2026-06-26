// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// settle-draws — open any missing draw windows and settle every draw whose
// window has closed: reveal the committed seed, pick the winner(s) weighted by
// tickets, and record them (or void + refund an under-subscribed draw). The
// real work is the SECURITY DEFINER SQL ensure_active_draws() + settle_due_draws();
// this is a service-role HTTP wrapper so a cron job or the admin console can
// invoke it. Idempotent.
//
// Authorised by EITHER a matching x-cron-secret header (scheduled job) OR an
// admin JWT (the console's "Settle" button), mirroring settle-tournament.
//
// Deploy: supabase functions deploy settle-draws

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // --- authorise: cron secret OR admin JWT ---
  const cronSecret = Deno.env.get('CRON_SECRET');
  const headerSecret = req.headers.get('x-cron-secret');
  let authorised = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);
  if (!authorised) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (u.user) {
      const { data: prof } = await admin.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
      authorised = prof?.role === 'admin';
    }
  }
  if (!authorised) return json({ error: 'forbidden' }, 403);

  // Make sure the current windows exist, then settle anything due.
  await admin.rpc('ensure_active_draws');
  const { data, error } = await admin.rpc('settle_due_draws');
  if (error) return json({ error: error.message }, 500);
  return json({ settled: Number(data ?? 0) });
});
