import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { apiFetchPage, apiFetch } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";

/**
 * Per-player win permission for the in-house games.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THIS SCREEN USED TO WRITE TO NOTHING
 *
 * It called `GET/PUT /admin/users/game-toggles` and
 * `PUT /admin/user/:uid/game-toggle` with a `blacklist`/`whitelist` pair.
 * There is no such route on either side of the port, and no `blacklist` or
 * `whitelist` column anywhere in the schema — so every switch reported success
 * and changed nothing.
 *
 * The control it was describing is real and lives on `house`, which sixteen
 * in-house games consult on every bet: when `current >= max` a winning roll is
 * discarded and replaced with a losing one. So:
 *
 *   Blacklist  →  max 0, current 0   →  `current >= max`  →  cannot win
 *   Whitelist  →  max 50, current 0  →  `current < max`   →  may win
 *
 * The third bulk button used to say "Disable All", which meant nothing. It
 * stops the TICKER — the minute-by-minute random walk that moves players
 * between those two states on its own.
 * ═══════════════════════════════════════════════════════════════════════
 */

type HouseRow = {
  id: number;
  userId: string | null;
  name: string | null;
  max: string;
  current: string;
};

/** A player who cannot win is one whose counter has reached its ceiling. */
const isBlocked = (row: HouseRow) => Number(row.current) >= Number(row.max);

const BLOCKED = { max: 0, current: 0 };
const ALLOWED = { max: 50, current: 0 };

const PAGE_LIMIT = 500;

export default function GameWinLossToggleList() {
  const [rows, setRows] = useState<HouseRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetchPage<HouseRow>(ENDPOINTS.casinoHouse.get, {
        query: { limit: PAGE_LIMIT },
      });
      setRows(data);
    } catch (err: any) {
      setError(err.message || "Failed to load house counters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const setPlayer = async (userId: string, blocked: boolean) => {
    setError(null);
    try {
      await apiFetch(ENDPOINTS.casinoHouse.update, {
        method: "POST",
        body: { userId: Number(userId), ...(blocked ? BLOCKED : ALLOWED) },
      });
      await fetchAll();
    } catch (err: any) {
      setError(`Error updating ${userId}: ${err.message}`);
    }
  };

  const bulkPreset = async (preset: "win" | "reset") => {
    // `scope` has no default on purpose — legacy's two routes rewrote every row
    // with no WHERE clause, on an unauthenticated GET.
    if (!window.confirm(`Apply this to EVERY player? There is no undo.`)) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch(ENDPOINTS.casinoHouse.bulk, {
        method: "POST",
        body: { preset, scope: "all" },
      });
      await fetchAll();
    } catch (err: any) {
      setError(`Bulk action failed: ${err.message}`);
      setLoading(false);
    }
  };

  const stopTicker = async () => {
    setError(null);
    try {
      await apiFetch(ENDPOINTS.casinoHouse.ticker, { method: "POST", body: { running: false } });
      setNotice("Ticker stopped — counters now change only when you change them.");
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setError(`Could not stop the ticker: ${err.message}`);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F9F9F9]">Original Game Win Control</h1>
          <p className="text-sm text-[#8384A5] mt-1">
            Blocked players have winning rolls replaced with losing ones in the sixteen in-house games.
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center space-x-1 px-3 py-1 bg-[#886CFF] text-[#F9F9F9] rounded hover:bg-[#9B82FF] disabled:opacity-50"
        >
          <RefreshCw size={16} /> <span>Refresh</span>
        </button>
      </div>

      <div className="flex space-x-4">
        <button
          onClick={() => bulkPreset("win")}
          disabled={loading}
          className="px-4 py-2 bg-[#E01B4F] text-[#F9F9F9] rounded hover:bg-[#C0153F] disabled:opacity-50"
        >
          Block All
        </button>
        <button
          onClick={() => bulkPreset("reset")}
          disabled={loading}
          className="px-4 py-2 bg-[#0ECC68] text-[#F9F9F9] rounded hover:bg-[#0BA858] disabled:opacity-50"
        >
          Allow All
        </button>
        <button
          onClick={stopTicker}
          disabled={loading}
          className="px-4 py-2 bg-[#1E2D55] text-[#F9F9F9] rounded hover:bg-[#162140] disabled:opacity-50"
        >
          Stop Ticker
        </button>
      </div>

      {loading && <p className="text-[#8384A5]">Loading…</p>}
      {error && <p className="text-[#E01B4F]">{error}</p>}
      {notice && <p className="text-[#0ECC68]">{notice}</p>}

      {!loading && !error && (
        <div className="overflow-auto border border-[#1E2D55] rounded">
          <table className="min-w-full bg-[#0C0D1D]">
            <thead className="bg-[#0E1831]">
              <tr>
                <th className="px-4 py-2 text-left text-[#878AA2]">User ID</th>
                <th className="px-4 py-2 text-left text-[#878AA2]">Name</th>
                <th className="px-4 py-2 text-left text-[#878AA2]">Counter</th>
                <th className="px-4 py-2 text-center text-[#878AA2]">Blocked</th>
                <th className="px-4 py-2 text-center text-[#878AA2]">Allowed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const blocked = isBlocked(row);
                return (
                  <tr key={row.id} className="border-t border-[#1E2D55] hover:bg-[#162140]">
                    <td className="px-4 py-2 text-[#F9F9F9]">{row.userId ?? "—"}</td>
                    <td className="px-4 py-2 text-[#F9F9F9]">{row.name ?? "—"}</td>
                    <td className="px-4 py-2 text-[#8384A5] font-mono text-xs">
                      {Number(row.current)} / {Number(row.max)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={blocked}
                        disabled={!row.userId}
                        onChange={() => row.userId && setPlayer(row.userId, true)}
                        className="h-5 w-5 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!blocked}
                        disabled={!row.userId}
                        onChange={() => row.userId && setPlayer(row.userId, false)}
                        className="h-5 w-5 cursor-pointer"
                      />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#8384A5]">
                    No house counters yet — a row appears once a player places their first in-house bet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
