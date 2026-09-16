import { useApi } from "../../lib/useResource";
import { kyc as kycApi } from "../../lib/endpoints";

/**
 * Settings → Verify — reference `VerificationCard` + `SupportChatPrompt`.
 *
 * Three cards down the left and the help panel on the right. The tick, the tag
 * colour and the button all come off one status, so the card is written once
 * and given a state.
 *
 * `GET /user/kyc/status` answers `{ status, submitted }` where status is
 * `NotSubmitted` | `Pending` | `Approved` | `Rejected`. The reference splits KYC
 * into L1 (details) and L2 (ID upload); this backend has a single submission,
 * so L1 tracks whether anything has been submitted and L2 whether it cleared.
 */

const COMPLETE = { color: "rgb(61, 209, 121)", label: "Completed" };
const INCOMPLETE = { color: "rgb(77, 83, 97)", label: "Incomplete" };
const PENDING = { color: "rgb(233, 176, 62)", label: "In Review" };

function VerificationCard({ done, tag, title, text, button }) {
  return (
    <section className="VerificationCard_root" data-testid="verification-cards">
      <div className="VerificationCard_cardSectionWrapper">
        <img alt={done ? "tick" : "empty"} src={done ? "/icons/tick-complete.svg" : "/icons/tick-empty.svg"} />
        <div className="VerificationCard_cardWrapper">
          <div className="Flex_root Flex_column Flex_sm4">
            <header className="VerificationCard_headerLeft">
              <h4 className="Heading_root Heading_h4">{title}</h4>
              <span className="Tag_tagBlock VerificationCard_tag Tag_md" style={{ color: tag.color }}>{tag.label}</span>
            </header>
            {text && (
              <div className="Flex_root Flex_column Flex_sm4">
                <p className="VerificationCard_text">{text}</p>
              </div>
            )}
          </div>
          {button && <div className="VerificationCard_buttonWrapper">{button}</div>}
        </div>
      </div>
    </section>
  );
}

export default function SettingsVerify() {
  const { data: status } = useApi("settings:kyc", () => kycApi.status().catch(() => null));

  const submitted = Boolean(status?.submitted);
  const approved = status?.status === "Approved";
  const pending = submitted && !approved && status?.status !== "Rejected";

  return (
    <div className="Flex_root Flex_column Flex_lg1 Verify_verifyContainer">
      <div className="Flex_root Flex_column Flex_wide Flex_md">
        <h3 className="Heading_root Heading_h3 Verify_header">Account verification</h3>

        <VerificationCard done tag={COMPLETE} title="Email Verification" />

        <VerificationCard
          done={submitted}
          tag={submitted ? (approved ? COMPLETE : PENDING) : INCOMPLETE}
          title="L1: Basic Information"
          text="Fill in your details for us to get to know you better."
          button={
            <button type="button" className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_tertiary ButtonVariants_hasIcon VerificationCard_button">
              <span className="ButtonVariants_buttonContent">
                <span className="ButtonIcon_root">
                  <img alt="edit" src="/icons/edit-2.svg" />
                </span>
                View and Update
              </span>
            </button>
          }
        />

        <VerificationCard
          done={approved}
          tag={approved ? COMPLETE : pending ? PENDING : INCOMPLETE}
          title="L2: Identity Verification"
          text="Upload a copy of your ID"
          button={
            <button type="button" className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary VerificationCard_button">
              <span className="ButtonVariants_buttonContent">{approved ? "Verified" : "Verify Now"}</span>
            </button>
          }
        />
      </div>

      <div className="SupportChatPrompt_root">
        <img alt="user" height="80" width="80" src="/icons/user-logout.svg" />
        <h4 className="Heading_root Heading_h4">Need Help?</h4>
        <p className="SupportChatPrompt_chatPromptSubtext">
          Have questions or concerns regarding your Shuffle account? Our experts are here to help!
        </p>
        <button type="button" className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary">
          <span className="ButtonVariants_buttonContent">Chat with us</span>
        </button>
      </div>
    </div>
  );
}
