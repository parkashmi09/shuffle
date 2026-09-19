import { useEffect, useRef, useState } from "react";

import { buildReferralLink } from "../../lib/referralCapture";
import { generateCampaignId, saveAffiliateCampaign } from "../../lib/affiliateCampaigns";
import Modal from "../ui/Modal";

/**
 * Reference "Create Campaign" dialog on `/affiliate/campaigns` — campaign name,
 * auto-generated tracking id, full-width primary submit.
 */
export default function CreateCampaignModal({ referralCode, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState(() => generateCampaignId());
  const [pending, setPending] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    setCampaignId(generateCampaignId());
    setName("");
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => nameRef.current?.focus());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !referralCode || pending) return;
    setPending(true);
    const saved = saveAffiliateCampaign(referralCode, { id: campaignId, name: trimmed });
    const url = buildReferralLink(window.location.origin, referralCode, campaignId);
    navigator.clipboard?.writeText(url).catch(() => {});
    if (saved) {
      onCreated?.(saved);
    }
    onClose();
  };

  const canSubmit = Boolean(name.trim() && referralCode);

  return (
    <Modal
      onClose={onClose}
      labelledBy="create-campaign-title"
      bodyClass="GlobalModal_createCampaignBody"
      contentClass="CreateCampaignModal_content"
    >
      <h3 className="CreateCampaignModal_title" id="create-campaign-title">Create Campaign</h3>

      <form className="CreateCampaignModal_form" onSubmit={submit}>
        <div className="TextInput_formControlWrapper">
          <div className="TextInput_labelGroup">
            <div className="LabelBlock_root TextInput_labelBlock">
              <label className="TextInput_label" htmlFor="create-campaign-name">
                <span>Campaign Name</span>
              </label>
            </div>
          </div>
          <div className="InputWrapper_root">
            <input
              ref={nameRef}
              id="create-campaign-name"
              className="Input_root"
              placeholder="Enter Campaign Name"
              autoComplete="off"
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        </div>

        <div className="TextInput_formControlWrapper">
          <div className="TextInput_labelGroup">
            <div className="LabelBlock_root TextInput_labelBlock">
              <label className="TextInput_label" htmlFor="create-campaign-code">
                <span>Code (Campaign ID)</span>
              </label>
            </div>
          </div>
          <div className="InputWrapper_root">
            <input
              id="create-campaign-code"
              className="Input_root CreateCampaignModal_readOnlyInput"
              readOnly
              aria-readonly="true"
              value={campaignId}
            />
          </div>
        </div>

        <button
          type="submit"
          className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary CreateCampaignModal_submit"
          disabled={!canSubmit || pending}
        >
          <span className="ButtonVariants_buttonContent">Create Campaign</span>
        </button>
      </form>
    </Modal>
  );
}
