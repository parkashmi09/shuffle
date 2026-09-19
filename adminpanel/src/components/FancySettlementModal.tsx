import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { MARKETS_FOR_FANCY, API_ENDPOINTS } from './FancySettlement';

interface FancySettlementModalProps {
  show: boolean;
  onHide: () => void;
  mode: 'declare' | 'void';
  row: any;
  onDone: () => void;
}

export default function FancySettlementModal({ show, onHide, mode, row, onDone }: FancySettlementModalProps) {
  const matchTitle = row?.eventName || row?.matchTitle || '';
  const marketType: string = row?.marketType ?? '';
  const counts: number = row?.counts ?? 1;
  const firstBet = row?.bets?.[0];
  const runners: string[] | null = firstBet?.runners || null;
  const teamOne = row?.teamOne || firstBet?.teamOne || 'Team 1';
  const teamTwo = row?.teamTwo || firstBet?.teamTwo || 'Team 2';

  // Determine UI mode
  const useTeamSelection = mode === 'declare' && !MARKETS_FOR_FANCY.includes(marketType) && counts >= 2;
  const isBinaryFancy = mode === 'declare' && ['fancy1', 'oddeven'].includes(marketType);
  const isThreeWay = counts >= 3;

  const [winnerId, setWinnerId] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setWinnerId('');
      setSelectedOutcome(null);
      setSubmitting(false);
    }
  }, [show, mode, row]);

  const handleSubmit = async () => {
    if (mode === 'declare') {
      if (useTeamSelection && selectedOutcome == null) return;
      if (!useTeamSelection && !winnerId.trim()) return;
    }

    setSubmitting(true);
    try {
      if (mode === 'void') {
        const payload: any = {
          eventid: row.eventId,
          match_id: row.matchId,
          market_type: marketType,
          gametype: row.gameType || 'FAN',
        };
        if (MARKETS_FOR_FANCY.includes(marketType)) {
          payload.selection_name = row.selectionName;
        }
        await apiFetch(API_ENDPOINTS.INTERNALSETTLE.VOID, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        const common = {
          eventid: row.eventId,
          match_id: row.matchId,
          match_title: row.matchTitle,
          game_type: row.gameType || 'FAN',
          market_type: marketType,
        };

        let payload: any;

        if (useTeamSelection) {
          // "others" tab — non-fancy markets with runners/teams
          payload = { ...common, winnerName: selectedOutcome };
        } else if (['fancy1', 'oddeven'].includes(marketType)) {
          // fancy1/oddeven — Yes/No + auto fancyName from selectionName
          payload = { ...common, winnerName: winnerId.trim(), fancyName: row.selectionName };
        } else if (MARKETS_FOR_FANCY.includes(marketType)) {
          // Other fancy markets — winnerId input + auto fancyName
          payload = { ...common, winnerId: winnerId.trim(), fancyName: row.selectionName };
        } else {
          // Fallback
          payload = { ...common, winnerName: winnerId.trim() };
        }

        await apiFetch(API_ENDPOINTS.INTERNALSETTLE.DECLARERESULT, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onDone();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Settlement failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isDeclareReady = useTeamSelection ? selectedOutcome != null : winnerId.trim() !== '';
  const isSubmitDisabled = (mode === 'declare' && !isDeclareReady) || submitting;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    handleSubmit();
  };

  if (!show || !row) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#0E1831] rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#F9F9F9]">
            {mode === 'declare' ? 'Declare Result' : 'Void Match'}
          </h2>
          <button onClick={onHide} className="text-[#878AA2] hover:text-[#F9F9F9] text-xl">&times;</button>
        </div>

        <div className="mb-4 text-[#8384A5] text-sm font-medium">
          {marketType ? `${marketType} — ${matchTitle}` : matchTitle}
        </div>

        <form onSubmit={handleFormSubmit}>
          {/* DECLARE: Team/Runner selection for non-fancy markets (others) */}
          {mode === 'declare' && useTeamSelection && (
            <>
              {runners && runners.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {runners.map((runner, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOutcome(runner)}
                        className={`flex-1 min-w-[80px] px-3 py-2 text-sm font-bold rounded transition-colors ${
                          selectedOutcome === runner
                            ? 'bg-indigo-600 text-[#F9F9F9]'
                            : 'bg-[#162140] text-[#8384A5] hover:bg-[#1E2D55]'
                        }`}
                      >
                        {runner}
                      </button>
                    ))}
                  </div>
                  <div className="text-sm text-[#878AA2] mb-4">
                    {selectedOutcome != null
                      ? <>Result: <span className="text-[#F9F9F9] font-bold">{selectedOutcome}</span></>
                      : <span>Select a runner</span>}
                  </div>
                </>
              ) : isThreeWay ? (
                <>
                  <div className="flex gap-2 mb-3">
                    {[teamOne, 'Draw', teamTwo].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setSelectedOutcome(label)}
                        className={`flex-1 px-3 py-2 text-sm font-bold rounded transition-colors ${
                          selectedOutcome === label
                            ? 'bg-indigo-600 text-[#F9F9F9]'
                            : 'bg-[#162140] text-[#8384A5] hover:bg-[#1E2D55]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="text-sm text-[#878AA2] mb-4">
                    {selectedOutcome != null
                      ? <>Result: <span className="text-[#F9F9F9] font-bold">{selectedOutcome}</span></>
                      : <span>Select Team 1, Draw, or Team 2</span>}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2 items-center mb-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOutcome(teamOne)}
                      className={`flex-1 px-3 py-2 text-sm font-bold rounded transition-colors ${
                        selectedOutcome === teamOne
                          ? 'bg-indigo-600 text-[#F9F9F9]'
                          : 'bg-[#162140] text-[#8384A5] hover:bg-[#1E2D55]'
                      }`}
                    >
                      {teamOne}
                    </button>
                    <span className="text-[#878AA2] text-xs font-bold">VS</span>
                    <button
                      type="button"
                      onClick={() => setSelectedOutcome(teamTwo)}
                      className={`flex-1 px-3 py-2 text-sm font-bold rounded transition-colors ${
                        selectedOutcome === teamTwo
                          ? 'bg-indigo-600 text-[#F9F9F9]'
                          : 'bg-[#162140] text-[#8384A5] hover:bg-[#1E2D55]'
                      }`}
                    >
                      {teamTwo}
                    </button>
                  </div>
                  <div className="text-sm text-[#878AA2] mb-4">
                    {selectedOutcome != null
                      ? <>Result: <span className="text-[#F9F9F9] font-bold">{selectedOutcome}</span></>
                      : <span>Select winner</span>}
                  </div>
                </>
              )}
            </>
          )}

          {/* DECLARE: fancy1/oddeven — Yes/No buttons */}
          {mode === 'declare' && !useTeamSelection && isBinaryFancy && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#8384A5] mb-2">Winner Name</label>
              <div className="flex gap-2">
                {['Yes', 'No'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setWinnerId(val)}
                    className={`flex-1 px-3 py-2 text-sm font-bold rounded transition-colors ${
                      winnerId === val
                        ? 'bg-indigo-600 text-[#F9F9F9]'
                        : 'bg-[#162140] text-[#8384A5] hover:bg-[#1E2D55]'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DECLARE: Other fancy markets — text input for winnerId */}
          {mode === 'declare' && !useTeamSelection && !isBinaryFancy && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#8384A5] mb-2">Winner ID</label>
              <input
                type="text"
                value={winnerId}
                onChange={(e) => setWinnerId(e.target.value)}
                className="w-full px-3 py-2 bg-[#162140] border border-[#1E2D55] rounded-md text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter winner id"
                autoFocus
              />
            </div>
          )}

          {/* VOID confirmation */}
          {mode === 'void' && (
            <div className="text-[#8384A5] text-sm mb-4">
              Do you really want to cancel or refund the bets? All stakes will be refunded to the users. This action cannot be undone.
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onHide}
              className="flex-1 px-4 py-2 bg-[#162140] text-[#F9F9F9] rounded-md hover:bg-[#1E2D55] transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`flex-1 px-4 py-2 text-[#F9F9F9] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'void'
                  ? 'bg-[#E01B4F] hover:bg-[#E01B4F]'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {submitting ? 'Submitting...' : mode === 'void' ? 'Confirm Void' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
