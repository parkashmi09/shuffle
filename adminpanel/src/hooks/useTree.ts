// src/hooks/useTree.ts
import { useState, useEffect } from "react";
import { apiFetch, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";

/* ────────────────────────────────── Types ───────────────────────────────── */

export interface Node {
  id: number;
  name: string;
  role: { name: string; level: number };
  balance: number;
  parent_id: number | null;
}

export interface Analytics {
  staffTrend:  { day: string; count: number }[];
  playerTrend: { day: string; count: number }[];
}

export interface Metrics {
  staff_cnt:  number;
  player_cnt: number;
  bank:       string;
}

/** `GET /admin/staff/rollup/:staffId` — what `metrics` is derived from. */
interface Rollup {
  staffId:         number;
  includesSubtree: boolean;
  staffAccounts:   number;
  players:         number;
  balance:         string;
  currency:        string;
}

/**
 * `GET /admin/staff/analytics/:staffId` — a FLAT list of transfer activity.
 *
 * Each row is one day and one direction, not a staff/player signup count.
 */
interface AnalyticsRow {
  day:       string;
  direction: string;
  count:     number;
  total:     string;
}

/* ───────────────────────────────── Hook ─────────────────────────────────── */

export function useTree() {
  const [staff,     setStaff]     = useState<Node[]>([]);
  const [players,   setPlayers]   = useState<Node[]>([]);
  const [metrics,   setMetrics]   = useState<Metrics | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      /**
       * ── `/api/staff/metrics/:id` HAS NEVER EXISTED HERE ────────────────
       *
       * admin-service has no `metrics` route. The equivalent is
       * `rollup/:staffId`, which answers `{staffAccounts, players, balance}`
       * where this expected `{staff_cnt, player_cnt, bank}` — mapped below so
       * `DashboardTab` keeps reading the names it already reads.
       *
       * `analytics/:staffId` DOES exist, but it returns a FLAT ARRAY of
       * transfer activity (`{day, direction, count, total}`) — not the
       * `{staffTrend, playerTrend}` signup split this typed it as. The two
       * directions are split into those buckets so the charts have real data
       * in them: `in` is credit received, `out` is credit issued downstream.
       *
       * All four ran through `Promise.all`, so the one 404 rejected the whole
       * batch and the staff and player lists were discarded with it — the
       * dashboard rendered empty even though two of the four calls succeeded.
       * `allSettled` keeps what worked.
       */
      const id = localStorage.getItem("currentUserId");
      const staffId = id && !isNaN(+id) ? id : null;

      const [s, p, m, a] = await Promise.allSettled([
        apiFetch<Node[]>(ENDPOINTS.staff.list),
        apiFetch<Node[]>(ENDPOINTS.staff.players),
        staffId
          ? apiFetch<Rollup>(buildPath(ENDPOINTS.staff.rollup, { staffId }), {
              query: { includeSubtree: true },
            })
          : Promise.reject(new Error("no staff id")),
        staffId
          ? apiFetch<AnalyticsRow[]>(buildPath(ENDPOINTS.staff.analytics, { staffId }))
          : Promise.reject(new Error("no staff id")),
      ]);

      if (cancelled) return;             // component unmounted

      if (s.status === "fulfilled") setStaff(s.value ?? []);
      if (p.status === "fulfilled") setPlayers(p.value ?? []);

      if (m.status === "fulfilled" && m.value) {
        setMetrics({
          staff_cnt:  m.value.staffAccounts,
          player_cnt: m.value.players,
          bank:       m.value.balance,
        });
      }

      if (a.status === "fulfilled" && Array.isArray(a.value)) {
        const bucket = (want: string) =>
          a.value
            .filter((r) => String(r.direction).toLowerCase() === want)
            .map((r) => ({ day: r.day, count: r.count }));

        setAnalytics({ staffTrend: bucket("in"), playerTrend: bucket("out") });
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { staff, players, metrics, analytics, loading };
}
