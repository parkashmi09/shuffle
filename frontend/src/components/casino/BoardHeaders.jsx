/**
 * Summary panel above the Weekly Race standings — a 1:1 port of the
 * signed-in reference `Race` module.
 */

function LargeIconText({ icon, alt, label, coin, value, children }) {
  return (
    <div className="LargeIconText_root">
      <img alt={alt} src={icon} />
      <div className="LargeIconText_body">
        <p className="LargeIconText_text">{label}</p>
        <div className="LargeIconText_content">
          {coin && (
            <img alt={coin.toUpperCase()} className="CryptoIcon_root CryptoIcon_image" height="16" src={`/icons/crypto/${coin}.svg`} width="16" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <h4 className="LargeIconText_amount">
            <span>{value}</span>
          </h4>
        </div>
      </div>
      {children}
    </div>
  );
}

export function RaceHeader({ prize = "$100,000", remaining = "19h 11m 3s", coin = "btc" }) {
  return (
    <div className="Race_raceContainer">
      <div className="Race_icon">
        <LargeIconText icon="/icons/cash.svg" alt="cash" label="Total Prize" coin={coin} value={prize} />
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
