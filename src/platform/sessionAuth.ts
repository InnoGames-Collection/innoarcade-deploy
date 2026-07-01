// Session-expiry handling for in-game server calls. The hub sign-in gate blocks
// unsigned visitors at entry; this covers JWT expiry mid-run or mid-session.

import { isConfigured } from './supabase';
import { currentUser } from './auth';
import { openSignIn } from '../hub/signin';
import { t } from '../i18n';

/** True when Supabase is configured and the persisted session is gone. */
export async function isSessionExpired(): Promise<boolean> {
  return isConfigured() && !(await currentUser());
}

/** Open sign-in when the session expired; optional toast/message callback. */
export async function promptIfSessionExpired(notify?: (msg: string) => void): Promise<boolean> {
  if (!(await isSessionExpired())) return false;
  notify?.(t('td.sessionExpired'));
  openSignIn();
  return true;
}
