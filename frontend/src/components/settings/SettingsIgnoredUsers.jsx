/**
 * Settings → Ignored Users — reference `IgnoredUsers`.
 *
 * A heading and, with nobody ignored, nothing else — which is exactly what the
 * live tab renders. There is no ignore list in any of the four services (chat
 * has no backend module at all, and ignoring is a chat feature), so this shows
 * the reference's empty tab rather than a list it cannot fill. The subheader
 * and the unignore link the reference's stylesheet also carries belong to the
 * populated state, and arrive with the module that fills it.
 */
export default function SettingsIgnoredUsers() {
  return <h4 className="IgnoredUsers_header">Ignored Users</h4>;
}
