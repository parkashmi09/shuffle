import { useEffect, useRef } from "react";
import { vip } from "./endpoints";
import { useGate } from "./gates";
import { useSession } from "./sessionContext";
import { useSiteVersion } from "./siteLive";

/** Claims what is waiting. Resolves true when something was paid. One attempt: a failure waits for the next trigger. */
export async function claimWaitingRankUps(read = vip.rankUps, claim = vip.claimRankUps) {
  const waiting = await read();
  if (!waiting?.cards?.length) return false;
  const paid = await claim();
  return Boolean(paid?.granted?.length);
}

/**
 * Hash pays a VIP rank-up with the level-up; this backend holds it behind a claim. So the signed-in
 * site claims for the player: once on session load, and again on a `vip_rank_up` push (lib/siteLive.js).
 * Only while VIP is on — never an agent's player or a demo account.
 */
export function useVipRankUps() {
  const { signedIn, mustChangePassword, refreshBalances } = useSession();
  const on = useGate();
  const enabled = signedIn && !mustChangePassword && on.ready && on("vip") && !on.agentPlayer && !on.demo;
  const pushes = useSiteVersion("vip");
  const paidRef = useRef(refreshBalances);
  useEffect(() => {
    paidRef.current = refreshBalances;
  }, [refreshBalances]);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    claimWaitingRankUps().then(
      (paid) => paid && live && paidRef.current?.(),
      () => {} // not retried here: the next rank-up or session load asks again
    );
    return () => {
      live = false;
    };
  }, [enabled, pushes]);
}

if (import.meta.env.DEV) {
  let claims = 0;
  const claim = async () => {
    claims += 1;
    return { granted: [{ card: "gold" }] };
  };
  claimWaitingRankUps(async () => ({ cards: [] }), claim)
    .then((paid) => console.assert(paid === false && claims === 0, "rank-ups: nothing waiting"))
    .then(() => claimWaitingRankUps(async () => ({ cards: ["gold"] }), claim))
    .then((paid) => console.assert(paid === true && claims === 1, "rank-ups: one claim"))
    .catch(() => console.assert(false, "rank-ups: self-check threw"));
}
