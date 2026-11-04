// shuffle: hash's services/liveTv.js — may the signed-in player watch a match's live stream?
// `{ allowed, reason, message, minBalance, inactiveHours, balance, lastBetAt }`; reason LOW_BALANCE | INACTIVE | LOW_BALANCE_INACTIVE | OFF.
import { request } from './client';

export const getLiveTvAccess = () => request('/user/live-tv/access');
