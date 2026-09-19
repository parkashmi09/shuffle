import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import SettlementModal from './SettlementModal';

const LIMIT = 100;
const DEFAULT_OFFSET = 0;

const API_ENDPOINTS = {
  INTERNALSETTLE: {
    MOMATCHES: '/api/internalsettle/momatches',
    DECLARERESULT: '/api/internalsettle/declareresult',
    VOID: '/api/internalsettle/void',
    OPENBETS: '/api/internalsettle/open-bets',
    VOIDSINGLEBET: '/api/internalsettle/void-single-bet',
  },
};

export default function MatchSettlement() {
  const [activeTab, setActiveTab] = useState<'MO' | 'BM'>('MO');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalShow, setModalShow] = useState(false);
  const [modalMode, setModalMode] = useState<'declare' | 'void'>('declare');
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-bet void state
  const [viewBetsRow, setViewBetsRow] = useState<any>(null);
  const [openBets, setOpenBets] = useState<any[]>([]);
  const [openBetsLoading, setOpenBetsLoading] = useState(false);
  const [voidingBetId, setVoidingBetId] = useState<number | null>(null);

  const fetchMatches = async (silent = false) => {
    if (!silent) {
      setError(null);
      setLoading(true);
    }

    try {
      const res = await apiFetch<{ success?: boolean; data?: any[] }>(
        `${API_ENDPOINTS.INTERNALSETTLE.MOMATCHES}?limit=${LIMIT}&offset=${DEFAULT_OFFSET}`
      );
      if (res?.success && Array.isArray(res.data)) {
        setMatches(res.data);
      } else if (Array.isArray(res)) {
        setMatches(res);
      } else {
        setMatches([]);
      }
    } catch (err: any) {
      console.error('Error fetching MO/BM matches:', err);
      setError(err?.message || 'Unable to load matches');
      setMatches([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(() => fetchMatches(true), 2000);
    return () => clearInterval(interval);
  }, []);

  const filteredMatches = matches.filter((m) => m.gameType === activeTab);

  const totalMatched = matches.length;
  const moCount = matches.filter((m) => m.gameType === 'MO').length;
  const bmCount = matches.filter((m) => m.gameType === 'BM').length;
  const totalBets = matches.reduce((acc, m) => acc + (Number(m.totalBets) || 0), 0);

  const handleDeclare = (row: any) => {
    setSelectedMatch(row);
    setModalMode('declare');
    setModalShow(true);
  };

  const handleVoid = (row: any) => {
    setSelectedMatch(row);
    setModalMode('void');
    setModalShow(true);
  };

  // Fetch open bets for a market row
  const fetchOpenBets = async (row: any) => {
    setViewBetsRow(row);
    setOpenBetsLoading(true);
    setOpenBets([]);
    try {
      const params = new URLSearchParams({
        match_id: row.matchId,
        market_type: row.marketType,
        game_type: row.gameType,
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
        fetchMatches(true);
      } else {
        alert(res?.error || 'Failed to void bet');
      }
    } catch (err: any) {
      alert(err?.message || 'Error voiding bet');
    } finally {
      setVoidingBetId(null);
    }
  };

  const handleSettlementSubmit = async (payload: { winnerName?: string; mode: 'declare' | 'void' }) => {
    if (!selectedMatch) return;

    setLoading(true);
    setError(null);

    try {
      if (payload.mode === 'declare') {
        await apiFetch(API_ENDPOINTS.INTERNALSETTLE.DECLARERESULT, {
          method: 'POST',
          body: JSON.stringify({
            eventid: selectedMatch.eventId,
            match_id: selectedMatch.matchId,
            match_title: selectedMatch.matchTitle || `${selectedMatch.teamOne || 'Team 1'} vs ${selectedMatch.teamTwo || 'Team 2'}`,
            game_type: selectedMatch.gameType || 'FAN',
            market_type: selectedMatch.marketType || 'UNKNOWN',
            winnerName: payload.winnerName || '',
          }),
        });
      } else {
        await apiFetch(API_ENDPOINTS.INTERNALSETTLE.VOID, {
          method: 'POST',
          body: JSON.stringify({
            eventid: selectedMatch.eventId,
            match_id: selectedMatch.matchId,
            game_type: selectedMatch.gameType || 'FAN',
            market_type: selectedMatch.marketType || 'UNKNOWN',
          }),
        });
      }

      setModalShow(false);
      setSelectedMatch(null);
      await fetchMatches(true);
    } catch (err: any) {
      console.error('Settlement submit error:', err);
      setError(err?.message || 'Settlement failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0D1D] text-[#F9F9F9] p-6">
       <div className="">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Match Settlement</h1>
            <p className="text-[#878AA2] text-sm mt-1">Live match settlement dashboard for MO/BM.</p>
          </div>
          <button
            type="button"
            onClick={() => fetchMatches()}
            disabled={loading}
            className="px-4 py-2 bg-[#11374a] text-[#F9F9F9] text-[14px] font-bold hover:bg-[#1a4f66] transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <div className="mb-4 text-[#E01B4F]">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0E1831] p-5 rounded-lg shadow-lg">
            <p className="text-[#878AA2] text-xs uppercase tracking-wider">Total Matches</p>
            <p className="text-[#F9F9F9] text-3xl font-bold mt-2">{totalMatched}</p>
          </div>
          <div className="bg-[#0E1831] p-5 rounded-lg shadow-lg">
            <p className="text-[#878AA2] text-xs uppercase tracking-wider">Match Odds (MO)</p>
            <p className="text-[#F9F9F9] text-3xl font-bold mt-2">{moCount}</p>
          </div>
          <div className="bg-[#0E1831] p-5 rounded-lg shadow-lg">
            <p className="text-[#878AA2] text-xs uppercase tracking-wider">Bookmaker (BM)</p>
            <p className="text-[#F9F9F9] text-3xl font-bold mt-2">{bmCount}</p>
          </div>
          <div className="bg-[#0E1831] p-5 rounded-lg shadow-lg">
            <p className="text-[#878AA2] text-xs uppercase tracking-wider">Total Bets</p>
            <p className="text-[#F9F9F9] text-3xl font-bold mt-2">{totalBets}</p>
          </div>
        </div>

        <div className="bg-[#0E1831] p-4 rounded-lg shadow-lg mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('MO')}
              className={`px-4 py-2 text-sm font-semibold rounded ${activeTab === 'MO' ? 'bg-indigo-600 text-[#F9F9F9]' : 'bg-[#162140] text-[#8384A5] hover:bg-[#1E2D55]'}`}
            >
              Match Odds
            </button>
            <button
              onClick={() => setActiveTab('BM')}
              className={`px-4 py-2 text-sm font-semibold rounded ${activeTab === 'BM' ? 'bg-indigo-600 text-[#F9F9F9]' : 'bg-[#162140] text-[#8384A5] hover:bg-[#1E2D55]'}`}
            >
              Bookmaker
            </button>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-[#162140]">
                  <th className="text-left px-4 py-2 text-[#8384A5] font-semibold w-[30%]">Match Title</th>
                  <th className="text-left px-4 py-2 text-[#8384A5] font-semibold w-[20%]">Market Type</th>
                  <th className="text-right px-4 py-2 text-[#8384A5] font-semibold w-[15%]">Total Bets</th>
                  <th className="text-center px-4 py-2 text-[#8384A5] font-semibold w-[35%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center text-[#8384A5] py-4">
                      Loading...
                    </td>
                  </tr>
                ) : filteredMatches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-[#8384A5] py-4">
                      No matches found
                    </td>
                  </tr>
                ) : (
                  filteredMatches.map((row, index) => (
                    <tr
                      key={`${row.matchId ?? index}-${row.eventId ?? '-'}-${row.gameType ?? ''}`}
                      className={index % 2 === 0 ? 'bg-[rgba(245,245,245,0.08)]' : ''}
                    >
                      <td className="py-2 px-4 text-cyan-300 font-medium truncate max-w-[250px]">
                        {row.matchTitle ?? `${row.teamOne || 'Team 1'} vs ${row.teamTwo || 'Team 2'}`}
                      </td>
                      <td className="py-2 px-4 text-[#F9F9F9] font-semibold truncate">{row.marketType || '-'}</td>
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
                    {viewBetsRow.matchTitle ?? `${viewBetsRow.teamOne || 'Team 1'} vs ${viewBetsRow.teamTwo || 'Team 2'}`}
                  </p>
                  <p className="text-xs text-[#878AA2]">
                    Market: {viewBetsRow.marketType || '-'} • Game: {viewBetsRow.gameType || '-'} • Match ID: {viewBetsRow.matchId}
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

        <SettlementModal
          show={modalShow}
          onHide={() => {
            setModalShow(false);
            setSelectedMatch(null);
          }}
          mode={modalMode}
          match={selectedMatch}
          onSubmit={handleSettlementSubmit}
        />
      </div>
      </div>
    </div>
  );
}
