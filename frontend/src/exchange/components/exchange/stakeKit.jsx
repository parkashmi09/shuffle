/* stake: the hash-game-exchange shared components the ported exchange draws (DialogShell, Select,
   Input, Pagination, Notice, Switch, Skeleton, icons, Link), rebuilt on stake's own primitives
   (ui/Modal, ui/RbPagination, lib/router) and look. Same props as hash's, so the exchange files
   only change their import line. */
import { useEffect } from 'react';
import { navigate } from '../../lib/router';
import { chromeArt, sportArt } from './sportArt';
import { cx } from './utils';

/** react-router's `<Link to>` over stake's history router. */
export function Link({ to, onClick, children, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/** A titled dialog: centred on desktop, a bottom sheet on a phone (`.RbExch_scrim` in shuffle-exchange.css). */
export function DialogShell({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="RbExch_scrim" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className="rb-exch RbExch_dialog"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <button type="button" className="RbExch_dialogClose" aria-label="Close" onClick={onClose}>
          <IconClose className="size-4 fill-secondary" />
        </button>
        {title && <p className="RbExch_dialogTitle">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** hash's Select (`value` / `options` are `{ value, label }`), as a native select in the input box. */
export function Select({ title, value, options, onChange }) {
  return (
    <span className="input">
      <select
        aria-label={title}
        value={value?.value ?? ''}
        onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value))}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function Input({ value, onChange, type = 'text', placeholder, required = false }) {
  return (
    <span className="input">
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

/** hash's `pages` is the page count; nothing to page through, no pager. */
export function Pagination({ page, pages, onChange }) {
  if (!(pages > 1)) return null;
  return (
    <nav aria-label="pagination" className="mt-4 flex items-center justify-center gap-3">
      <button type="button" className="button button-s button-second px-3" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span className="text-xs text-secondary">
        {page} / {pages}
      </span>
      <button type="button" className="button button-s button-second px-3" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function EmptyPlaceholder({ children }) {
  return <p className="py-10 text-center text-sm text-tertiary">{children}</p>;
}

export function Notice({ type = 'info', className = '', children }) {
  return (
    <p
      className={cx(
        'rounded-lg px-3 py-2.5 text-xs',
        type === 'warning' ? 'bg-warning/10 text-warning' : 'bg-layer5 text-secondary',
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Switch({ value, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(value)}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={cx('relative h-5 w-9 flex-none rounded-full transition-colors', value ? 'bg-brand' : 'bg-layer6')}
    >
      <span
        className={cx(
          'absolute top-0.5 left-0.5 size-4 rounded-full bg-alw_white transition-transform',
          value && 'translate-x-4',
        )}
      />
    </button>
  );
}

export function Skeleton({ as: Tag = 'div', className = '', radius, ...rest }) {
  void radius;
  return <Tag className={cx('animate-pulse bg-layer5', className)} {...rest} />;
}

/* ── icons (hash components/shared/icons.jsx, 32-unit viewBox, coloured by `fill-*`) ── */
const Icon = ({ className, children, ...rest }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const IconClose = (props) => (
  <Icon {...props}>
    <path d="M7.15445 7.40846C6.3734 8.18951 6.3734 9.45584 7.15445 10.2369L12.9175 15.9999L7.15445 21.7629C6.3734 22.544 6.3734 23.8103 7.15445 24.5914L7.40846 24.8454C8.18951 25.6264 9.45584 25.6264 10.2369 24.8454L15.9998 19.0825L21.7631 24.8458C22.5441 25.6269 23.8104 25.6269 24.5915 24.8458L24.8455 24.5918C25.6265 23.8108 25.6265 22.5444 24.8455 21.7634L19.0825 16.0003L24.8455 10.2373C25.6265 9.45627 25.6265 8.18994 24.8455 7.40889L24.5915 7.15488C23.8104 6.37383 22.5441 6.37383 21.7631 7.15488L16.0002 12.9177L10.2369 7.15445C9.45584 6.3734 8.18951 6.3734 7.40846 7.15445L7.15445 7.40846Z" />
  </Icon>
);

export const IconArrow = (props) => (
  <Icon {...props}>
    <path d="M19.6912 5.6L9.2912 16L19.6912 26.4L22.7088 23.3824L15.3264 16L22.7088 8.6176L19.6912 5.6Z" />
  </Icon>
);

export const IconCheck = (props) => (
  <Icon {...props}>
    <path d="M27.7997 7.76311C28.6578 8.64647 28.6578 10.0787 27.7997 10.962L14.9042 24.2367C14.0461 25.1201 12.6548 25.1201 11.7967 24.2367L4.20072 16.4173C3.34261 15.534 3.3426 14.1018 4.2007 13.2184C5.0588 12.3351 6.45006 12.335 7.30817 13.2184L13.3505 19.4384L24.6922 7.76309C25.5503 6.87974 26.9416 6.87975 27.7997 7.76311Z" />
  </Icon>
);

export const IconInform = (props) => (
  <Icon {...props}>
    <path d="M16.0005 4C22.6282 4 28.001 9.37279 28.001 16.0005C28.001 22.6282 22.6282 28.001 16.0005 28.001C9.37279 28.001 4 22.6282 4 16.0005C4 9.37279 9.37279 4 16.0005 4ZM15.8393 20.2572C15.4433 20.2572 15.1193 20.3832 14.8493 20.6352C14.5793 20.8873 14.4533 21.2113 14.4533 21.6073C14.4533 22.0033 14.5793 22.3273 14.8493 22.5793C15.1193 22.8313 15.4433 22.9753 15.8393 22.9753C16.2354 22.9753 16.5594 22.8493 16.8294 22.5973C17.0994 22.3453 17.2434 22.0033 17.2434 21.6073C17.2434 21.2113 17.0994 20.8873 16.8474 20.6352C16.5774 20.3832 16.2354 20.2572 15.8393 20.2572ZM15.7999 8.74019C15.7768 8.74019 15.7536 8.74105 15.7313 8.74191C14.8313 8.77962 14.1327 9.53994 14.1713 10.44L14.5013 18.2506H17.0651L17.4234 10.4391C17.4243 10.4143 17.4251 10.3894 17.4251 10.3645C17.4251 9.46708 16.6974 8.74019 15.8008 8.74019H15.7999Z" />
  </Icon>
);

/* hash pages/Sports/icons.jsx: BetBy's SVGs inlined so a CSS `fill` reaches them. */
function RawSvg({ svg, className = '', ...rest }) {
  if (!svg) return null;
  return <span className={`inline-flex ${className}`} dangerouslySetInnerHTML={{ __html: svg }} {...rest} />;
}

export const SportArt = ({ sport, ...rest }) => <RawSvg svg={sportArt(sport)} {...rest} />;
export const BetbyIcon = ({ name, ...rest }) => <RawSvg svg={chromeArt(name)} {...rest} />;
