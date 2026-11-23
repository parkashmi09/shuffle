import { useState } from "react";
import { useApi } from "../../lib/useResource";
import { region as regionApi } from "../../lib/endpoints";

const KEY = "shuffle.region-notice";

function dismissedThisVisit() {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The owner's region restriction (`GET /user/region`, public, asked once per load).
 * `notice`: a restricted visitor sees this strip and may dismiss it for the visit.
 * `block`: the same strip, not dismissable — the backend also refuses their sign-up and login.
 * Nothing renders when the read fails or the visitor is not restricted.
 */
export default function RegionNotice() {
  const { data } = useApi("region:visitor", () => regionApi.visitor());
  const [hidden, setHidden] = useState(dismissedThisVisit);
  if (!data?.restricted) return null;
  const block = data.mode === "block";
  if (hidden && !block) return null;
  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // storage blocked: hidden until the next load
    }
    setHidden(true);
  };
  return (
    <div className="RegionNotice_root" role="alert">
      <div className="RegionNotice_text">
        <strong className="RegionNotice_title">Not available in your region</strong>
        <p>
          {block
            ? "Sign-up and login are not available from your location."
            : "Our services may not be available from your location."}{" "}
          Contact support@example.com with the details below if you think this is wrong.
        </p>
        <p className="RegionNotice_meta">
          {data.areaCode && <span>Region: {data.areaCode}</span>}
          {data.ip && <span>IP: {data.ip}</span>}
          {data.rayId && <span>Ray ID: {data.rayId}</span>}
        </p>
      </div>
      {!block && (
        <button type="button" className="ButtonVariants_root ButtonVariants_tertiary ButtonVariants_buttonHeightSmall" onClick={dismiss}>
          <span className="ButtonVariants_buttonContent">Dismiss</span>
        </button>
      )}
    </div>
  );
}
