import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame, useProviderGames, useProviders } from "../lib/catalogue";
import { jsGames } from "../lib/endpoints";
import { useSession } from "../lib/sessionContext";
import { useFavourites } from "../lib/favouritesContext";
import { usePoppedGame } from "../lib/poppedGameContext";
import { currencyIcon } from "../lib/currencies";
import { displayBalance } from "../lib/adapters";
import { cx } from "../lib/carousel";
import { navigate } from "../lib/router";
import GameCarousel from "../components/casino/GameCarousel";
import ProviderCarousel from "../components/casino/ProviderCarousel";
import ActivityBoard from "../components/casino/ActivityBoard";
import GameStatsPanel from "../components/casino/GameStatsPanel";

/**
 * The screen behind a game tile — `/casino/games/:uuid`.
 *
 * ── THE THREE STATES ─────────────────────────────────────────────────────
 *
 * The reference renders ONE frame and puts a card on top of it until the game
 * is running, which is why `ProviderGameOverlay` is an overlay and not a
 * separate screen: the frame keeps its size and its place in the column
 * throughout, so nothing reflows when the game starts.
 *
 *   idle      the overlay, with the currency and the play buttons
 *   launching the overlay, with the button disabled — one launch at a time
 *   playing   the overlay gone, the provider's own page in the iframe
 *
 * Signed out, the primary button is Register rather than Real Play. That is
 * the reference's behaviour and it is also the only correct one here: the
 * launch route reads the player from the bearer token, so there is nothing to
 * send.
 *
 * ── THE PAGE BELOW THE FRAME ─────────────────────────────────────────────
 *
 * The rails under the game are NOT inside the game's own section. They were,
 * and `GameWrapperComponent_root` is `width: var(--max-width)` with padding of
 * its own — a lobby row nested inside it burst out of the column, clipped its
 * heading and ran underneath the sidebar. They sit in the same
 * `LayoutContainer_root` > `Home_homeTabContainer` >
 * `HomeTabLobby_homeTabLobbyWrapper` nesting the lobby puts its rows in, which
 * is the thing that constrains them, and the activity board follows outside
 * that section exactly as it does on the home page.
 */

/**
 * The currencies `POST /casino/js-games/v2/launch` will accept — the backend's
 * own `V2_CURRENCIES` map.
 *
 * Only INR actually opens a game today: the operator account upstream is
 * INR-only and the other two come back `Game launch failed (10004)` on every
 * game tested. They are still listed, because "Balance In" is a wallet choice
 * and hiding a currency the player holds makes the control look broken — which
 * is what a one-option list did. A launch that the provider refuses says so in
 * the overlay.
 */
const LAUNCH_CURRENCIES = ["INR", "USDT", "USD"];

/** Which of those the player actually holds a wallet entry for. */
function launchableFor(balances) {
  if (!balances) return LAUNCH_CURRENCIES;
  const held = LAUNCH_CURRENCIES.filter((c) => c in balances);
  // An account with none of the three still needs something to launch with,
  // and INR is the one the operator is configured for.
  return held.length ? held : LAUNCH_CURRENCIES;
}

/**
 * Fun Play — present, and disabled.
 *
 * The reference pairs Real Play with a demo session against play money.
 * jsGames v2 has no demo mode: `/launch` takes a real `user_id` and a real
 * `credit_amount` and hands back a session that settles to the real wallet, so
 * there is no request this button could send.
 *
 * It is drawn rather than dropped because the pair IS the layout — one button
 * alone is visibly not the reference — and it is disabled with the reason on
 * it rather than quietly wired to the real-money launch, which would take a
 * player's actual balance when they asked for play money. It goes live the day
 * the provider gives us a demo endpoint and nothing else here changes.
 */
function FunPlayButton({ className }) {
  return (
    <button
      type="button"
      disabled
      title="This provider does not offer a demo session for its games."
      className={cx(
        "ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_secondary ButtonVariants_keepEnabledStyle ButtonVariants_hasIcon",
        className
      )}
    >
      <span className="ButtonVariants_buttonContent">
        <img alt="smile" height="16" src="/icons/smile-face.svg" width="16" />
        Fun Play
      </span>
    </button>
  );
}

