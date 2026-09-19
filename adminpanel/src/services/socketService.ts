/**
 * The operator console's socket.
 *
 * ── THIS FILE USED TO INVENT MOST OF ITS PROTOCOL ───────────────────────
 *
 * It declared fourteen events. THREE of them exist:
 *
 *     getAdminProfile        getUsersAllDetails        stopUsersAllDetails
 *
 * The other eleven — `getExecutiveList`, `getExecutiveActivity`,
 * `getMyPermissions`, `updateExecutivePermissions`, `lockExecutive`,
 * `resetExecutivePassword`, `createExecutive` and their `*Update` replies —
 * are not registered by any service. Socket.io does not error on an event
 * nobody listens for; the emit succeeds and the reply never comes, so every
 * Access Management screen built on them sat on a spinner forever.
 *
 * All eleven have real HTTP endpoints under `/api/v1/admin/access/*`, which is
 * where they now go. What stays on the socket is what the socket actually
 * serves.
 *
 * ── AND IT CONNECTED TO A NAMESPACE THAT DOES NOT EXIST ─────────────────
 *
 * `io('https://api.stake.com/admin-panel')` — the `/admin-panel` suffix is a
 * Socket.io NAMESPACE, and the new transport registers everything on the
 * default namespace. It also pointed at the retired monolith host, and sockets
 * do not go through the gateway at all: it is an HTTP reverse proxy with no
 * `upgrade` handling, so admin-service's own port is the only way in.
 *
 * ── THE STAFF CHECK IS A DATABASE READ, NOT A SIGNATURE CHECK ───────────
 *
 * `AUDIENCE.STAFF` re-reads the staff row on every event. A staff member
 * disabled at 09:00 holds a valid eight-hour token until 17:00, so verifying
 * the signature alone would keep them connected all day.
 */

import { io, Socket } from 'socket.io-client';

import { ADMIN_SOCKET_URL, getStaffToken } from '../utils/api';
import type { StaffPermissions } from '../constants/permissions';

/**
 * The three events admin-service registers.
 *
 * These are string literals rather than the opaque hashes the player events
 * use — legacy wrote them inline in the handler instead of through the constant
 * file, and they are just as much the wire protocol for it.
 */
export const ADMIN_EVENTS = {
  GET_ADMIN_PROFILE: 'getAdminProfile',
  GET_USERS_ALL_DETAILS: 'getUsersAllDetails',
  STOP_USERS_ALL_DETAILS: 'stopUsersAllDetails',
  /** Push-only: the name a handler replies ON. Nothing sends it. */
  USERS_ALL_DETAILS: 'usersAllDetails',
} as const;

/* ── the wire format ──────────────────────────────────────────────────────
 * JSON in a byte buffer — not compression, not encryption. The payload is
 * readable in a packet capture, so never put a secret in a frame.
 */

function encode(data: unknown): Uint8Array | null {
  if (!data) return null;
  return new TextEncoder().encode(JSON.stringify(data));
}

function decode(frame: unknown): any {
  if (frame === null || frame === undefined) return null;
  try {
    if (typeof frame === 'string') return JSON.parse(frame);
    if (frame instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(frame));
    if (ArrayBuffer.isView(frame)) return JSON.parse(new TextDecoder().decode(frame as any));
    if (typeof frame === 'object') return frame;
    return null;
  } catch (error) {
    console.error('[admin-socket] could not decode frame', error);
    return null;
  }
}

let socket: Socket | null = null;

/** How long to wait for a reply before giving up. */
const REQUEST_TIMEOUT_MS = 20_000;

