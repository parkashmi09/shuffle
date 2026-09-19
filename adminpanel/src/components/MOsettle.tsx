import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL, buildPath } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

interface MoMatch {
  matchId: string;
  eventId: string;
  gameType: string;
  marketType: string;
  matchTitle: string;
  teamOne: string;
  teamTwo: string;
  totalBets: number;
  counts: number;
}

interface MoMatchesResponse {
  success: boolean;
  data: MoMatch[];
}

interface CalculatePayoutsResponse {
  success: boolean;
  totalusers: number;
  total_credit: number;
  total_lability: number;
  details?: Array<{
    user_id: number;
    finalcredit: number;
    mostNeg: number;
    normalizedMostNeg: number;
    exposures: Record<string, number>;
  }>;
}

interface OpenBet {
  id: number;
  userId: number;
  username: string;
  betType: string;
  selectionName: string;
  marketType: string;
  gameType: string;
  odds: number;
  stakeAmount: number;
  liability: number;
  status: string;
  matchId: string;
  eventId: string;
  createdAt: string;
}

type WinnerKey = "team1" | "team2" | "draw" | "refund";

const MarketInternalSettle: React.FC = () => {
  const staffId = localStorage.getItem("currentUserId") || "";
  const token = localStorage.getItem("token") || "";

  const [rows, setRows] = useState<MoMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MoMatch | null>(null);
  const [winnerKey, setWinnerKey] = useState<WinnerKey | null>(null);

  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");
  const [calcData, setCalcData] = useState<CalculatePayoutsResponse | null>(
    null
  );

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Per-bet void state
  const [viewBetsMatch, setViewBetsMatch] = useState<MoMatch | null>(null);
  const [openBets, setOpenBets] = useState<OpenBet[]>([]);
  const [openBetsLoading, setOpenBetsLoading] = useState(false);
  const [voidingBetId, setVoidingBetId] = useState<number | null>(null);

  const BASE_URL = API_BASE_URL;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    /**
     * `x-staff-id` IS IGNORED NOW, and that is the fix.
     *
     * Every legacy sports report was scoped by this raw REQUEST HEADER — the
     * caller sets it, and `x-staff-id: 1` is the platform owner. The gateway
     * strips it before routing and the scope comes from the staff token.
     */
  };

  const fetchMatches = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<MoMatchesResponse>(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.moMatches}`,
        { headers }
      );
      setRows(data?.data || []);
    } catch (err: any) {
      console.error("fetchMatches error:", err);
      setError(err?.response?.data?.message || "Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [BASE_URL]);

  const filteredRows = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.matchTitle.toLowerCase().includes(q) ||
      r.eventId.toLowerCase().includes(q) ||
      r.teamOne.toLowerCase().includes(q) ||
      r.teamTwo.toLowerCase().includes(q) ||
      r.matchId.toLowerCase().includes(q)
    );
  });

  const openModal = async (row: MoMatch, w: WinnerKey) => {
    setSelected(row);
    setWinnerKey(w);
    setCalcData(null);
    setCalcError("");
    setCalcLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const winnerName =
      w === "team1"
        ? row.teamOne
        : w === "team2"
          ? row.teamTwo
          : w === "draw"
            ? "The Draw"
            : "refund";

    try {
      const { data } = await axios.post<CalculatePayoutsResponse>(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.declareResult}`,
        {
          matchId: row.matchId,
          eventId: row.eventId,
          winnerName,
          teamOne: row.teamOne,
          teamTwo: row.teamTwo,
          counts: row.counts,
        },
        { headers }
      );
      setCalcData(data);
    } catch (err: any) {
      console.error("calculate-payouts error:", err);
      setCalcError(err?.response?.data?.message || "Failed to calculate payouts");
    } finally {
      setCalcLoading(false);
    }
  };

  const closeModal = () => {
    setSelected(null);
    setWinnerKey(null);
    setCalcData(null);
    setCalcError("");
    setSubmitError(null);
    setSubmitSuccess(null);
    setCalcLoading(false);
    setSubmitLoading(false);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!selected || !winnerKey) {
      setSubmitError("No selection is active.");
      return;
    }

    const winnerName =
      winnerKey === "team1"
        ? selected.teamOne
        : winnerKey === "team2"
          ? selected.teamTwo
          : winnerKey === "draw"
            ? "The Draw"
            : "refund";

    const body = {
      matchId: selected.matchId,
      eventId: selected.eventId,
      winnerName,
      teamOne: selected.teamOne,
      teamTwo: selected.teamTwo,
      counts: selected.counts,
    };

    setSubmitLoading(true);
    try {
      const { data } = await axios.post(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.declareResult}`,
        body,
        { headers }
      );

      if (data && (data.success === true || data.success === "true")) {
        setSubmitSuccess(data.message || "Market settled successfully.");
        await fetchMatches();
        closeModal();
      } else {
        setSubmitError(
          data?.message || "Manual settlement returned an unexpected response."
        );
      }
    } catch (err: any) {
      console.error("manual-settlement error:", err);
      setSubmitError(
        err?.response?.data?.message || "Failed to perform manual settlement"
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  // Fetch open bets for a match
  const fetchOpenBets = async (match: MoMatch) => {
    setViewBetsMatch(match);
    setOpenBetsLoading(true);
    setOpenBets([]);
    try {
      const params = new URLSearchParams({
        match_id: match.matchId,
        market_type: match.marketType,
        game_type: match.gameType,
      });
      const { data } = await axios.get(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.openBets}?${params}`,
        { headers }
      );
      if (data.success) setOpenBets(data.data || []);
    } catch (err: any) {
      console.error("fetchOpenBets error:", err);
    } finally {
      setOpenBetsLoading(false);
    }
  };

  const closeViewBets = () => {
    setViewBetsMatch(null);
    setOpenBets([]);
  };

  const voidSingleBet = async (betId: number) => {
    if (!window.confirm(`Void bet #${betId}? This will refund the user.`)) return;
    setVoidingBetId(betId);
    try {
      const { data } = await axios.post(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.voidBet}`,
        { bet_id: betId },
        { headers }
      );
      if (data.success) {
        setOpenBets((prev) => prev.filter((b) => b.id !== betId));
        await fetchMatches();
      } else {
        alert(data.error || "Failed to void bet");
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error voiding bet");
    } finally {
      setVoidingBetId(null);
    }
  };

  const formatNumber = (n: number | null | undefined) =>
    typeof n === "number" && !Number.isNaN(n)
      ? new Intl.NumberFormat().format(n)
      : "-";

  return (
    <div className="p-6">
      <div className="bg-[#0E1831] rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">Market Internal Settle</h1>
          <div className="w-full md:w-80">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search match, team, event, or match id"
              className="w-full p-2 border rounded focus:ring-[#886CFF] focus:border-[#886CFF]"
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-40 text-[#878AA2]">
            Loading matches...
          </div>
        )}

        {error && !loading && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && filteredRows.length === 0 && (
          <div className="text-center text-[#878AA2] py-10">No matches found.</div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full bg-[#0E1831] shadow-sm rounded-lg overflow-hidden">
              <thead className="bg-[#121E38] border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#878AA2] uppercase tracking-wider">
                    Match
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#878AA2] uppercase tracking-wider">
                    Teams
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#878AA2] uppercase tracking-wider">
                    Total Bets
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#878AA2] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D55]">
                {filteredRows.map((r) => (
                  <tr
                    key={`${r.matchId}-${r.eventId}`}
                    className="hover:bg-[#0E1831]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#F9F9F9]">
                        {r.matchTitle}
                      </div>
                      <div className="text-xs text-[#878AA2]">
                        Match ID: {r.matchId} • Event ID: {r.eventId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[#F9F9F9]">
                        {r.teamOne}{" "}
                        <span className="text-[#878AA2]">vs</span>{" "}
                        {r.teamTwo}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatNumber(r.totalBets)}
                    </td>
                    <td className="px-4 py-3">
                      {r.counts === 2 || r.counts === 3 ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openModal(r, "team1")}
                            className="px-3 py-1.5 rounded bg-[#886CFF] text-[#F9F9F9] text-sm hover:bg-[#9B82FF] focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            Team 1
                          </button>

                          <button
                            onClick={() => openModal(r, "team2")}
                            className="px-3 py-1.5 rounded bg-emerald-600 text-[#F9F9F9] text-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          >
                            Team 2
                          </button>

                          {r.counts === 3 && (
                            <button
                              onClick={() => openModal(r, "draw")}
                              className="px-3 py-1.5 rounded bg-[#162140] text-[#F9F9F9] text-sm hover:bg-[#0E1831] focus:outline-none focus:ring-2 focus:ring-gray-400"
                            >
                              Draw
                            </button>
                          )}

                          {/* 👇 NEW VOID BUTTON */}
                          <button
                            onClick={() => openModal(r, "refund")}
                            className="px-3 py-1.5 rounded bg-[#E01B4F] text-[#F9F9F9] text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                          >
                            Void
                          </button>
                          <button
                            onClick={() => fetchOpenBets(r)}
                            className="px-3 py-1.5 rounded bg-purple-600 text-[#F9F9F9] text-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            View Bets
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-[#878AA2]">
                          No actions (counts ≠ 2 or 3)
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-sm text-[#878AA2] mt-3">
              Showing {filteredRows.length} of {rows.length} matches
            </div>
          </div>
        )}
      </div>

      {/* View Bets Modal (per-bet void) */}
      {viewBetsMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black bg-opacity-40"
            onClick={closeViewBets}
          />
          <div className="relative bg-[#0E1831] w-full max-w-3xl rounded-2xl shadow-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Open Bets — Per Bet Void</h2>
                <p className="text-sm text-[#878AA2]">{viewBetsMatch.matchTitle}</p>
                <p className="text-xs text-[#878AA2]">
                  {viewBetsMatch.teamOne} <span className="text-[#878AA2]">vs</span> {viewBetsMatch.teamTwo}
                  {" "}• Market: {viewBetsMatch.marketType} • Game: {viewBetsMatch.gameType}
                </p>
              </div>
              <button
                onClick={closeViewBets}
                className="ml-4 rounded-full p-2 hover:bg-[#121E38] focus:outline-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {openBetsLoading && (
              <div className="flex items-center justify-center h-28 text-[#878AA2]">Loading bets...</div>
            )}

            {!openBetsLoading && openBets.length === 0 && (
              <div className="text-center text-[#878AA2] py-10">No open bets found for this market.</div>
            )}

            {!openBetsLoading && openBets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#121E38] border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[#878AA2] uppercase">Bet ID</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[#878AA2] uppercase">User</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[#878AA2] uppercase">Selection</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-[#878AA2] uppercase">Type</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-[#878AA2] uppercase">Odds</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-[#878AA2] uppercase">Stake</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-[#878AA2] uppercase">Liability</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-[#878AA2] uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2D55]">
                    {openBets.map((b) => (
                      <tr key={b.id} className="hover:bg-[#0E1831]">
                        <td className="px-3 py-2 font-mono text-xs">{b.id}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{b.username}</div>
                          <div className="text-xs text-[#878AA2]">ID: {b.userId}</div>
                        </td>
                        <td className="px-3 py-2">{b.selectionName}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${["back", "yes"].includes((b.betType || "").toLowerCase())
                            ? "bg-blue-100 text-blue-700"
                            : "bg-pink-100 text-pink-700"
                            }`}>{b.betType}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold">{Number(b.odds).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(Number(b.stakeAmount))}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(Number(b.liability))}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => voidSingleBet(b.id)}
                            disabled={voidingBetId === b.id}
                            className="px-3 py-1 rounded bg-[#E01B4F] text-[#F9F9F9] text-xs hover:bg-red-700 disabled:opacity-50"
                          >
                            {voidingBetId === b.id ? "Voiding..." : "Void"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-sm text-[#878AA2] mt-3">
                  {openBets.length} open bet{openBets.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && winnerKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black bg-opacity-40"
            onClick={closeModal}
          />

          <div className="relative bg-[#0E1831] w-full max-w-xl rounded-2xl shadow-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Manual Settlement</h2>
                <p className="text-sm text-[#878AA2]">{selected.matchTitle}</p>
                <p className="text-xs text-[#878AA2]">
                  {selected.teamOne} <span className="text-[#878AA2]">vs</span>{" "}
                  {selected.teamTwo}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="ml-4 rounded-full p-2 hover:bg-[#121E38] focus:outline-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <div className="text-sm">
                <span className="text-[#878AA2] mr-1">Chosen Winner:</span>
                <span className="font-medium">
                  {winnerKey === "team1"
                    ? selected.teamOne
                    : winnerKey === "team2"
                      ? selected.teamTwo
                      : winnerKey === "draw"
                        ? "The Draw"
                        : "Refund (Void)"}
                </span>
              </div>
              <div className="text-xs text-[#878AA2]">
                Match ID: {selected.matchId} • Event ID: {selected.eventId}
              </div>
            </div>

            <div className="min-h-[120px]">
              {calcLoading && (
                <div className="flex items-center justify-center h-28 text-[#878AA2]">
                  Calculating...
                </div>
              )}

              {calcError && !calcLoading && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 mb-3">
                  {calcError}
                </div>
              )}

              {calcData && calcData.success && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border rounded-lg p-3 bg-[#0E1831]">
                    <div className="text-xs text-[#878AA2]">Total Users</div>
                    <div className="text-lg font-semibold">
                      {formatNumber(calcData.totalusers)}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 bg-[#0E1831]">
                    <div className="text-xs text-[#878AA2]">Total Credit</div>
                    <div className="text-lg font-semibold">
                      {formatNumber(calcData.total_credit)}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 bg-[#0E1831]">
                    <div className="text-xs text-[#878AA2]">
                      Total Liability
                    </div>
                    <div className="text-lg font-semibold">
                      {formatNumber(calcData.total_lability)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {submitError && (
              <div className="mt-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="mt-4 p-3 rounded bg-green-50 border border-green-200 text-green-700">
                {submitSuccess}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-[#162140] rounded hover:bg-[#1E2D55]"
                disabled={submitLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                className="px-4 py-2 bg-[#886CFF] text-[#F9F9F9] rounded hover:bg-[#9B82FF] disabled:opacity-50"
              >
                {submitLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketInternalSettle;
