/**
 * The toast channel — reference `store/alerts`.
 *
 * The live site dispatches `addAlert({ type, message })` into a Redux slice and
 * `<Alerts/>` renders whatever is in it. This clone has no store, so the same
 * job is done by a `CustomEvent` on `window`, which is the pattern the shell
 * already uses for `shuffle:wallet`, `shuffle:vault` and the rest.
 *
 * Anything can raise one without importing the component:
 *
 *     import { alertError, alertSuccess } from "../../lib/alerts";
 *     alertError("That redeem code is not valid");
 *
 * The type strings are the reference's own, because they are also the icon
 * filenames: `/icons/${type}.svg`.
 */

export const ALERT = {
  info: "info-fill",
  success: "success",
  warning: "warning",
  error: "error-fill",
  notification: "notification",
};

/** Raise a toast. Duplicate messages replace rather than stack, as on the reference. */
export function alert(type, message) {
  if (!message) return;
  window.dispatchEvent(new CustomEvent("shuffle:alert", { detail: { type, message: String(message) } }));
}

export const alertInfo = (message) => alert(ALERT.info, message);
export const alertSuccess = (message) => alert(ALERT.success, message);
export const alertWarning = (message) => alert(ALERT.warning, message);
export const alertError = (message) => alert(ALERT.error, message);

/**
 * The message to show for a failed call.
 *
 * `lib/api.js` throws an Error whose `message` is the platform's own
 * `error.message` — "That redeem code is not valid", "The crypto payment
 * provider is not configured" — which is already player-facing prose. The
 * fallback is for a network failure, where there is no envelope at all.
 */
export function alertFromError(error, fallback = "Something went wrong. Please try again.") {
  alertError(error?.message || fallback);
}