export const socketService = {
  /**
   * Open the connection.
   *
   * The token goes in BOTH `auth` and the query string: `auth` is what a modern
   * client sends and `?auth_token=` is what the shipped clients send. The
   * server reads either.
   */
  connect(token?: string) {
    if (socket?.connected) return socket;

    const staffToken = token ?? getStaffToken();
    if (!staffToken) {
      console.warn('[admin-socket] no staff token — not connecting');
      return null;
    }

    socket = io(ADMIN_SOCKET_URL, {
      // No namespace suffix. Everything is on the default namespace.
      auth: { token: staffToken },
      query: { auth_token: staffToken },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.info('[admin-socket] connected'));
    socket.on('disconnect', (reason) => console.info('[admin-socket] disconnected:', reason));
    socket.on('connect_error', (error) => console.error('[admin-socket] error:', error.message));

    return socket;
  },

  disconnect() {
    socket?.disconnect();
    socket = null;
  },

  getSocket() {
    return socket;
  },

  isConnected() {
    return Boolean(socket?.connected);
  },

  /**
   * Send an event and resolve with its reply.
   *
   * Uses the ACK CALLBACK rather than a listener on the same name: with several
   * requests in flight a listener cannot tell which reply belongs to which
   * request, and the old code's `socket.on(...)`-per-call also stacked a new
   * handler on every render.
   *
   * A `{status: false}` reply REJECTS with `.code` set, so callers branch on
   * the code rather than the message text.
   */
  request<T = any>(event: string, payload: Record<string, unknown> = {}): Promise<T> {
    const live = socket ?? this.connect();
    if (!live) return Promise.reject(new Error('Not connected'));

    return new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new Error('The server did not reply in time') as Error & { code?: string };
        error.code = 'SOCKET_TIMEOUT';
        reject(error);
      }, REQUEST_TIMEOUT_MS);

      live.emit(event, encode(payload), (frame: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const reply = decode(frame);
        if (reply && reply.status === false) {
          const error = new Error(reply.msg || 'The request was refused') as Error & { code?: string };
          error.code = reply.error?.code || 'SOCKET_REFUSED';
          return reject(error);
        }
        return resolve(reply as T);
      });
    });
  },

  /**
   * Listen for a pushed event.
   *
   * @returns unsubscribe — ALWAYS call it on unmount. A listener left behind
   *   fires against a dead component and, over a few navigations, turns one
   *   push into a dozen renders.
   */
  on(event: string, handler: (data: any) => void): () => void {
    const live = socket ?? this.connect();
    if (!live) return () => {};

    const wrapped = (frame: unknown) => handler(decode(frame));
    live.on(event, wrapped);
    return () => live.off(event, wrapped);
  },

  /* ── the three real events ──────────────────────────────────────────── */

  /**
   * The caller's own staff record.
   *
   * `actor` is the connection's staff, so there is no id to pass and none to
   * forge.
   */
  getAdminProfile(): Promise<{ status: boolean; profile?: any }> {
    return this.request(ADMIN_EVENTS.GET_ADMIN_PROFILE);
  },

  /**
   * The agent listing.
   *
   * ── THERE IS NO `parentId` PARAMETER, AND THAT IS THE FIX ─────────────
   *
   * Legacy defaulted it to the caller's own id and then let the client override
   * it, unchecked. An agent sending somebody else's id read that agent's entire
   * downline, balances included — which is the whole property the staff tree
   * exists to enforce. The visible set is derived from the caller's own
   * descendants server-side; there is nothing to pass.
   *
   * ── AND IT IS A REQUEST, NOT A SUBSCRIPTION ──────────────────────────
   *
   * The old server ran a 10-second `setInterval` per connected console, and
   * re-subscribing REPLACED the handle after starting the second one — so every
   * re-subscribe leaked an interval that ran forever. The console asks and is
   * answered; a live view asks again.
   */
  getUsersAllDetails(
    params: { page?: number; limit?: number; search?: string; parentId?: number | string } = {}
  ) {
    return this.request(ADMIN_EVENTS.GET_USERS_ALL_DETAILS, params);
  },

  /**
   * Kept because shipped clients send it.
   *
   * A no-op server-side — there is no interval to stop any more.
   */
  stopUsersAllDetails() {
    return this.request(ADMIN_EVENTS.STOP_USERS_ALL_DETAILS).catch(() => undefined);
  },

  /**
   * Poll the agent listing on an interval, client-side.
   *
   * The subscription the old `subscribeToUsersAllDetails` pretended to be. The
   * timer lives here, where the caller can see it and the cleanup function
   * clears it — rather than on the server, where it outlived the console.
   *
   * @returns unsubscribe
   */
  pollUsersAllDetails(
    params: { page?: number; limit?: number; search?: string; parentId?: number | string },
    onData: (data: any) => void,
    { intervalMs = 10_000 }: { intervalMs?: number } = {}
  ): () => void {
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        onData(await this.getUsersAllDetails(params));
      } catch (error: any) {
        console.error('[admin-socket] agent listing failed:', error.message);
      }
    };

    tick();
    const timer = setInterval(tick, intervalMs);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  },
};

/* ── Shared types ───────────────────────────────────────────────────────── */

export interface Executive {
  id: number;
  username: string;
  status: 'active' | 'inactive' | 'locked';
  parentUserId?: number;
  parentUsername?: string;
  parentRole?: string;
  createdAt?: string;
  lastLogin?: string;
  permissions: StaffPermissions;
}

export interface ExecutiveActivity {
  id: number;
  executiveId: number;
  /** e.g. "transfer.credit", "user.password.reset" */
  action: string;
  targetType?: string;
  targetId?: number | string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export default socketService;
