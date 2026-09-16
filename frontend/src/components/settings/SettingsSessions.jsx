import { useState } from "react";
import { useApi } from "../../lib/useResource";
import { auth as authApi } from "../../lib/endpoints";
import TableSkeleton from "../ui/TableSkeleton";

/**
 * Settings → Sessions — reference `UserSessions`.
 *
 * Every device holding a refresh token, with the current one marked and the
 * rest revocable. `GET /user/auth/sessions` answers the rows and
 * `DELETE /user/auth/sessions/:id` ends one.
 *
 * The reference resolves a rough location from the address ("IN, Jalandhar").
 * Nothing here does that lookup, and guessing one from an IP would be worse
 * than saying nothing, so Near shows a dash. The device column is read off the
 * user agent, which the session row already carries.
 */

/** `Windows (Chrome)` — the shape the reference prints. */
function device(userAgent) {
  const ua = String(userAgent || "");
  if (!ua) return "Unknown device";
  const os =
    /Windows/i.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/i.test(ua) ? "macOS" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iOS/i.test(ua) ? "iOS" :
    /Linux/i.test(ua) ? "Linux" : "Unknown";
  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /OPR\/|Opera/i.test(ua) ? "Opera" :
    /Firefox\//i.test(ua) ? "Firefox" :
    /Chrome\//i.test(ua) ? "Chrome" :
    /Safari\//i.test(ua) ? "Safari" :
    /curl/i.test(ua) ? "curl" : null;
  return browser ? `${os} (${browser})` : os;
}

/** Anything inside the last two minutes reads as Online, as on the reference. */
function lastUsed(value) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "—";
  if (Date.now() - at.getTime() < 2 * 60 * 1000) return "Online";
  return at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SettingsSessions() {
  const [nonce, setNonce] = useState(0);
  const [revoking, setRevoking] = useState(null);
  const { data, loading } = useApi(`settings:sessions:${nonce}`, () => authApi.sessions().catch(() => []));
  const rows = data || [];

  // The row this browser is on: the most recently used one, which is the
  // request that just fetched this list.
  const currentId = rows.reduce(
    (best, row) => (!best || new Date(row.last_used_at) > new Date(best.last_used_at) ? row : best),
    null
  )?.id;

  const revoke = async (id) => {
    setRevoking(id);
    try {
      await authApi.revokeSession(id);
      setNonce((n) => n + 1);
    } catch {
      // The row stays; the list refreshes on the next visit either way.
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="Table_root">
      <table className="Table_table">
        <thead>
          <tr>
            <td width="20%">User</td>
            <td width="20%">Near</td>
            <td width="20%">IP Address</td>
            <td width="20%">Last Used</td>
            <td width="20%">Action</td>
          </tr>
        </thead>
        {loading && <TableSkeleton cells={["cr", "r", "r", "r", "r"]} />}
        {!loading && rows.length > 0 && (
          <tbody className="TableBody_tbody TableBody_even" data-testid="table-body">
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="UserSessions_flexCell">
                    <div className="UserSessions_userDeviceWrapper">
                      <span className="UserSessions_deviceIcon">
                        <img alt="desktop" src="/icons/desktop.svg" />
                      </span>
                      {row.device_label || device(row.user_agent)}
                    </div>
                  </div>
                </td>
                <td><div className="UserSessions_flexCell">—</div></td>
                <td>
                  <div className="UserSessions_flexCell">
                    <span className="UserSessions_ipText">{row.ip_address || "—"}</span>
                  </div>
                </td>
                <td><div className="UserSessions_flexCell">{lastUsed(row.last_used_at)}</div></td>
                <td>
                  <div className="UserSessions_flexCell">
                    {row.id === currentId ? (
                      "Current Session"
                    ) : (
                      <button
                        type="button"
                        className="UserSessions_removeBtn"
                        disabled={revoking === row.id}
                        onClick={() => revoke(row.id)}
                      >
                        {revoking === row.id ? "Removing" : "Remove"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {!loading && rows.length === 0 && (
        <div className="Table_noResult"><p>No active sessions.</p></div>
      )}
    </div>
  );
}