/** The overlay card: pick a currency, then open the game. */
function GameOverlay({ signedIn, currency, onCurrency, onPlay, launching, error, options, balances }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const icon = currencyIcon(currency);

  return (
    <div className="GameOverlayShell_shell ProviderGameOverlay_shell">
      <div className="Flex_root Flex_column Flex_md2 ProviderGameOverlay_gameOverlayCard">
        <div className="ProviderGameOverlaySelector_gameOverlayCardHeader">
          <p className="ProviderGameOverlaySelector_title">Balance In</p>

          <div className="FormControlWrapper_root Select_formWrapper" ref={ref}>
            {/* The native control stays in the tree as the accessible one — a
                screen reader gets a real listbox and everyone else sees the
                styled button. The same split `SelectMenu` uses. */}
            <label className="sr-only">
              Currency
              <select name="currency" value={currency} onChange={(e) => onCurrency(e.target.value)}>
                {options.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              className={cx("Select_button ProviderGameOverlaySelector_selector", open && "Select_openBtn")}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="Select_item">
                {icon && (
                  <span className="Select_selectOptionIcon">
                    <img alt="" src={icon} />
                  </span>
                )}
                <span className="Select_text">{currency}</span>
              </span>
              <img
                alt="Toggle dropdown menu"
                className={cx("Select_chevronIcon", open && "Select_up")}
                src="/icons/chevron.svg"
              />
            </button>

            {open && (
              <ul className="SelectMenu_panel" role="listbox" aria-label="Currency">
                {options.map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={c === currency}
                      className={cx("SelectMenu_option", c === currency && "SelectMenu_optionActive")}
                      onClick={() => {
                        onCurrency(c);
                        setOpen(false);
                      }}
                    >
                      {c}
                      {/* The control says "Balance In", so each option shows
                          the balance it would play against. */}
                      {balances?.[c] != null && (
                        <span className="SelectMenu_optionCount">{displayBalance(balances[c], c)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* A refusal from the provider or the gateway. The overlay stays up —
            there is nothing running behind it — and says what happened rather
            than leaving a button that did nothing. Pressing Real Play again is
            the retry: the commonest failure here is the provider timing out,
            which is transient and worth a second attempt. */}
        {error && (
          <p className="ProviderGameOverlay_paragraph GamePage_error" role="alert">
            {error}
          </p>
        )}

        <div className="Flex_root Flex_md2 ProviderGameOverlay_buttonGroup">
          {signedIn ? (
            <>
              <button
                type="button"
                className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ButtonVariants_hasIcon ProviderGameOverlay_playOptionButton"
                disabled={launching}
                onClick={onPlay}
              >
                <span className="ButtonVariants_buttonContent">
                  <img alt="play" height="16" src="/icons/play-no-outline.svg" width="16" />
                  {launching ? "Starting…" : "Real Play"}
                </span>
              </button>
              <FunPlayButton className="ProviderGameOverlay_playOptionButton" />
            </>
          ) : (
            <>
              <button
                type="button"
                className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ButtonVariants_hasIcon ProviderGameOverlay_playOptionButton"
                onClick={() => window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: "register" }))}
              >
                <span className="ButtonVariants_buttonContent">
                  <img alt="play" height="16" src="/icons/play-no-outline.svg" width="16" />
                  Register
                </span>
              </button>
              <button
                type="button"
                className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_secondary ProviderGameOverlay_playOptionButton"
                onClick={() => window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: "login" }))}
              >
                <span className="ButtonVariants_buttonContent">Login</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One control in the bar's left-hand group.
 *
 * The reference's exact nesting: a `Tooltip_trigger` span wrapping a
 * `ButtonVariants` icon button, whose content span carries
 * `ToolbarButton_buttonDefault` and whose image sits in a `ButtonIcon_root`.
 * Each control is wrapped in a bare <div> so the two that hide themselves at a
 * breakpoint (`_popupButton`, `_theatreModeButton`) have somewhere to put that
 * class — those rules target the WRAPPER, not the button.
 */
function ToolbarButton({ alt, src, label, onClick, active, disabled, id }) {
  return (
    <span className="Tooltip_trigger">
      <button
        type="button"
        id={id}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon"
      >
        <span className={cx("ButtonVariants_buttonContent ToolbarButton_buttonDefault", active && "ToolbarButton_active")}>
          <span className="ButtonIcon_root">
            <img alt={alt} height="16" src={src} width="16" />
          </span>
        </span>
      </button>
    </span>
  );
}

/**
 * The control bar under the frame — reference `FooterContainer`.
 *
 * Markup matched to the reference's own, which corrected three things this
 * clone had guessed at:
 *
 *   - the container is `FooterContainer_root`, not a class of ours, and it
 *     already does the `space-between` spread;
 *   - the centred SHUFFLE wordmark is a CSS BACKGROUND on that container, not
 *     an element — drawing it as a third flex child is what pushed the two
 *     button groups off the ends of the bar;
 *   - the game's name and studio are NOT in the bar at all.
 *
 * Fun is `disabled` on the reference too, with `keepEnabledStyle` so it still
 * looks like a control rather than a dead one. That is exactly the treatment
 * this clone needs for it, and for the same reason: see `FunPlayButton`.
 *
 * The statistics button is left out — every other control here does something,
 * and no service exposes per-game stats to put behind it.
 */
function GameFooter({ game, theatre, onTheatre, onFullscreen, playing, onPlay, launching, signedIn, favourite, onFavourite, statsOpen, onStats, onPopOut }) {
  return (
    <div className={cx("FooterContainer_root", theatre && "FooterContainer_isTheatreMode")} id="game-footer">
      <div className="Flex_root Flex_center ToolbarGroup_root ToolbarGroup_default">
        <div>
          <ToolbarButton alt="fullscreen" label="Full screen" src="/icons/fullscreen.svg" onClick={onFullscreen} />
        </div>
        <div className="ProviderGamesFooter_popupButton">
          <ToolbarButton
            alt="pop up"
            label="Open in a popup"
            src="/icons/game-popup.svg"
            disabled={!playing}
            onClick={onPopOut}
          />
        </div>
        <div className="ProviderGamesFooter_theatreModeButton">
          <ToolbarButton
            alt="theatre mode"
            label="Theatre mode"
            src="/icons/wide.svg"
            active={theatre}
            onClick={onTheatre}
          />
        </div>
        <div>
          <ToolbarButton
            id="open-provider-game-stats"
            alt="statistics"
            label="Statistics"
            src="/icons/stats.svg"
            active={statsOpen}
            onClick={onStats}
          />
        </div>
        <div>
          <ToolbarButton
            alt="fav"
            label={favourite ? `Remove ${game.name} from favourites` : `Add ${game.name} to favourites`}
            src={favourite ? "/icons/star-filled.svg" : "/icons/star.svg"}
            active={favourite}
            onClick={onFavourite}
          />
        </div>
      </div>

      <div className="ProviderGamesFooter_selectContainer">
        <div className="Flex_root Flex_center ProviderGamesFooter_gameSelect">
          <button
            type="button"
            disabled={!signedIn || launching || playing}
            onClick={onPlay}
            className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_tertiary ButtonVariants_hasIcon ProviderGamesFooter_button"
          >
            <span className="ButtonVariants_buttonContent ProviderGamesFooter_gameSelectBg">
              <span className="ButtonIcon_root">
                <img alt="play" height="16" src="/icons/play-no-outline.svg" width="16" />
              </span>
              Real
            </span>
          </button>
          <button
            type="button"
            disabled
            title="This provider does not offer a demo session for its games."
            className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_tertiary ButtonVariants_keepEnabledStyle ButtonVariants_hasIcon ProviderGamesFooter_button"
          >
            <span className="ButtonVariants_buttonContent ProviderGamesFooter_gameSelectBg">
              <span className="ButtonIcon_root">
                <img alt="smile" height="16" src="/icons/smile-face.svg" width="16" />
              </span>
              Fun
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * "More from <studio>" — the rail the reference puts under the frame.
 *
 * Built from `GameCarousel` rather than new markup: that component already
 * carries the reference's rail classes, its swipe track and its tiles, so this
 * is the same row the lobby renders with a different heading and no captured
 * CSS invented for it.
 *
 * The game being viewed is filtered out — a rail of "more from" that leads
 * with the game already on screen is the one tile it cannot usefully offer.
 */
function MoreFromProvider({ game, providers }) {
  const provider = game?.provider || null;
  const { games } = useProviderGames(provider, provider, { limit: 24 });

  if (!provider) return null;
  const rest = (games || []).filter((g) => g.uuid !== game.uuid);
  if (!rest.length) return null;

  /**
   * The studio's NAME, not the catalogue's key for it.
   *
   * `gisgamesnew.provider` holds the aggregator's own vendor code — `spribe`,
   * `pragmaticlive`, `bgaming` — which is what the games route is queried by
   * and is not a thing to print in a heading. The roster carries the spelling
   * a person reads ("Pragmatic Play Live"), so the heading takes that and
   * falls back to the code only for a studio the roster has never heard of.
   */
  const label = providers?.find((p) => p.name === provider)?.label || provider;

  return (
    <GameCarousel
      viewAll={false}
      section={{
        title: `More from ${label}`,
        icon: "/icons/providers.svg",
        href: `/casino/providers/${provider}`,
        games: rest,
      }}
    />
  );
}

/** A uuid that names no game. The lobby is a better answer than an empty frame. */
function GameNotFound() {
  return (
    <section className="LayoutContainer_root GameWrapperComponent_root ProviderGame_providerGame LayoutContainer_column">
      <div className="Flex_root Flex_column ProviderGame_root">
        <div className="ProviderGameContainer_gameRoot">
          <div className="GameOverlayShell_shell ProviderGameOverlay_shell">
            <div className="Flex_root Flex_column Flex_md2 ProviderGameOverlay_gameOverlayCard">
              <p className="ProviderGameOverlay_heading">Game not found</p>
              <p className="ProviderGameOverlay_paragraph">
                This game is not in the catalogue. It may have been removed by its provider.
              </p>
              <div className="Flex_root Flex_md2 ProviderGameOverlay_buttonGroup">
                <button
                  type="button"
                  className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ProviderGameOverlay_playOptionButton"
                  onClick={() => navigate("/")}
                >
                  <span className="ButtonVariants_buttonContent">Back to the lobby</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function GamePage({ uuid }) {
  const { game, loading, error: readError } = useGame(uuid);
  const { signedIn, restoring, refreshBalances, balances, currency: walletCurrency } = useSession();
  const { providers } = useProviders();
  /**
   * The star in the control bar.
   *
   * The favourites store is still whole — the provider, the optimistic toggle
   * and the toasts all survived the tiles losing their star — so this is the
   * one place in the app that writes to it again. Signed out, `toggle` asks
   * the visitor to sign in rather than failing, which is the behaviour it was
   * already written for.
   */
  const favourites = useFavourites();
  const dock = usePoppedGame();

  const options = useMemo(() => launchableFor(balances), [balances]);
  /**
   * Which currency the overlay opens on.
   *
   * The wallet's own preferred code when it is one the provider will take,
   * otherwise the first the player holds. Held as state so picking one sticks,
   * and corrected once — not on every render — if the wallet arrives after the
   * first paint naming something else.
   */
  const [chosen, setChosen] = useState(null);
  const currency = chosen && options.includes(chosen)
    ? chosen
    : options.includes(walletCurrency)
      ? walletCurrency
      : options[0];
  const [session, setSession] = useState(null); // { gameLaunchUrl, sessionToken }
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [theatre, setTheatre] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const frameRef = useRef(null);

  /**
   * Full screen on the FRAME, not the iframe.
   *
   * Asking the iframe itself would hand the provider's document the whole
   * screen and take our controls with it; the frame keeps the bar reachable.
   * `requestFullscreen` rejects when the browser refuses it, which is not
   * worth surfacing — the player pressed a button and nothing happened, and
   * there is nothing they can do about it.
   */
  const fullscreen = useCallback(() => {
    frameRef.current?.requestFullscreen?.().catch(() => {});
  }, []);


  /**
   * Signing out with a game open ends it here too — the session belongs to the
   * account that opened it, and the provider settles it against that wallet.
   *
   * Derived rather than cleared in an effect: an effect that calls `setSession`
   * on a `signedIn` change renders the running iframe once before removing it.
   * There is no matching reset for `uuid` because `App` renders this with
   * `key={uuid}`, so a different game is a different component instance.
   */
  const active = signedIn ? session : null;

  /**
   * Pop out — lift the running game into the corner dock and go back to the
   * lobby, which is what the reference's control does.
   *
   * NOT `window.open`. That was the first attempt and was wrong twice: it is
   * the wrong behaviour, and a popup blocker swallows it silently, so the
   * button appeared to do nothing at all.
   *
   * Only meaningful once a game is actually running — there is nothing to lift
   * out of an unstarted frame — which is why the control is disabled until
   * then rather than popping an empty box.
   */
  const popOut = useCallback(() => {
    if (!game || !active) return;
    dock.pop(game, active);
    navigate("/");
  }, [game, active, dock]);

  const play = useCallback(async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const data = await jsGames.launch(uuid, currency);
      if (!data?.gameLaunchUrl) throw new Error("The provider did not return a game to open.");
      setSession(data);
      // The launch debits nothing, but the provider is told the balance it may
      // stake against, so the header should be showing the same number.
      refreshBalances?.();
    } catch (e) {
      setLaunchError(e?.message || "Could not open this game. Please try again.");
    } finally {
      setLaunching(false);
    }
  }, [uuid, currency, refreshBalances]);

  if (readError && !loading) return <GameNotFound />;

  return (
    <>
      <section
        className={cx(
          "LayoutContainer_root GameWrapperComponent_root ProviderGame_providerGame LayoutContainer_column",
          theatre && "GameWrapperComponent_isTheatreMode"
        )}
      >
        <div className={cx("Flex_root Flex_column ProviderGame_root", theatre && "ProviderGame_theatreMode")}>
          <div className="ProviderGameContainer_gameRoot" ref={frameRef}>
            {statsOpen && game && <GameStatsPanel game={game} />}

            {/* The overlay sits ON the frame rather than replacing it, so the
                column does not reflow when the game starts. `restoring` keeps
                it down for the frame where a stored token is still being
                checked — otherwise a returning player is shown Register
                before being shown Real Play. */}
            {!active && !restoring && (
              <GameOverlay
                signedIn={signedIn}
                currency={currency}
                onCurrency={setChosen}
                onPlay={play}
                launching={launching}
                error={launchError}
                options={options}
                balances={balances}
              />
            )}

            <section className="ProviderGame_gameContainer">
              <div className="ProviderGame_game">
                {active ? (
                  <div className="SoftswissLoader_root">
                    <iframe
                      className="SoftswissLoader_iframe"
                      src={active.gameLaunchUrl}
                      title={game?.name || "Game"}
                      // The provider's client needs these to run; it is a
                      // third-party origin, so nothing wider is granted.
                      allow="autoplay; fullscreen; clipboard-write; encrypted-media"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  // The game's artwork, for the overlay's blur to act on. The
                  // shell is a `backdrop-filter` and paints nothing itself, so
                  // an empty frame blurs nothing and the card sits on a flat
                  // dark box instead of the reference's soft-focus art.
                  game?.img && (
                    <img
                      alt=""
                      aria-hidden="true"
                      className="GamePage_artwork"
                      decoding="async"
                      src={game.img}
                    />
                  )
                )}
              </div>
            </section>
          </div>

          {game && (
            <GameFooter
              game={game}
              theatre={theatre}
              onTheatre={() => setTheatre((v) => !v)}
              onFullscreen={fullscreen}
              playing={Boolean(active)}
              onPlay={play}
              launching={launching}
              signedIn={signedIn}
              favourite={favourites.has(game)}
              onFavourite={() => favourites.toggle(game)}
              statsOpen={statsOpen}
              onStats={() => setStatsOpen((v) => !v)}
              onPopOut={popOut}
            />
          )}
        </div>
      </section>

      {/* The lobby's own nesting — see the note at the top of this file for
          why these are not inside the section above — with the reference's own
          spacing on the section itself. `_mobile-top-md2` and `_tablet-top-lg1`
          are what separate this from the control bar; without them the rail's
          heading sits hard against the bottom of the frame. */}
      <section className="LayoutContainer_root LayoutContainer_mobile-top-md2 LayoutContainer_mobile-bottom-0 LayoutContainer_tablet-top-lg1 LayoutContainer_tablet-bottom-0 LayoutContainer_column">
        <div className="Home_homeTabContainer">
          <div className="HomeTabLobby_homeTabLobbyWrapper">
            <MoreFromProvider game={game} providers={providers} />
            <ProviderCarousel providers={providers} />
          </div>
        </div>
      </section>

      <ActivityBoard />

      
    </>
  );
}
