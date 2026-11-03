import "./ChatButtons.css";
import { useBrandExtras } from "../../lib/siteContent";

/**
 * The floating chat buttons: WhatsApp (owner panel → Branding, or the site admin's number) and
 * Telegram (owner allows, site admin switches on + link). Each only when switched on.
 */
export default function ChatButtons() {
  const extras = useBrandExtras();
  if (!extras?.whatsapp && !extras?.telegram) return null;

  return (
    <div className="ChatButtons_root">
      {extras.telegram && (
        <a className="ChatButtons_button ChatButtons_telegram" href={extras.telegram} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on Telegram">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z" />
          </svg>
        </a>
      )}
      {extras.whatsapp && (
        <a className="ChatButtons_button ChatButtons_whatsapp" href={extras.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.4Z" />
          </svg>
        </a>
      )}
    </div>
  );
}
