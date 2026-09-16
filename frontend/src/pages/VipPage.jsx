import { vip as vipApi } from "../lib/endpoints";
import { useApi } from "../lib/useResource";
import { useSession } from "../lib/sessionContext";
import VipPublic from "../components/vip/VipPublic";
import VipOverview from "../components/vip/VipOverview";
import VipRewards from "../components/vip/VipRewards";
import VipLevels from "../components/vip/VipLevels";
import VipBenefitsTable from "../components/vip/VipBenefitsTable";

/**
 * `/vip-program` — reference `pages/vip-program`.
 *
 * Two entirely different pages behind one route, and the reference switches on
 * exactly one thing: whether anybody is signed in.
 *
 *   signed out  the marketing page — hero, getting started, advantages, the
 *               rank schedule, FAQ.
 *   signed in   the member page — where you stand, what you can claim, the
 *               whole ladder, and the same schedule.
 *
 * Until now this route served the marketing page to everyone, including
 * players whose rank and progress the backend has been able to answer since
 * `modules/vip` was written.
 *
 * `restoring` is a third state the reference does not have to think about
 * (it renders on the server with the session already resolved). Here a stored
 * token is checked asynchronously on load, so rendering the signed-out page
 * during that check would flash the marketing hero at a member for a frame.
 */
function VipMember({ user }) {
  const { data: vip } = useApi("vip:progress", () => vipApi.progress());
  const { data: levels } = useApi("vip:levels", () => vipApi.levels());

  return (
    <section className="LayoutContainer_root LayoutContainer_column LayoutContainer_mobile-top-md2 LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-top-lg1 LayoutContainer_tablet-bottom-lg1 LayoutContainer_desktop-top-lg1 LayoutContainer_desktop-bottom-lg1">
      <h2 className="Heading_root Heading_h2 TitlePage_root">VIP Program</h2>

      <VipOverview username={user?.name} vip={vip} levels={levels} />
      <VipRewards levels={levels} />
      <VipLevels levels={levels} vip={vip} />

      <div className="VipOverviewSectionWrapper_root">
        <div className="VipBenefits_headingWrapper">
          <img src="/icons/rocket.svg" height="24" width="24" alt="rocket" className="VipBenefits_headingIcon" />
          <span className="VipSectionTitle_root">The benefits</span>
        </div>
        <VipBenefitsTable />
      </div>
    </section>
  );
}

export default function VipPage() {
  const { signedIn, restoring, user } = useSession();

  // Nothing, briefly, rather than the wrong one of the two pages.
  if (restoring) return <div className="VipPagePublic_root" />;

  return signedIn ? <VipMember user={user} /> : <VipPublic />;
}
