import { useEffect, useState, useCallback } from 'react';
import {
  StaffPermissions,
  buildFullPermissions,
  buildEmptyPermissions,
  SUPER_ROLES,
  roleKey,
} from '../constants/permissions';
import * as lordsApi from '../services/lordsApi';

const CACHE_KEY = 'myPermissions';

function loadCache(): StaffPermissions | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as StaffPermissions) : null;
  } catch {
    return null;
  }
}

function saveCache(p: StaffPermissions) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(p));
  } catch {}
}

interface UsePermissionsResult {
  permissions: StaffPermissions;
  role: string;
  isSuper: boolean;
  loading: boolean;
  can: (key: string) => boolean;
  /** True when ANY of the keys is granted — used where a capability was
   *  renamed and older accounts still carry the legacy key. */
  canAny: (keys: readonly string[]) => boolean;
  pageVisible: (path: string) => boolean;
  groupVisible: (title: string) => boolean;
  refresh: () => Promise<void>;
}

/**
 * Role names are compared WITHOUT spacing or case.
 *
 * ── "Super Admin" IS NOT "SuperAdmin" ──────────────────────────────────
 *
 * `SUPER_ROLES` spells them closed-up (`SuperAdmin`, `SubAdmin`); the `roles`
 * table — and therefore the token and `localStorage.userRole` — spells them
 * with a space (`Super Admin`, `Sub Admin`, `Super Master`). An exact
 * `includes()` matched only the three that happen to be one word, so the
 * PLATFORM OWNER fell through to the executive permission path and got the
 * empty set: every sidebar group hidden and every `can()` false, on the one
 * account that is supposed to hold everything.
 */
const SUPER_ROLE_KEYS = new Set(
  [...(SUPER_ROLES as readonly string[]), 'SuperMaster'].map(roleKey)
);

export function usePermissions(): UsePermissionsResult {
  const role = localStorage.getItem('userRole') || 'Guest';
  const isSuper = SUPER_ROLE_KEYS.has(roleKey(role));

  const [permissions, setPermissions] = useState<StaffPermissions>(() => {
    if (isSuper) return buildFullPermissions();
    return loadCache() ?? buildEmptyPermissions();
  });
  const [loading, setLoading] = useState(!isSuper && loadCache() === null);

  const refresh = useCallback(async () => {
    if (isSuper) return;
    try {
      /**
       * The server answers a FLAT LIST of `resource:action` grants; this hook
       * wants `{groups, pages, authority}` keyed by the panel's own
       * `canDoThing` names. The two vocabularies do not overlap, so assigning
       * `data.permissions` straight in put a raw array where every selector
       * reads `.authority[key]` — always undefined, always denied.
       *
       * `*` is the one grant that translates cleanly and is the one that
       * matters here. Anything narrower stays denied until a real key map
       * exists — refusing is the safe direction for a permission system, and
       * guessing at 30-odd security-relevant mappings is not this fix's job.
       */
      const data = await lordsApi.getMyPermissions();
      const granted = Array.isArray(data?.permissions) ? data.permissions : [];

      const next = granted.includes('*') ? buildFullPermissions() : buildEmptyPermissions();
      setPermissions(next);
      saveCache(next);
    } catch (e) {
      console.error('[Permissions] refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, [isSuper]);

  /**
   * ── THERE IS NO PERMISSION SOCKET EVENT ────────────────────────────────
   *
   * This called `socketService.subscribeToMyPermissions` and, on unmount,
   * `unsubscribeFromMyPermissions`. Neither exists — `socketService` exposes
   * exactly three events (`getAdminProfile`, `getUsersAllDetails`,
   * `stopUsersAllDetails`) because those are the only ones admin-service
   * registers. The call threw a TypeError inside the effect on every mount for
   * every non-super account, which took the `refresh()` below down with it, so
   * permissions never loaded and the panel fell back to the empty set.
   *
   * A push is not needed to be correct: the server re-reads a staff member's
   * permissions from the database on EVERY request, so a demotion takes effect
   * immediately regardless of what this cache says. The poll below only keeps
   * the menu in step with it.
   */
  useEffect(() => {
    if (isSuper) return;
    if (!localStorage.getItem('token')) return;

    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [isSuper, refresh]);

  const can = useCallback(
    (key: string) => {
      if (isSuper) return true;
      return Boolean(permissions.authority?.[key]);
    },
    [isSuper, permissions]
  );

  const canAny = useCallback(
    (keys: readonly string[]) => {
      if (isSuper) return true;
      return keys.some((k) => Boolean(permissions.authority?.[k]));
    },
    [isSuper, permissions]
  );

  const groupVisible = useCallback(
    (title: string) => {
      if (isSuper) return true;
      return Boolean(permissions.groups?.[title]);
    },
    [isSuper, permissions]
  );

  const pageVisible = useCallback(
    (path: string) => {
      if (isSuper) return true;
      return Boolean(permissions.pages?.[path]);
    },
    [isSuper, permissions]
  );

  return { permissions, role, isSuper, loading, can, canAny, pageVisible, groupVisible, refresh };
}
