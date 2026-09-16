/**
 * The "Need Help?" card — reference `SupportChatPrompt`.
 *
 * Shuffle Wise and Settings → Verify both end with it, so it lives here rather
 * than twice. The button opens Intercom on the live site; there is no chat
 * widget here, so it dispatches the same `shuffle:support` event the rail's
 * Live Support link uses and the shell decides what to do with it.
 */
export default function SupportChatPrompt() {
  return (
    <div className="SupportChatPrompt_root">
      <img alt="user" height="80" width="80" src="/icons/user-logout.svg" />
      <h4 className="Heading_root Heading_h4">Need Help?</h4>
      <p className="SupportChatPrompt_chatPromptSubtext">
        Have questions or concerns regarding your Shuffle account? Our experts are here to help!
      </p>
      <button
        type="button"
        className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
        onClick={() => window.dispatchEvent(new CustomEvent("shuffle:support"))}
      >
        <span className="ButtonVariants_buttonContent">Chat with us</span>
      </button>
    </div>
  );
}
