import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import FancySettlementModal from './FancySettlementModal';

const LIMIT = 100;
const DEFAULT_OFFSET = 0;

const API_ENDPOINTS = {
  INTERNALSETTLE: {
    FANMATCHES: '/api/internalsettle/fanmatches',
    DECLARERESULT: '/api/internalsettle/declareresult',
    VOID: '/api/internalsettle/void',
    OPENBETS: '/api/internalsettle/open-bets',
    VOIDSINGLEBET: '/api/internalsettle/void-single-bet',
  },
};

export const MARKETS_FOR_FANCY = [
  '1st Innings 6 Overs Line',
  '2nd Innings 6 Overs Line',
  '3rd Innings 6 Overs Line',
  '1st Innings 50 Overs Line',
  '2nd Innings 50 Overs Line',
  '3rd Innings 50 Overs Line',
  '1st Innings 40 Overs Line',
  '2nd Innings 40 Overs Line',
  '3rd Innings 40 Overs Line',
  '1st Innings 30 Overs Line',
  '2nd Innings 30 Overs Line',
  '3rd Innings 30 Overs Line',
  '1st Innings 20 Overs Line',
  '2nd Innings 20 Overs Line',
  '3rd Innings 20 Overs Line',
  '1st Innings 10 Overs Line',
  '2nd Innings 10 Overs Line',
  '3rd Innings 10 Overs Line',
  'Over By Over',
  'Ball By Ball',
  'Normal',
  'khado',
  'meter',
  'fancy1',
  'oddeven',
];

function getOrderedTabKeys(data: Record<string, any[]>): string[] {
  if (!data || typeof data !== 'object') return [];
  const keysWithData = Object.keys(data).filter(
    (k) => Array.isArray(data[k]) && data[k].length > 0
  );
  const ordered: string[] = [];
  for (const name of MARKETS_FOR_FANCY) {
    if (keysWithData.includes(name)) ordered.push(name);
  }
  if (keysWithData.includes('others')) ordered.push('others');
  for (const k of keysWithData) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered;
}

export { API_ENDPOINTS };

