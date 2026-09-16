'use strict';

/**
 * OneSignal web push.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * HOW THIS DIFFERS FROM THE FIREBASE PATH
 *
 * Firebase is addressed by DEVICE TOKEN, so this platform stores a token per
 * device (`user_fcm_tokens`) and sends to the list. OneSignal keeps the
 * device list itself. The browser SDK calls `OneSignal.login(<player id>)`,
 * which ties that browser's subscription to the player as an `external_id`,
 * and a send names the player, not the device. So there is no token table to
 * keep in step, and a player with three browsers gets all three.
 *
 * The consequence for this service: a send cannot know how many devices it
 * reached. OneSignal answers with a notification id when it ACCEPTS the send
 * and delivers asynchronously. `accepted` is reported, not `delivered`.
 *
 * ── THE TWO KEYS ────────────────────────────────────────────────────────
 *
 * `appId` is public — the web SDK needs it in the page. `apiKey` is the REST
 * key and can push to every subscriber of the app, so it lives sealed in
 * `site_features.secrets` and is opened only here, in memory, per send.
 *
 * New "App API keys" start `os_v2_` and authenticate as `Key <key>`; the
 * older REST API keys authenticate as `Basic <key>`. Both are accepted.
 * ═════════════════════════════════════════════════════════════════════════
 */

const ENDPOINT = 'https://api.onesignal.com/notifications?c=push';
/** OneSignal's ceiling on `include_aliases.external_id` per request. */
const MAX_ALIASES = 2000;
const DEFAULT_SEGMENT = 'Subscribed Users';

class OneSignalError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'OneSignalError';
    this.status = status;
    this.body = body;
  }
}

class OneSignalProvider {
  constructor({ appId, apiKey, segment, logger, fetchImpl = globalThis.fetch, timeoutMs = 10_000, endpoint = ENDPOINT }) {
    if (!appId) throw new OneSignalError('OneSignal appId is missing');
    if (!apiKey) throw new OneSignalError('OneSignal apiKey is missing');
    this.appId = appId;
    this.apiKey = apiKey;
    this.segment = segment || DEFAULT_SEGMENT;
    this.logger = logger;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.endpoint = endpoint;
  }

  get name() {
    return 'onesignal';
  }

  #authorization() {
    return String(this.apiKey).startsWith('os_v2_') ? `Key ${this.apiKey}` : `Basic ${this.apiKey}`;
  }

  #payload(message) {
    const title = String(message.title ?? '').trim();
    // `contents` is required and must not be empty; a title-only notification
    // repeats the title rather than being refused.
    const body = String(message.body ?? '').trim() || title;
    const data = message.data && typeof message.data === 'object' ? { ...message.data } : {};
    if (message.type) data.type = message.type;

    return {
      app_id: this.appId,
      target_channel: 'push',
      headings: { en: title },
      contents: { en: body },
      ...(Object.keys(data).length ? { data } : {}),
      ...(message.url ? { url: message.url } : {}),
    };
  }

  async #post(body) {
    const res = await this.fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: this.#authorization(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const reason = Array.isArray(json?.errors) ? json.errors.join('; ') : text.slice(0, 200) || res.statusText;
      throw new OneSignalError(`OneSignal refused the send (${res.status}): ${reason}`, { status: res.status, body: json });
    }

    // 200 with an empty id is OneSignal's "nobody to send to", e.g. no
    // subscribed browser for any of the named players. Not an error.
    const errors = Array.isArray(json?.errors) ? json.errors : json?.errors ? [json.errors] : [];
    return { id: json?.id || null, errors };
  }

  /**
   * Push to named players. `externalIds` are platform user ids, which is what
   * the front ends pass to `OneSignal.login`.
   */
  async sendToUsers(externalIds, message) {
    const ids = [...new Set(externalIds.map(String))].filter(Boolean);
    let accepted = 0;
    const failures = [];
    const notificationIds = [];

    for (let i = 0; i < ids.length; i += MAX_ALIASES) {
      const batch = ids.slice(i, i + MAX_ALIASES);
      try {
        const result = await this.#post({ ...this.#payload(message), include_aliases: { external_id: batch } });
        if (result.id) {
          accepted += batch.length;
          notificationIds.push(result.id);
        }
        if (result.errors.length) failures.push(...result.errors.map(String));
      } catch (error) {
        this.logger?.error({ err: error.message, batch: batch.length }, 'OneSignal batch failed');
        failures.push(error.message);
      }
    }

    return { accepted, delivered: accepted, failures, notificationIds, provider: this.name };
  }

  /** Push to a OneSignal segment — used by the connection test, not by broadcasts. */
  async sendToSegment(message, segment = this.segment) {
    const result = await this.#post({ ...this.#payload(message), included_segments: [segment] });
    return { accepted: result.id ? 1 : 0, failures: result.errors.map(String), notificationIds: result.id ? [result.id] : [], provider: this.name };
  }
}

module.exports = { OneSignalProvider, OneSignalError, MAX_ALIASES, DEFAULT_SEGMENT, ENDPOINT };
