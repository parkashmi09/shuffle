// shuffle: the platform client the ported exchange imports — shuffle's lib/api.js and its single-flight refresh.
import { refreshAccessToken, request as shuffleRequest } from '../../lib/api';

/** Origin of the gateway: `VITE_API_BASE` minus `/api/v1`, or '' (same origin, the Vite proxy). */
export const API_BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/api\/v1\/?$/, '');
export const refreshSession = async () => Boolean(await refreshAccessToken());
/** `request(path)` with shuffle's options; rainbet-only options (`live`, `fixture`) are ignored. */
export const request = (path, { live, fixture, ...options } = {}) => {
  void live;
  void fixture;
  return shuffleRequest(path, options);
};
