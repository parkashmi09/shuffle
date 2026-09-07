/**
 * Summary panels above the Weekly Race and SHFL Airdrop standings — a 1:1
 * port of the signed-in reference (`Race` and `AirDropRaceTable` modules).
 */

function LargeIconText({ icon, alt, label, coin, value, children }) {
  return (
    <div className="LargeIconText_root">
      <img alt={alt} src={icon} />
      <div className="LargeIconText_body">
        <p className="LargeIconText_text">{label}</p>
        <div className="LargeIconText_content">
          {coin && <img alt={coin.toUpperCase()} className="CryptoIcon_root CryptoIcon_image" height="16" src={`/icons/crypto/${coin}.svg`} width="16" />}
          <h4 className="LargeIconText_amount">
            <span>{value}</span>
          </h4>
        </div>
      </div>
      {children}
    </div>
  );
}

export function RaceHeader({ prize = "$100,000", remaining = "19h 11m 3s" }) {
  return (
    <div className="Race_raceContainer">
      <div className="Race_icon">
        <LargeIconText icon="/icons/cash.svg" alt="cash" label="Total Prize" coin="btc" value={prize} />
      </div>
      <div className="Race_icon">
        <LargeIconText icon="/icons/race.svg" alt="race" label="Time remaining" value={remaining}>
          <button
            className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("shuffle:weekly-race"))}
          >
            <span className="ButtonVariants_buttonContent">How it works</span>
          </button>
        </LargeIconText>
      </div>
    </div>
  );
}

export function AirdropHeader({ week = 28, ends = "Sep 12, 2026", reward = "1,000,000", remaining = "6d 12h 9m" }) {
  return (
    <section className="DrawResult_root">
      <header className="DrawResult_navigation DrawResult_purple">
        <button type="button">
          <img alt="navigate to left" height="24" src="/icons/arrow-cricle-background.svg" width="24" />
          <span>Prev week</span>
        </button>
        <p>
          <span className="DrawResult_draw">Week #{week}</span>
          <span className="DrawResult_drawDate">Ends: {ends}</span>
        </p>
        <button type="button" disabled>
          <span>Next week</span>
          <img alt="navigate to right" height="24" src="/icons/arrow-cricle-background.svg" width="24" />
        </button>
      </header>
      <div className="Flex_root Flex_column AirDropRaceTable_container">
        <LargeIconText icon="/icons/challenge-trophy.svg" alt="trophy" label="Total Reward" coin="shfl" value={reward} />
        <LargeIconText icon="/icons/race.svg" alt="trophy" label="Time remaining" value={remaining}>
          <button className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_outline AirDropRaceTable_tinyButton" type="button">
            <span className="ButtonVariants_buttonContent">Learn More</span>
          </button>
        </LargeIconText>
      </div>
    </section>
  );
}
