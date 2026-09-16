/**
 * OneSignal web push — the same file in every CFZ site.
 *
 * GENERATED FROM admins/frontend-kit/onesignal.js by agents/push-frontend-kit.mjs.
 * Edit it there and push again; an edit made here is overwritten.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * HOW IT IS SWITCHED ON
 *
 * Not by this build. The site's backend says whether push is on, and with
 * which App ID, in `GET /api/v1/admin/features/public`. The owner panel writes
 * that, so an operator turns push on for every site without a deploy, and a
 * site with push off never loads OneSignal's script at all.
 *
 * The App ID is public by design — the SDK needs it in the page. The REST key
 * that SENDS never leaves the backend.
 *
 * ── WHO GETS A NOTIFICATION ─────────────────────────────────────────────
 *
 * The backend sends to players by their platform id, as OneSignal's
 * `external_id`. `pushLogin(id)` is what ties this browser to that id, so it
 * is called whenever the app knows who is signed in — at sign-in AND when a
 * saved session is restored on reload — and `pushLogout()` unties it, so the
 * next person on a shared machine does not receive the last one's messages.
 * ═════════════════════════════════════════════════════════════════════════
 */

const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

let started = null;
let pendingUser = null;

const trim = (s) => String(s || '').replace(/\/+$/, '');

function deferred(fn) {
  if (typeof window === 'undefined') return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(fn);
}

function loadScript() {
  if (document.querySelector(`script[src="${SDK_URL}"]`)) return;
  const s = document.createElement('script');
  s.src = SDK_URL;
  s.defer = true;
  document.head.appendChild(s);
}

/**
 * Ask the backend whether push is on, and start OneSignal if it is.
 * Safe to call more than once; never throws — a site with no backend, or with
 * push off, simply carries on without it.
 */
export function initPush({ apiBase } = {}) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (started) return started;

  started = (async () => {
    try {
      const res = await fetch(`${trim(apiBase)}/api/v1/admin/features/public`, { credentials: 'omit' });
      if (!res.ok) return false;
      const json = await res.json();
      const push = (json?.data ?? []).find((f) => f.feature === 'push_notifications');
      const appId = push?.variant === 'onesignal' ? push?.config?.appId : null;
      if (!appId) return false;

      loadScript();
      deferred(async (OneSignal) => {
        await OneSignal.init({
          appId,
          // A local build is served over plain http; OneSignal refuses it otherwise.
          allowLocalhostAsSecureOrigin: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
          serviceWorkerPath: 'OneSignalSDKWorker.js',
        });
        if (pendingUser) await OneSignal.login(pendingUser);
      });
      return true;
    } catch {
      return false;
    }
  })();

  return started;
}

/** Tie this browser to a signed-in player. Call on sign-in and on session restore. */
export function pushLogin(userId) {
  if (userId === undefined || userId === null || userId === '') return;
  pendingUser = String(userId);
  deferred(async (OneSignal) => {
    try {
      await OneSignal.login(pendingUser);
    } catch {
      /* not initialised on this site — push is off */
    }
  });
}

/** Untie this browser from the player. Call on sign-out. */
export function pushLogout() {
  pendingUser = null;
  deferred(async (OneSignal) => {
    try {
      await OneSignal.logout();
    } catch {
      /* not initialised on this site */
    }
  });
}

/** Ask for permission from a user gesture (a bell button, a settings toggle). */
export function requestPushPermission() {
  deferred(async (OneSignal) => {
    try {
      await OneSignal.Notifications.requestPermission();
    } catch {
      /* push is off */
    }
  });
}
