import { DialogShell } from '../../components/exchange/stakeKit';
import { exchangeCoin } from '../../hooks/exchange/useExchangeCurrency';
import { useSession } from '../../lib/sessionContext';
import { useGate } from '../../../lib/gates';
import { navigate } from '../../../lib/router';

/**
 * The exchange is INR-only: any exchange page with a non-INR header wallet asks to switch (hash's
 * SportsInrDialog). Go back, the cross and Escape all leave the sports pages for home.
 */
export default function SportsInrDialog() {
  const { signedIn, balances, currency, setCurrency } = useSession();
  const { agentPlayer } = useGate();
  // The header's coin is only known once the wallet has answered, so a player holding only INR is never asked.
  if (!balances || exchangeCoin({ signedIn, agent: agentPlayer, currency }) === 'INR') return null;

  const leave = () => navigate('/');

  return (
    <DialogShell title="Sports betting is in INR" onClose={leave}>
      <div className="pb-4 pt-2">
        <p className="text-sm text-secondary">Sports betting is in INR — switch your currency to INR to continue.</p>
        <div className="mt-6 flex gap-3">
          <button type="button" className="button button-m button-second flex-1" onClick={leave}>
            Go back
          </button>
          <button type="button" className="button button-m button-brand flex-1" onClick={() => setCurrency('INR')}>
            Switch to INR
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
