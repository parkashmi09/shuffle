import { useState } from "react";
import { useApi } from "../../lib/useResource";
import { emailVerify, kyc as kycApi, profile as profileApi } from "../../lib/endpoints";
import Modal from "../ui/Modal";
import { useGate } from "../../lib/gates";

/**
 * Settings → Verify — reference `VerificationCard` + `SupportChatPrompt`.
 *
 * Three cards down the left and the help panel on the right. The tick, the tag
 * colour and the button all come off one status, so the card is written once
 * and given a state.
 *
 * `GET /user/kyc/status` answers `{ status, submitted }` where status is
 * `NotSubmitted` | `Unverified` | `Pending` | `Verified` | `Rejected`. The reference splits KYC
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

const field = (id, label, input) => (
  <div className="FormControlWrapper_root" key={id}>
    <label className="Label_root" htmlFor={id}>{label}</label>
    <div className="InputWrapper_root">{input}</div>
  </div>
);

const Warning = ({ children }) => (
  <div className="WarningMessage_container">
    <img alt="warning" className="WarningMessage_icon" src="/icons/exclamation.svg" />
    <span className="WarningMessage_content">{children}</span>
  </div>
);

/** `POST /user/email/verify/request` mails a 6-digit code; `/verify/confirm` checks it. */
function EmailVerifyModal({ onClose, onDone }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} label="Email Verification">
      <h3 className="Header_root">Email Verification</h3>
      <form
        className="ChangePasswordModal_root"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            if (!sent) {
              await emailVerify.request();
              setSent(true);
            } else {
              await emailVerify.confirm(code.trim());
              onDone();
            }
          });
        }}
      >
        <p className="Subheader_root"><span>{sent ? "Enter the code we emailed you." : "We will email you a 6-digit code."}</span></p>
        {sent && field("email-code", "Code*", <input id="email-code" className="Input_root" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />)}
        {error && <Warning>{error}</Warning>}
        <button type="submit" disabled={busy || (sent && code.trim().length !== 6)} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ChangePasswordModal_button">
          <span className="ButtonVariants_buttonContent">{sent ? "Verify" : "Send code"}</span>
        </button>
      </form>
    </Modal>
  );
}

const KYC_TEXT = [
  ["firstName", "First name*"],
  ["lastName", "Last name*"],
  ["dateOfBirth", "Date of birth*", "date"],
  ["address", "Address*"],
  ["city", "City*"],
  ["country", "Country*"],
];
/** Upload fields per document type (backend `DOCUMENT_FIELDS`); the first one is required. */
const KYC_FILES = {
  id_card: [["idFront", "ID front*"], ["idBack", "ID back"]],
  driving_licence: [["idFront", "Licence front*"], ["idBack", "Licence back"]],
  passport: [["passport", "Passport photo page*"]],
};

/** `POST /user/kyc/submit` — multipart, the details plus at least one document image. */
function KycModal({ onClose, onDone }) {
  const [values, setValues] = useState({ documentType: "id_card" });
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const docFiles = KYC_FILES[values.documentType];
  const ready = KYC_TEXT.every(([k]) => values[k]?.trim()) && Boolean(files[docFiles[0][0]]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      for (const [k] of [...KYC_TEXT, ["documentType"]]) form.append(k, values[k].trim());
      // Only the chosen document's files — a passport picked earlier is not sent with an ID card.
      for (const [k] of docFiles) if (files[k]) form.append(k, files[k]);
      await kycApi.submit(form);
      onDone();
    } catch (err) {
      setError(err?.fields?.length ? err.fields.map((f) => f.message).join(" ") : err?.message || "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} label="Identity Verification">
      <h3 className="Header_root">Identity Verification</h3>
      <form className="ChangePasswordModal_root" onSubmit={submit}>
        {KYC_TEXT.map(([k, label, type]) =>
          field(`kyc-${k}`, label, (
            <input id={`kyc-${k}`} className="Input_root" type={type || "text"} value={values[k] || ""} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
          ))
        )}
        {field("kyc-documentType", "Document type*", (
          <select id="kyc-documentType" className="Input_root" value={values.documentType} onChange={(e) => { setValues((v) => ({ ...v, documentType: e.target.value })); setFiles({}); }}>
            <option value="id_card">ID card</option>
            <option value="passport">Passport</option>
            <option value="driving_licence">Driving licence</option>
          </select>
        ))}
        {docFiles.map(([k, label]) =>
          field(`kyc-${k}`, label, (
            <input key={`${values.documentType}-${k}`} id={`kyc-${k}`} className="Input_root" type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => setFiles((f) => ({ ...f, [k]: e.target.files?.[0] || null }))} />
          ))
        )}
        {error && <Warning>{error}</Warning>}
        <button type="submit" disabled={busy || !ready} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ChangePasswordModal_button">
          <span className="ButtonVariants_buttonContent">{busy ? "Submitting…" : "Submit"}</span>
        </button>
      </form>
    </Modal>
  );
}

export default function SettingsVerify() {
  const [nonce, setNonce] = useState(0);
  const [open, setOpen] = useState(null);
  const kycOn = useGate()("kyc");
  const { data: status } = useApi(`settings:kyc:${nonce}`, () => kycApi.status().catch(() => null));
  const { data: me } = useApi(`settings:profile:${nonce}`, () => profileApi.get().catch(() => null));

  const submitted = Boolean(status?.submitted);
  const approved = status?.status === "Verified";
  const rejected = status?.status === "Rejected";
  const pending = submitted && !approved && !rejected;
  const emailDone = Boolean(me?.emailVerified);
  const finish = () => {
    setOpen(null);
    setNonce((n) => n + 1);
  };
  // A pending or verified application cannot be resubmitted (KYC_ALREADY_PENDING / _VERIFIED).
  const canSubmit = !approved && !pending;

  return (
    <div className="Flex_root Flex_column Flex_lg1 Verify_verifyContainer">
      <div className="Flex_root Flex_column Flex_wide Flex_md">
        <h3 className="Heading_root Heading_h3 Verify_header">Account verification</h3>

        <VerificationCard
          done={emailDone}
          tag={emailDone ? COMPLETE : INCOMPLETE}
          title="Email Verification"
          button={
            !emailDone && me?.email ? (
              <button type="button" onClick={() => setOpen("email")} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary VerificationCard_button">
                <span className="ButtonVariants_buttonContent">Verify Email</span>
              </button>
            ) : null
          }
        />

        {kycOn && (<>
        <VerificationCard
          done={submitted}
          tag={submitted ? (approved ? COMPLETE : PENDING) : INCOMPLETE}
          title="L1: Basic Information"
          text={rejected && status?.rejectionReason ? `Rejected: ${status.rejectionReason}` : "Fill in your details for us to get to know you better."}
          button={
            <button type="button" disabled={!canSubmit} onClick={() => setOpen("kyc")} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_tertiary ButtonVariants_hasIcon VerificationCard_button">
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
            <button type="button" disabled={!canSubmit} onClick={() => setOpen("kyc")} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary VerificationCard_button">
              <span className="ButtonVariants_buttonContent">{approved ? "Verified" : pending ? "In Review" : "Verify Now"}</span>
            </button>
          }
        />
        </>)}
      </div>

      {open === "email" && <EmailVerifyModal onClose={() => setOpen(null)} onDone={finish} />}
      {open === "kyc" && <KycModal onClose={() => setOpen(null)} onDone={finish} />}

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
