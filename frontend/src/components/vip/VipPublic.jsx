import VipBenefitsTable from "./VipBenefitsTable";
import VipFaqs from "./VipFaqs";

/**
 * The signed-out VIP page — reference `VipPagePublic`.
 *
 * A hero, then four sections separated by dividers: how to start, what the
 * programme gives you, the rank-by-rank schedule, and the FAQ. Everything a
 * visitor can see without an account.
 *
 * This was previously the page's captured HTML, rendered through
 * `dangerouslySetInnerHTML` with an effect that reached into the DOM to work
 * the accordions. The markup below is that same capture, element for element
 * and class for class — what changed is that React owns it, so the benefits
 * table and the FAQ can be shared with the signed-in page instead of existing
 * twice.
 *
 * `Play now` opens the auth modal, which is what the reference's button does
 * (it pushes `?modal=auth&tab=login`). `shuffle:auth` is this app's event for
 * that, already listened for by `AppShell`.
 */

const STEPS = [
  {
    n: 1,
    title: "Step 1",
    before: "You can sign up instantly and start betting on a range of games in the",
    highlight: "Shuffle casino",
    after: ".",
  },
  {
    n: 2,
    title: "Step 2",
    before: "Earn XP with each bet and level-up to get access to new and exciting benefits in our",
    highlight: "VIP Program",
    after: ".",
  },
  {
    n: 3,
    title: "Step 3",
    before: "You can redeem your prizes and enjoy the best-in-class premium",
    highlight: "VIP Program",
    /* A normal space, "at", then a non-breaking space — the reference's own
       spacing, so "at Shuffle.com" cannot break across two lines. */
    middle: " at ",
    highlight2: "Shuffle.com",
    after: ".",
  },
];

const ADVANTAGES = [
  {
    img: "/images/vip/advantages/support.png",
    alt: "vip support",
    title: "24/7 support",
    text: "We provide around the clock support for your gaming needs to answer any of your questions or aid you with enjoying your experience with Shuffle to the max.",
  },
  {
    img: "/images/vip/advantages/levelup-progress.png",
    alt: "level up",
    title: "Level-up and progress",
    text: "We prioritize creating a satisfying level progression experience for all of our users. As you wager more and play consistently at Shuffle, we’ll ensure you’re rewarded.",
  },
  {
    img: "/images/vip/advantages/boosts-reloads.png",
    alt: "boost",
    title: "Regular boosts and reloads",
    text: "Shuffle will provide you with frequent boosts daily, weekly and monthly. We will also offer you reloads when you’re on a bad turn of luck or whenever you level up!",
  },
  {
    img: "/images/vip/advantages/dedicated-hosts.png",
    alt: "host",
    title: "Dedicated VIP hosts",
    text: "For high ranking users, we will provide a best in class dedicated VIP host for you that includes tailored bonuses and frequent reloads to aid in making your experience at Shuffle unmatched anywhere else.",
  },
];

function Section({ title, children }) {
  return (
    <div className="VipPagePublicContainer_root">
      <h2 className="Heading_root Heading_h2">{title}</h2>
      {children}
    </div>
  );
}

export default function VipPublic() {
  const openAuth = () => window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: "login" }));

  return (
    <div className="VipPagePublic_root">
      <div className="VipPagePublic_vipPagePublicHero">
        <div className="VipPagePublic_vipPagePublicHeroImage">
          <img src="/images/banners/vip-hero-banner.png" alt="banner" />
        </div>
        <div className="Flex_root Flex_column VipPagePublic_vipContentArea">
          <div>
            <h1 className="Heading_root Heading_h1 VipPagePublic_heading">Enjoy a premium VIP experience</h1>
          </div>
          <p className="VipPagePublic_subHeading">
            Shuffle’s VIP program is designed to suit all different types of players with an emphasis on ensuring
            you receive the most in cumulative bonuses for every dollar you wager.
          </p>
          <div className="VipPagePublic_vipPagePublicButtons">
            <button
              type="button"
              onClick={openAuth}
              className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
            >
              <span className="ButtonVariants_buttonContent">Play now</span>
            </button>
          </div>
        </div>
      </div>

      <div className="VipPagePublic_divider" />

      <Section title="Getting started">
        <div className="VipPagePublicGettingStarted_vipPagePublicGettingStartedContainer">
          {STEPS.map((step) => (
            <div key={step.n} className="VipPagePublicGettingStarted_vipPagePublicGettingStartedStep">
              <div className="VipPagePublicGettingStarted_vipPagePublicGettingStartedStepImage">
                <img src={`/images/vip/getting-started/step-${step.n}.png`} alt={`step${step.n}`} />
              </div>
              <h4 className="Heading_root Heading_h4">{step.title}</h4>
              <p>
                {step.before} <span>{step.highlight}</span>
                {step.middle}
                {step.highlight2 && <span>{step.highlight2}</span>}
                {step.after}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div className="VipPagePublic_divider" />

      <Section title="The advantages">
        <div className="Advantages_grid">
          {ADVANTAGES.map((a) => (
            <div key={a.title} className="Advantages_card">
              <div className="Advantages_cardImage">
                <img src={a.img} alt={a.alt} />
              </div>
              <h4 className="Heading_root Heading_h4">{a.title}</h4>
              <p>{a.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="VipPagePublic_divider" />

      <Section title="The benefits">
        <VipBenefitsTable />
      </Section>

      <div className="VipPagePublic_divider" />

      <Section title="Frequently Asked Questions">
        <VipFaqs />
      </Section>
    </div>
  );
}
