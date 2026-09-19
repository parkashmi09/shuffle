import React, { useEffect, useState } from 'react';

interface SettlementModalProps {
  show: boolean;
  onHide: () => void;
  mode: 'declare' | 'void';
  match: any;
  onSubmit: (payload: { mode: 'declare' | 'void'; winnerName?: string }) => Promise<void> | void;
}

const SettlementModal: React.FC<SettlementModalProps> = ({ show, onHide, mode, match, onSubmit }) => {
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setSelectedOutcome(null);
      setSubmitting(false);
    }
  }, [show, mode]);

  if (!show) return null;

  const teamOne = match?.teamOne || 'Team 1';
  const teamTwo = match?.teamTwo || 'Team 2';
  const runners = match?.runners || [teamOne, 'Draw', teamTwo];
  const matchTitle = match?.matchTitle || `${teamOne} vs ${teamTwo}`;

  const canSubmit = mode === 'void' || selectedOutcome !== null;
  const buttonText = mode === 'void' ? 'Confirm Void' : 'Submit';

  const onFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const winnerName = mode === 'declare' ? (runners[selectedOutcome ?? 0] ?? teamOne) : undefined;
      await onSubmit({ mode, winnerName });
      onHide();
    } catch (err) {
      console.error('SettlementModal submit error', err);
      alert('Unable to complete settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-[#0C0D1D] border border-[#1E2D55] shadow-lg">
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#1E2D55]">
          <h3 className="text-lg font-bold text-[#F9F9F9]">{mode === 'void' ? 'Void Match' : 'Declare Result'}</h3>
          <button onClick={onHide} className="text-[#F9F9F9] text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={onFormSubmit} className="px-4 py-4">
          <p className="text-sm text-[#8384A5] mb-4">{matchTitle}</p>

          {mode === 'declare' ? (
            <div className="grid grid-cols-1 gap-2"> 
              {runners.map((runner: string, index: number) => (
                <button
                  type="button"
                  key={`${runner}-${index}`}
                  className={`rounded px-3 py-2 text-left text-sm ${selectedOutcome === index ? 'bg-indigo-600 text-[#F9F9F9]' : 'bg-[#0E1831] text-[#F9F9F9] hover:bg-[#162140]'}`}
                  onClick={() => setSelectedOutcome(index)}
                >
                  {runner}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[#8384A5] p-3 bg-[#0E1831] rounded">This will void the match and refund stale bets. This action cannot be undone.</div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onHide} className="px-4 py-2 bg-[#162140] text-[#F9F9F9] rounded hover:bg-[#1E2D55]">Cancel</button>
            <button type="submit" disabled={!canSubmit || submitting} className="px-4 py-2 bg-indigo-600 text-[#F9F9F9] rounded hover:bg-indigo-500 disabled:opacity-50">
              {submitting ? 'Processing...' : buttonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettlementModal;
