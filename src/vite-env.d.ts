/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** 'true' to route the coin economy through the (deployed) Edge Functions.
   *  Unset/false → the economy runs locally (works offline, ideal for demos). */
  readonly VITE_ECONOMY_ONLINE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
