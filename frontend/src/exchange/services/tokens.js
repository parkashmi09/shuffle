// shuffle: the token helpers the ported exchange imports, over shuffle's own token store (lib/api.js).
import { tokens } from '../../lib/api';

export const getAccessToken = () => tokens.access();
export const isSignedIn = () => Boolean(tokens.access());
/** shuffle's api.js has no locked-account arm; a lock answers 403 and the page says so. */
export const isAccountLockedCode = () => false;
/** A failed refresh already ends the session in lib/api.js (setAuthLostHandler), so nothing more here. */
export const notifyAuthExpired = () => {};
