import { cx } from "../../lib/carousel";
import { navigate } from "../../lib/router";
import { usePoppedGame } from "../../lib/poppedGameContext";

/**
 * The docked mini-player — a game that has been popped out of its page.
 *
 * Two states, both the reference's:
 *
 *   expanded   a small player in the bottom-right: a title bar over the running
 *              game, with controls to collapse it, reopen its page, or end it
 *   minimised  a tab in the strip along the bottom edge, which is
 *              `popupMinimiseItems` / `PopupMinimiseItem` in the captured CSS
 *
 * The minimised strip is verbatim — those rules ARE in the stylesheet. The
 * expanded player's own frame is not: the reference code-splits it and only
 * fetches its chunk when a game is popped, so the capture never held it. What
 * is inside that frame is still the reference's — `ProviderGame_popupMode` and
 * `ProviderGameOverlay_popupMode` were captured and are what size the game
 * within it.
 *
 * Clicking the title reopens the game's own page and leaves the dock, which is
 * the way back from having popped it out.
 */
export default function PoppedGame() {
  const { game, session, minimised, setMinimised, close } = usePoppedGame();
  if (!game || !session) return null;

  const href = `/casino/games/${game.uuid}`;

  if (minimised) {
    return (
      <div className="popupMinimiseItems_root">
        <ul className="popupMinimiseItems_container">
          <li className="PopupMinimiseItem_list">
            <button type="button" className="PopupMinimiseItem_closeButton" aria-label={`Close ${game.name}`} onClick={close}>
              <span className="PopupMinimiseItem_closeBackground">
                <img alt="" src="/icons/times.svg" />
              </span>
            </button>
            <button
              type="button"
              className="PopupMinimiseItem_mainButton"
              onClick={() => setMinimised(false)}
              aria-label={`Expand ${game.name}`}
            >
              <span className="PopupMinimiseItem_mainButtonBackground PopupMinimiseItem_contentWrapper">
                {/* The reference's live dot — the game behind this tab is still
                    running, which is the whole reason the tab is there. */}
                <span className="PopupMinimiseItem_liveDot">●</span>
                <span className="PopupMinimiseItem_title PopupMinimiseItem_titlePlaying">{game.name}</span>
                <img alt="" className="PopupMinimiseItem_arrow" src="/icons/chevron.svg" />
              </span>
            </button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <aside className="PoppedGame_root" aria-label={`${game.name}, popped out`}>
      <div className="PoppedGame_bar">
        <button
          type="button"
          className="PoppedGame_title"
          onClick={() => {
            close();
            navigate(href);
          }}
          title={`Open ${game.name}`}
        >
          <img alt="" height="16" src="/icons/providers.svg" width="16" />
          <span className="GameTitle_root">{game.name}</span>
        </button>

        <div className="PoppedGame_actions">
          <button type="button" aria-label="Minimise" className="PoppedGame_iconButton" onClick={() => setMinimised(true)}>
            <img alt="" height="16" src="/icons/chevron.svg" width="16" />
          </button>
          <button type="button" aria-label={`Close ${game.name}`} className="PoppedGame_iconButton" onClick={close}>
            <img alt="" src="/icons/times.svg" />
          </button>
        </div>
      </div>

      {/* `ProviderGame_popupMode` is the captured rule that drops the frame's
          radius and lets the game size itself inside a dock rather than a
          page column. */}
      <div className={cx("ProviderGame_popupMode")}>
        <div className="Flex_root Flex_column ProviderGame_root">
          <div className="ProviderGameContainer_gameRoot">
            <section className="ProviderGame_gameContainer">
              <div className="ProviderGame_game">
                <div className="SoftswissLoader_root">
                  <iframe
                    className="SoftswissLoader_iframe"
                    src={session.gameLaunchUrl}
                    title={game.name}
                    allow="autoplay; fullscreen; clipboard-write; encrypted-media"
                    allowFullScreen
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </aside>
  );
}
