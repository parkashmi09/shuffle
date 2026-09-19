import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL, buildPath } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

interface Bet {
  id: number;
  userId: number;
  betType: "yes" | "no" | string;
  selectionName: string;
  teamOne: string;
  teamTwo: string;
  odds: number;
  stakeAmount: number;
  originalCurrency?: string;
  originalAmount?: number;
  usdAmount?: number;
  liability?: number;
  status?: string;
  createdAt?: string;
}

interface FanMatch {
  matchId: string;
  eventId: string;
  matchTitle: string;
  fancyName: string;
  totalBets: number;
  bets?: Bet[]; // bets array
}

interface FanMatchesResponse {
  success: boolean;
  data: FanMatch[];
}

interface FanPayoutsResponse {
  success: boolean;
  matchId: string;
  eventId: string;
  fancyName: string;
  selectionType: string;
  totalusers: number;
  total_credit?: number;
  total_lability: number;
}

const FanInternalSettle: React.FC = () => {
  const staffId = localStorage.getItem("currentUserId") || "";
  const token = localStorage.getItem("token") || "";

  const [rows, setRows] = useState<FanMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  // expansion state: track expanded fancy keys
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // payout modal (for per-bet YES/NO)
  const [selectedMatch, setSelectedMatch] = useState<FanMatch | null>(null);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null); // show which bet triggered
  const [selectionType, setSelectionType] = useState<"yes" | "no" | null>(null);
  const [payoutData, setPayoutData] = useState<FanPayoutsResponse | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState("");

  // info modal (for header Info button)
  const [infoMatch, setInfoMatch] = useState<FanMatch | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");
  const [infoData, setInfoData] = useState<FanPayoutsResponse | null>(null);

  // void action state (for header Void button)
  const [voidLoading, setVoidLoading] = useState<Record<string, boolean>>({});
  const [voidError, setVoidError] = useState<Record<string, string>>({});
  const [voidSuccess, setVoidSuccess] = useState<Record<string, string>>({});

  // submit state for payout modal
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // per-bet void state
  const [voidingBetId, setVoidingBetId] = useState<number | null>(null);

  const BASE_URL = API_BASE_URL;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // `x-staff-id` is stripped at the gateway — the scope comes from the token.
  };

  // fetch matches (with bets)
  const fetchMatches = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<FanMatchesResponse>(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.fancyMatches.replace(/\/fancy-matches$/, '')}/`,
        { headers }
      );
      setRows(data.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load fan matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [BASE_URL]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredRows = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.matchTitle.toLowerCase().includes(q) ||
      r.fancyName.toLowerCase().includes(q)
    );
  });

  // When user clicks YES/NO on a bet -> payout modal
  const onBetAction = async (match: FanMatch, bet: Bet | null, type: "yes" | "no") => {
    setSelectedMatch(match);
    setSelectedBet(bet);
    setSelectionType(type);
    setPayoutData(null);
    setPayoutError("");
    setPayoutLoading(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const body = {
        matchId: match.matchId,
        eventId: match.eventId,
        fancyName: match.fancyName,
        selectionType: type,
      };
      const { data } = await axios.post<FanPayoutsResponse>(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.declareResult}`,
        body,
        { headers }
      );
      setPayoutData(data);
    } catch (err: any) {
      setPayoutError(err?.response?.data?.message || "Failed to fetch payout details");
    } finally {
      setPayoutLoading(false);
    }
  };

  const closePayoutModal = () => {
    setSelectedMatch(null);
    setSelectedBet(null);
    setSelectionType(null);
    setPayoutData(null);
    setPayoutError("");
    setSubmitError("");
    setSubmitSuccess("");
  };

  // Info modal: default selection = "yes", no submit, show only Users Liability and Total Users
  const openInfoModal = async (match: FanMatch) => {
    setInfoMatch(match);
    setInfoData(null);
    setInfoError("");
    setInfoLoading(true);

    try {
      const body = {
        matchId: match.matchId,
        eventId: match.eventId,
        fancyName: match.fancyName,
        selectionType: "yes", // default selection = yes
      };
      const { data } = await axios.post<FanPayoutsResponse>(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.declareResult}`,
        body,
        { headers }
      );
      setInfoData(data);
    } catch (err: any) {
      setInfoError(err?.response?.data?.message || "Failed to fetch info");
    } finally {
      setInfoLoading(false);
    }
  };

  const closeInfoModal = () => {
    setInfoMatch(null);
    setInfoData(null);
    setInfoError("");
    setInfoLoading(false);
  };

  // VOID handler for a fancy (header button)
  const handleVoid = async (match: FanMatch, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const key = `${match.matchId}-${match.fancyName}`;
    setVoidError((prev) => ({ ...prev, [key]: "" }));
    setVoidSuccess((prev) => ({ ...prev, [key]: "" }));
    setVoidLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const body = {
        matchId: match.matchId,
        eventId: match.eventId,
        fancyName: match.fancyName,
      };
      const { data } = await axios.post(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.voidMarket}`,
        body,
        { headers }
      );

      // assume API returns { success: boolean, message?: string }
      if (data && data.success) {
        setVoidSuccess((prev) => ({ ...prev, [key]: data.message || "Void/refund applied." }));
        // refresh list
        await fetchMatches();
      } else {
        setVoidError((prev) => ({ ...prev, [key]: data?.message || "Void failed" }));
      }
    } catch (err: any) {
      setVoidError((prev) => ({ ...prev, [key]: err?.response?.data?.message || "Void request failed" }));
    } finally {
      setVoidLoading((prev) => ({ ...prev, [key]: false }));
      // clear success after short time visually (optional)
      setTimeout(() => {
        setVoidSuccess((prev) => ({ ...prev, [key]: "" }));
      }, 2500);
    }
  };

  // Submit final fancy manual settle (payout modal)
  const handleSubmit = async () => {
    if (!selectedMatch || !selectionType) return;
    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const body = {
        matchId: selectedMatch.matchId,
        eventId: selectedMatch.eventId,
        fancyName: selectedMatch.fancyName,
        selection: selectionType, // yes/no
        betId: selectedBet ? selectedBet.id : null,
        userId: selectedBet ? selectedBet.userId : null,
        performedBy: staffId || null,
        notes: selectedBet
          ? `Triggered by betId:${selectedBet.id} user:${selectedBet.userId}`
          : null,
      };

      const { data } = await axios.post(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.declareResult}`,
        body,
        { headers }
      );

      if (data.success) {
        setSubmitSuccess("Fan manual settlement completed!");
        await fetchMatches(); // refresh table
        setTimeout(closePayoutModal, 1200);
      } else {
        setSubmitError(data.message || "Settlement failed");
      }
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Error performing settlement"
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  // derived: compute triggered bet payout according to rule:
  // if selectedBet.betType === selectionType -> payout = stakeAmount * 2, else 0
  const triggeredBetPayout = () => {
    if (!selectedBet || !selectionType) return 0;
    try {
      const stake = Number(selectedBet.stakeAmount || 0);
      return (String(selectedBet.betType).toLowerCase() === String(selectionType).toLowerCase())
        ? stake * 2
        : 0;
    } catch {
      return 0;
    }
  };

  // Per-bet void handler
  const voidSingleBet = async (betId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Void bet #${betId}? This will refund the user.`)) return;
    setVoidingBetId(betId);
    try {
      const { data } = await axios.post(
        `${BASE_URL}${ENDPOINTS.sportsSettlement.fancyMatches.replace(/\/fancy-matches$/, '')}/void-single-bet`,
        { bet_id: betId },
        { headers }
      );
      if (data.success) {
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
      <div className="bg-[#0C0D1D] rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold">Fan Internal Settle</h1>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search match or fancy"
            className="w-full md:w-80 p-2 border rounded focus:ring-[#886CFF] focus:border-[#886CFF]"
          />
        </div>

        {loading && <div className="text-center py-8 text-[#878AA2]">Loading...</div>}
        {error && <div className="p-3 bg-red-50 text-red-700 rounded mb-4">{error}</div>}

        {!loading && !error && filteredRows.length === 0 && (
          <div className="text-center py-8 text-[#878AA2]">No fan markets found.</div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="space-y-3">
            {filteredRows.map((r) => {
              const key = `${r.matchId}-${r.fancyName}`;
              const isOpen = !!expanded[key];
              return (
                <div key={key} className="border rounded-lg overflow-hidden">
                  {/* Header row (click to expand) */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#162140]"
                    onClick={() => toggleExpand(key)}
                  >
                    <div>
                      <div className="font-medium text-[#F9F9F9]">{r.matchTitle}</div>
                      <div className="text-sm text-[#878AA2]">{r.fancyName}</div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm text-[#878AA2]">Bets: {formatNumber(r.totalBets)}</div>

                      {/* INFO action button (replaces YES/NO in header) */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openInfoModal(r); }}
                          className="px-3 py-1 text-sm bg-[#886CFF] text-[#F9F9F9] rounded hover:bg-[#9B82FF]"
                        >
                          Info
                        </button>

                        {/* VOID button added here */}
                        <button
                          onClick={(e) => handleVoid(r, e)}
                          className="px-3 py-1 text-sm bg-[#FFC23F] text-[#F9F9F9] rounded hover:bg-[#E0A530]"
                          disabled={!!voidLoading[key]}
                          title="Void / refund this fancy"
                        >
                          {voidLoading[key] ? "Voiding..." : "Void"}
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(key); }}
                          className="px-2 py-1 text-sm bg-[#0E1831] rounded"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* show void success/error under the header when present */}
                  <div className="px-4 pb-3">
                    {voidError[key] && <div className="p-2 text-sm text-red-700 bg-red-50 rounded">{voidError[key]}</div>}
                    {voidSuccess[key] && <div className="p-2 text-sm text-green-700 bg-green-50 rounded">{voidSuccess[key]}</div>}
                  </div>

                  {/* Expanded bets */}
                  {isOpen && (
                    <div className="bg-[#0C0D1D] p-4 border-t">
                      {(!r.bets || r.bets.length === 0) && (
                        <div className="text-[#878AA2]">No bets for this fancy.</div>
                      )}

                      {r.bets && r.bets.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#0E1831]">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs text-[#878AA2] uppercase">User ID</th>
                                <th className="px-3 py-2 text-left text-xs text-[#878AA2] uppercase">Odds</th>
                                <th className="px-3 py-2 text-left text-xs text-[#878AA2] uppercase">Bet Type</th>
                                <th className="px-3 py-2 text-right text-xs text-[#878AA2] uppercase">Stake</th>
                                <th className="px-3 py-2 text-center text-xs text-[#878AA2] uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {r.bets!.map((b) => (
                                <tr key={b.id} className="hover:bg-[#162140]">
                                  <td className="px-3 py-2">{b.userId}</td>
                                  <td className="px-3 py-2">{b.odds}</td>
                                  <td className="px-3 py-2">{b.betType}</td>
                                  <td className="px-3 py-2 text-right">{formatNumber(b.stakeAmount)}</td>
                                  <td className="px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => onBetAction(r, b, "yes")}
                                        className="px-2 py-1 text-xs bg-[#0ECC68] text-[#F9F9F9] rounded hover:bg-[#0BA858]"
                                      >
                                        YES
                                      </button>
                                      <button
                                        onClick={() => onBetAction(r, b, "no")}
                                        className="px-2 py-1 text-xs bg-[#E01B4F] text-[#F9F9F9] rounded hover:bg-[#C0153F]"
                                      >
                                        NO
                                      </button>
                                      <button
                                        onClick={(e) => voidSingleBet(b.id, e)}
                                        disabled={voidingBetId === b.id}
                                        className="px-2 py-1 text-xs bg-orange-600 text-[#F9F9F9] rounded hover:bg-orange-700 disabled:opacity-50"
                                      >
                                        {voidingBetId === b.id ? "..." : "Void"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Modal (header Info button) */}
      {infoMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={closeInfoModal} />
          <div className="relative bg-[#0C0D1D] w-full max-w-md rounded-xl shadow-lg p-6 z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold">Info</h2>
                <p className="text-sm text-[#878AA2]">{infoMatch.matchTitle} — {infoMatch.fancyName}</p>
              </div>
              <button onClick={closeInfoModal} className="text-[#878AA2] hover:text-[#F9F9F9]">✕</button>
            </div>

            <div className="mb-4">
              <div className="text-xs text-[#878AA2]">Selection (default)</div>
              <div className="font-medium uppercase">YES</div>
            </div>

            {infoLoading && <div className="text-center py-6 text-[#878AA2]">Loading info...</div>}
            {infoError && <div className="p-3 bg-red-50 text-red-700 rounded mb-3">{infoError}</div>}

            {infoData && infoData.success && (
              <div className="grid grid-cols-1 gap-3">
                <div className="border rounded p-3 bg-[#0E1831]">
                  <div className="text-xs text-[#878AA2]">Users Liability</div>
                  <div className="text-lg font-semibold">{formatNumber(infoData.total_lability)}</div>
                </div>
                <div className="border rounded p-3 bg-[#0E1831]">
                  <div className="text-xs text-[#878AA2]">Total Users</div>
                  <div className="text-lg font-semibold">{formatNumber(infoData.totalusers)}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button onClick={closeInfoModal} className="px-4 py-2 bg-[#162140] rounded hover:bg-[#1E2D55]">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Modal (per-bet YES/NO) */}
      {selectedMatch && selectionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={closePayoutModal} />

          <div className="relative bg-[#0C0D1D] w-full max-w-2xl rounded-xl shadow-lg p-6 z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold">Fan Payout Summary</h2>
                <p className="text-sm text-[#878AA2]">
                  {selectedMatch.matchTitle} — {selectedMatch.fancyName}
                </p>
                {selectedBet && (
                  <p className="text-xs text-[#878AA2] mt-1">
                    Triggered by Bet ID: {selectedBet.id} • User: {selectedBet.userId} • Stake: {selectedBet.stakeAmount}
                  </p>
                )}
              </div>
              <button onClick={closePayoutModal} className="text-[#878AA2] hover:text-[#F9F9F9]">✕</button>
            </div>

            <div className="mb-4">
              <div className="text-sm">
                <span className="text-[#878AA2]">Selection:</span>{" "}
                <span className="font-medium uppercase">{selectionType}</span>
              </div>
              <div className="text-xs text-[#878AA2]">Match ID: {selectedMatch.matchId} • Event ID: {selectedMatch.eventId}</div>
            </div>

            {payoutLoading && <div className="text-center py-8 text-[#878AA2]">Calculating payout...</div>}
            {payoutError && <div className="p-3 bg-red-50 text-red-700 rounded mb-3">{payoutError}</div>}

            {/* Triggered-bet payout calculation */}
            {selectedBet && (
              <div className="mb-4 border rounded p-3 bg-[#0E1831]">
                <div className="text-xs text-[#878AA2]">Triggered Bet Payout</div>
                <div className="text-lg font-semibold">
                  {formatNumber(triggeredBetPayout())}
                </div>

              </div>
            )}

            {submitError && <div className="p-3 bg-red-50 text-red-700 rounded mb-3">{submitError}</div>}
            {submitSuccess && <div className="p-3 bg-green-50 text-green-700 rounded mb-3">{submitSuccess}</div>}

            <div className="flex justify-end gap-2">
              <button onClick={closePayoutModal} disabled={submitLoading} className="px-4 py-2:bg-[#162140] rounded hover:bg-[#1E2D55]">Cancel</button>
              <button onClick={handleSubmit} disabled={submitLoading || payoutLoading} className="px-4 py-2 bg-[#886CFF] text-[#F9F9F9] rounded hover:bg-[#9B82FF]">
                {submitLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FanInternalSettle;
