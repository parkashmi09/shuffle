import { useGate } from "../../lib/gates";

/**
 * The picture inside an `Avatar_root` circle. With avatars switched off by the site admin
 * (`avatars_enabled`, the default) it is the first letter of the player's name instead.
 */
export default function AvatarFace({ src, name }) {
  const on = useGate();
  if (on.avatars) return <img alt="avatar" width="40" height="40" src={src || "/icons/user-profile.svg"} />;
  const letter = (String(name ?? "").trim().match(/\p{L}|\p{N}/u)?.[0] ?? "?").toUpperCase();
  return <span className="Avatar_letter" role="img" aria-label="avatar">{letter}</span>;
}
