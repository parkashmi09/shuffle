import { useEffect, useState } from "react";
import { cx } from "../../lib/carousel";

/**
 * Initial page loader — reference `PageLoader`: the three-piece Shuffle mark
 * spins over a "Loading…" caption, then fades out while the page content
 * rises into place.
 */
export default function PageLoader({ children, duration = 900 }) {
  const [phase, setPhase] = useState("loading"); // loading -> leaving -> done

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("leaving"), duration);
    const t2 = setTimeout(() => setPhase("done"), duration + 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [duration]);

  return (
    <div>
      {phase !== "done" && (
        <div className={cx("PageLoader_loader", phase === "leaving" && "PageLoader_leaving")}>
          <div className="Loader_root Loader_logo Loader_mounted PageLoader_loaderIcon" aria-label="Loading...">
            <div className="Loader_container">
              <img src="/icons/shuffle-logo-top.svg" alt="logo" width="21" height="12" className="Loader_top" />
              <img src="/icons/shuffle-logo-middle.svg" alt="logo" width="21" height="12" className="Loader_middle" />
              <img src="/icons/shuffle-logo-bottom.svg" alt="logo" width="21" height="12" className="Loader_bottom" />
            </div>
          </div>
          <p className="PageLoader_loadingText">Loading</p>
        </div>
      )}
      <div className={cx("PageLoader_container", "PageLoader_enter", phase !== "loading" && "PageLoader_entered")} hidden={phase === "loading"}>
        {children}
      </div>
    </div>
  );
}
