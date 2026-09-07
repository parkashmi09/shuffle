/**
 * Icon — a small stroke-based icon set drawn on a 24x24 grid.
 *
 * Every glyph is authored here so the UI carries no icon-font dependency.
 * Paths use `currentColor` and a 1.75 stroke, which keeps them legible at the
 * 18-22px sizes the rail and section headers use.
 */

const paths = {
  menu: <><path d="M3.5 6.5h17" /><path d="M3.5 12h17" /><path d="M3.5 17.5h17" /></>,
  search: <><circle cx="11" cy="11" r="6.25" /><path d="m15.6 15.6 4.4 4.4" /></>,
  home: <><path d="M4 10.2 12 4l8 6.2V19a1.2 1.2 0 0 1-1.2 1.2h-3.4v-5.4H8.6v5.4H5.2A1.2 1.2 0 0 1 4 19z" /></>,
  star: <><path d="m12 4 2.45 5.1 5.55.75-4.05 3.9 1 5.55L12 16.7l-4.95 2.6 1-5.55L4 9.85l5.55-.75z" /></>,
  rocket: <><path d="M13.5 4.5c3.3 1 5.2 3.6 5.6 7.2-2.6 2.7-5.4 4.6-8.4 5.6l-3.6-3.6c1-3 2.9-5.8 6.4-9.2Z" /><circle cx="14.2" cy="9.8" r="1.6" /><path d="M7.4 16.6 5 19" /></>,
  clock: <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.6V12l3 1.8" /></>,
  target: <><circle cx="12" cy="12" r="8.2" /><circle cx="12" cy="12" r="3.6" /><path d="M12 3.8v2.6M12 17.6v2.6M3.8 12h2.6M17.6 12h2.6" /></>,
  ticket: <><path d="M4 8.4A1.4 1.4 0 0 1 5.4 7h13.2A1.4 1.4 0 0 1 20 8.4v2a2 2 0 0 0 0 3.2v2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 15.6v-2a2 2 0 0 0 0-3.2z" /><path d="M13.2 7v10" strokeDasharray="2 2.2" /></>,
  gift: <><path d="M4.4 11.2h15.2v7.4a1.4 1.4 0 0 1-1.4 1.4H5.8a1.4 1.4 0 0 1-1.4-1.4z" /><path d="M3.6 8h16.8v3.2H3.6z" /><path d="M12 8v12" /><path d="M12 8S10.6 4 8.4 4a2 2 0 0 0 0 4zM12 8s1.4-4 3.6-4a2 2 0 0 1 0 4z" /></>,
  megaphone: <><path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H8l6.5 4V4.5L8 8.5H5.5A1.5 1.5 0 0 0 4 10Z" /><path d="M17.6 9a4 4 0 0 1 0 6" /><path d="M8 15.5V20" /></>,
  dice: <><rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.4" /><circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none" /><circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" /></>,
  ball: <><circle cx="12" cy="12" r="8.2" /><path d="M12 3.8c2.4 2.3 3.6 5 3.6 8.2s-1.2 5.9-3.6 8.2c-2.4-2.3-3.6-5-3.6-8.2s1.2-5.9 3.6-8.2Z" /><path d="M4.2 9.4h15.6M4.2 14.6h15.6" /></>,
  controller: <><path d="M8.2 8h7.6a4.6 4.6 0 0 1 4.5 3.7l.7 4a2.4 2.4 0 0 1-4.3 1.9l-1.3-1.8H8.6l-1.3 1.8A2.4 2.4 0 0 1 3 15.7l.7-4A4.6 4.6 0 0 1 8.2 8Z" /><path d="M7.6 12.4h2.6M8.9 11.1v2.6" /><circle cx="15.6" cy="12.4" r="1.05" fill="currentColor" stroke="none" /></>,
  slots: <><rect x="3.6" y="5.4" width="16.8" height="13.2" rx="2.4" /><path d="M9.2 5.4v13.2M14.8 5.4v13.2" /><path d="M6.4 12h0.01M12 12h0.01M17.6 12h0.01" strokeWidth="2.6" strokeLinecap="round" /></>,
  live: <><rect x="3" y="5" width="18" height="12.4" rx="2.4" /><path d="m10.4 9.2 4.4 3-4.4 3z" fill="currentColor" stroke="none" /><path d="M8.2 20.4h7.6" /></>,
  table: <><path d="M12 3.6c2.9 2.6 5.4 5.1 5.4 7.7a5.4 5.4 0 0 1-10.8 0c0-2.6 2.5-5.1 5.4-7.7Z" /><path d="M12 16.7v3.7M9.4 20.4h5.2" /></>,
  grid: <><rect x="3.8" y="3.8" width="7" height="7" rx="1.8" /><rect x="13.2" y="3.8" width="7" height="7" rx="1.8" /><rect x="3.8" y="13.2" width="7" height="7" rx="1.8" /><rect x="13.2" y="13.2" width="7" height="7" rx="1.8" /></>,
  chevronDown: <><path d="m6.5 9.5 5.5 5.5 5.5-5.5" /></>,
  chevronLeft: <><path d="M14.5 5.5 8 12l6.5 6.5" /></>,
  chevronRight: <><path d="M9.5 5.5 16 12l-6.5 6.5" /></>,
  user: <><circle cx="12" cy="8.4" r="3.8" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" /></>,
  wallet: <><path d="M3.8 7.6A2 2 0 0 1 5.8 5.6h11.4a1.6 1.6 0 0 1 1.6 1.6v1.4" /><rect x="3.8" y="7.6" width="16.4" height="11.4" rx="2.4" /><circle cx="16.2" cy="13.3" r="1.3" fill="currentColor" stroke="none" /></>,
  bell: <><path d="M6.8 10.2a5.2 5.2 0 0 1 10.4 0c0 3.4.9 5 1.8 6H5c.9-1 1.8-2.6 1.8-6Z" /><path d="M10.2 19.2a2 2 0 0 0 3.6 0" /></>,
  chat: <><path d="M20 12.4c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.7-.4L4.6 20l1.2-3.4A6.2 6.2 0 0 1 4 12.4c0-3.6 3.6-6.5 8-6.5s8 2.9 8 6.5Z" /></>,
  refresh: <><path d="M19.4 11a7.4 7.4 0 0 0-13-3.6" /><path d="M4.6 13a7.4 7.4 0 0 0 13 3.6" /><path d="M6.2 3.6v3.9h3.9M17.8 20.4v-3.9h-3.9" /></>,
  trophy: <><path d="M7.4 4.6h9.2v4.6a4.6 4.6 0 1 1-9.2 0z" /><path d="M7.4 6.2H5a2 2 0 0 0 2.4 3.6M16.6 6.2H19a2 2 0 0 1-2.4 3.6" /><path d="M12 13.8v3.4M8.8 19.4h6.4" /></>,
  fire: <><path d="M12 3.6c3.4 3.3 5.6 6 5.6 9a5.6 5.6 0 1 1-11.2 0c0-1.5.6-2.9 1.7-4.3.5 1 1.2 1.7 2 2 .1-2.5.7-4.6 1.9-6.7Z" /></>,
  plus: <><path d="M12 5.6v12.8M5.6 12h12.8" /></>,
};

export default function Icon({ name, size = 20, className = "", strokeWidth = 1.75, ...rest }) {
  const glyph = paths[name];
  if (!glyph) return null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {glyph}
    </svg>
  );
}