export default function FancySettlement() {
  const [fancyData, setFancyData] = useState<Record<string, any[]> | null>(null);
  const [tabKeys, setTabKeys] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalShow, setModalShow] = useState(false);
  const [modalMode, setModalMode] = useState<'declare' | 'void'>('declare');
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-bet void state
  const [viewBetsRow, setViewBetsRow] = useState<any>(null);
  const [openBets, setOpenBets] = useState<any[]>([]);
  const [openBetsLoading, setOpenBetsLoading] = useState(false);
  const [voidingBetId, setVoidingBetId] = useState<number | null>(null);

  const fetchFanmatches = async (silent = false) => {
    if (!silent) {
      setError(null);
      setLoading(true);
    }
    try {
      // `apiFetch` unwraps the `{ success, data }` envelope, so `res` is already
      // the payload — an object keyed by market type. Gating on `res.success`
      // tested a field that no longer exists on the unwrapped value, so this
      // took the `else` branch on EVERY successful load and the tab was blank.
      const res = await apiFetch<Record<string, any[]>>(
        `${API_ENDPOINTS.INTERNALSETTLE.FANMATCHES}?limit=${LIMIT}&offset=${DEFAULT_OFFSET}`
      );
      if (res && typeof res === 'object' && !Array.isArray(res)) {
        const data = res;
        setFancyData(data);
        const ordered = getOrderedTabKeys(data);
        setTabKeys(ordered);
        setActiveTab((prev) =>
          ordered.length > 0 && (!prev || !ordered.includes(prev)) ? ordered[0] : prev
        );
      } else {
        setFancyData({});
        setTabKeys([]);
      }
    } catch (err: any) {
      if (!silent) {
        console.error('Error fetching fancy matches:', err);
        setError(err?.message || 'Unable to load matches');
      }
      setFancyData({});
      setTabKeys([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFanmatches();
    const interval = setInterval(() => fetchFanmatches(true), 2000);
    return () => clearInterval(interval);
  }, []);

  const rows = activeTab && fancyData && Array.isArray(fancyData[activeTab])
    ? fancyData[activeTab]
    : [];

  // Fetch open bets for a fancy row
  const fetchOpenBets = async (row: any) => {
    setViewBetsRow(row);
    setOpenBetsLoading(true);
    setOpenBets([]);
    try {
      const params = new URLSearchParams({
        match_id: row.matchId,
        market_type: row.marketType || activeTab || '',
        game_type: row.gameType || 'FAN',
        selection_name: row.selectionName || '',
      });
      // Unwrapped by `apiFetch` — already the array. The old `res?.success`
      // guard was never true, so the open-bets table never populated.
      const res = await apiFetch<any[]>(
        `${API_ENDPOINTS.INTERNALSETTLE.OPENBETS}?${params}`
      );
      setOpenBets(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error('fetchOpenBets error:', err);
    } finally {
      setOpenBetsLoading(false);
    }
  };

  const voidSingleBet = async (betId: number) => {
    if (!window.confirm(`Void bet #${betId}? This will refund the user.`)) return;
    setVoidingBetId(betId);
    try {
      const res = await apiFetch<{ success?: boolean; error?: string }>(
        API_ENDPOINTS.INTERNALSETTLE.VOIDSINGLEBET,
        { method: 'POST', body: JSON.stringify({ bet_id: betId }) }
      );
      if (res?.success) {
        setOpenBets((prev) => prev.filter((b) => b.id !== betId));
        fetchFanmatches(true);
      } else {
        alert(res?.error || 'Failed to void bet');
      }
    } catch (err: any) {
      alert(err?.message || 'Error voiding bet');
    } finally {
      setVoidingBetId(null);
    }
  };

  const handleDeclare = (row: any) => {
    setSelectedRow({ ...row, marketType: row.marketType || activeTab });
    setModalMode('declare');
    setModalShow(true);
  };

  const handleVoid = (row: any) => {
    setSelectedRow({ ...row, marketType: row.marketType || activeTab });
    setModalMode('void');
    setModalShow(true);
  };

  const handleModalDone = () => {
    setModalShow(false);
    setSelectedRow(null);
    fetchFanmatches(true);
  };

  return (
    <div className="min-h-screen bg-[#0C0D1D] text-[#F9F9F9] p-6">
       <div>
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Fancy Settlement</h1>
            <p className="text-[#878AA2] text-sm mt-1">Live fancy bet settlement dashboard.</p>
          </div>
          <button
            type="button"
            onClick={() => fetchFanmatches()}
            disabled={loading}
            className="px-4 py-2 bg-[#0E1831] text-[#F9F9F9] text-[14px] font-bold hover:bg-[#162140] transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <div className="mb-4 text-[#E01B4F]">{error}</div>}

        {/* Dynamic tabs from API keys */}
        <div className="bg-[#0E1831] p-4 rounded-lg shadow-lg mb-6">
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabKeys.map((key) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-semibold rounded ${
                  activeTab === key
                    ? 'bg-indigo-600 text-[#F9F9F9]'
                    : 'bg-[#162140] text-[#8384A5] hover:bg-[#1E2D55]'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-[#162140]">
                  <th className="text-left px-4 py-2 text-[#8384A5] font-semibold w-[30%]">Match Title</th>
                  <th className="text-left px-4 py-2 text-[#8384A5] font-semibold w-[25%]">
                    {activeTab && MARKETS_FOR_FANCY.includes(activeTab) ? 'Market Name' : 'Market Type'}
                  </th>
                  <th className="text-right px-4 py-2 text-[#8384A5] font-semibold w-[15%]">Total Bets</th>
                  <th className="text-center px-4 py-2 text-[#8384A5] font-semibold w-[30%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center text-[#8384A5] py-4">Loading...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-[#8384A5] py-4">No matches found</td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`${row.matchId}-${row.eventId}-${index}`}
                      className={index % 2 === 0 ? 'bg-[rgba(245,245,245,0.08)]' : ''}
                    >
                      <td className="py-2 px-4 text-cyan-300 font-medium truncate">
                        {row.eventName || row.matchTitle || '-'}
                      </td>
                      <td className="py-2 px-4 text-[#F9F9F9] font-semibold truncate">
                        {activeTab && MARKETS_FOR_FANCY.includes(activeTab)
                          ? (row.selectionName || '-')
                          : (row.marketType ?? activeTab ?? '-')}
                      </td>
                      <td className="py-2 px-4 text-right text-[#F9F9F9] font-semibold">{row.totalBets ?? 0}</td>
                      <td className="py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDeclare(row)}
                            className="px-3 py-1 bg-indigo-600 text-[#F9F9F9] text-xs font-bold rounded hover:bg-indigo-500 transition-colors"
                          >
                            Declare
                          </button>
                          <button
                            onClick={() => handleVoid(row)}
                            className="px-3 py-1 bg-[#162140] text-[#F9F9F9] text-xs font-bold rounded hover:bg-[#1E2D55] transition-colors"
                          >
                            Void
                          </button>
                          <button
                            onClick={() => fetchOpenBets(row)}
                            className="px-3 py-1 bg-purple-600 text-[#F9F9F9] text-xs font-bold rounded hover:bg-purple-500 transition-colors"
                          >
                            View Bets
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View Bets Modal (per-bet void) */}
        {viewBetsRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => { setViewBetsRow(null); setOpenBets([]); }} />
            <div className="relative bg-[#0E1831] w-full max-w-4xl rounded-xl shadow-xl p-6 max-h-[80vh] overflow-y-auto border border-[#1E2D55]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#F9F9F9]">Open Bets — Per Bet Void</h2>
                  <p className="text-sm text-[#878AA2] mt-1">
                    {viewBetsRow.eventName || viewBetsRow.matchTitle || '-'}
                  </p>
                  <p className="text-xs text-[#878AA2]">
                    Market: {viewBetsRow.marketType || activeTab || '-'}
                    {viewBetsRow.selectionName ? ` • Selection: ${viewBetsRow.selectionName}` : ''}
                    {' '}• Match ID: {viewBetsRow.matchId}
                  </p>
                </div>
                <button
                  onClick={() => { setViewBetsRow(null); setOpenBets([]); }}
                  className="text-[#878AA2] hover:text-[#F9F9F9] text-xl font-bold ml-4"
                >
                  ✕
                </button>
              </div>

              {openBetsLoading && (
                <div className="text-center text-[#878AA2] py-10">Loading bets...</div>
              )}

              {!openBetsLoading && openBets.length === 0 && (
                <div className="text-center text-[#878AA2] py-10">No open bets found for this market.</div>
              )}

              {!openBetsLoading && openBets.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#162140]">
                        <th className="px-3 py-2 text-left text-xs text-[#8384A5] font-semibold">Bet ID</th>
                        <th className="px-3 py-2 text-left text-xs text-[#8384A5] font-semibold">User</th>
                        <th className="px-3 py-2 text-left text-xs text-[#8384A5] font-semibold">Selection</th>
                        <th className="px-3 py-2 text-center text-xs text-[#8384A5] font-semibold">Type</th>
                        <th className="px-3 py-2 text-center text-xs text-[#8384A5] font-semibold">Odds</th>
                        <th className="px-3 py-2 text-right text-xs text-[#8384A5] font-semibold">Stake</th>
                        <th className="px-3 py-2 text-right text-xs text-[#8384A5] font-semibold">Liability</th>
                        <th className="px-3 py-2 text-center text-xs text-[#8384A5] font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openBets.map((b: any, idx: number) => (
                        <tr key={b.id} className={idx % 2 === 0 ? 'bg-[rgba(245,245,245,0.05)]' : ''}>
                          <td className="px-3 py-2 text-[#8384A5] font-mono text-xs">{b.id}</td>
                          <td className="px-3 py-2">
                            <div className="text-[#F9F9F9] font-medium">{b.username}</div>
                            <div className="text-xs text-[#878AA2]">ID: {b.userId}</div>
                          </td>
                          <td className="px-3 py-2 text-[#8384A5]">{b.selectionName || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                              ['back', 'yes'].includes((b.betType || '').toLowerCase())
                                ? 'bg-[#886CFF]/20 text-blue-300'
                                : 'bg-pink-500/20 text-pink-300'
                            }`}>{b.betType || '-'}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-[#F9F9F9] font-bold">{Number(b.odds).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-[#F9F9F9]">{Number(b.stakeAmount).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-[#F9F9F9]">{Number(b.liability).toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => voidSingleBet(b.id)}
                              disabled={voidingBetId === b.id}
                              className="px-3 py-1 bg-[#E01B4F] text-[#F9F9F9] text-xs font-bold rounded hover:bg-[#E01B4F] transition-colors disabled:opacity-50"
                            >
                              {voidingBetId === b.id ? 'Voiding...' : 'Void'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-sm text-[#878AA2] mt-3">
                    {openBets.length} open bet{openBets.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <FancySettlementModal
          show={modalShow}
          onHide={() => {
            setModalShow(false);
            setSelectedRow(null);
          }}
          mode={modalMode}
          row={selectedRow}
          onDone={handleModalDone}
        />
      </div>
      </div>
    </div>
  );
}
