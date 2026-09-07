'use strict';

const BASE = '/internal/admin/notifications';

/**
 * The player's half of notifications, over admin-service's internal routes.
 *
 * Every method here takes the userId from the CALLER — the controller passes
 * `req.user.id`, which the auth middleware put there — and never from the
 * body. Legacy's versions of these took `userId` from the request with no
 * authentication at all, which is why the internal routes' own comment calls
 * that out: anyone could mark anyone's notifications read.
 */
class NotificationsService {
  constructor(deps) {
    const { clients, logger } = deps;
    this.clients = clients;
    this.logger = logger;
  }

  /**
   * A page of this player's notifications.
   *
   * The internal route answers `response.paginated`, so the body is
   * `{ data, meta }` rather than a bare array — passed through unchanged so a
   * client can page without a second call to learn the total.
   */
  async list({ userId, limit, offset, unreadOnly }) {
    return this.clients.admin.get(`${BASE}/history`, {
      query: { userId: String(userId), limit, offset, unreadOnly },
    });
  }

  /** The badge. */
  async unreadCount({ userId }) {
    return this.clients.admin.get(`${BASE}/unread`, { query: { userId: String(userId) } });
  }

  /**
   * Mark some or all of them read.
   *
   * `notificationIds` omitted means EVERY unread one, which is `markRead`'s
   * own behaviour on the other side (`...(notificationIds?.length ? { id:
   * notificationIds } : {})`) rather than something invented here — so
   * "read all" needs no second endpoint on admin-service and none was added.
   * It only ever touches rows that are still unread, so a re-read cannot
   * overwrite when the player FIRST saw one.
   */
  async markRead({ userId, notificationIds }) {
    return this.clients.admin.post(`${BASE}/read`, {
      userId: String(userId),
      ...(notificationIds?.length ? { notificationIds } : {}),
    });
  }
}

module.exports = { NotificationsService };
