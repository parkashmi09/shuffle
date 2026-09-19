/* Loads one page of sports bets or casino transactions for the current subject
   and period. Kept separate from the statement because these lists are
   unbounded — they page on the server rather than being capped and truncated. */
import { useCallback, useEffect, useState } from "react";
import * as lordsApi from "../../services/lordsApi";
import { Pagination, SubjectType } from "./types";
import { cleanError, Range } from "./ui";

const EMPTY: Pagination = { page: 1, limit: 50, total: 0, totalPages: 1 };

export function useBetPage<T>(
  kind: "sports" | "casino",
  subjectType: SubjectType,
  subjectId: string,
  range: Range,
  pageSize = 50
) {
  const [rows, setRows] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // A new period is a new question — always restart at page one.
  useEffect(() => { setPage(1); }, [range.from, range.to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await lordsApi.getAccountBets(subjectType, subjectId, {
        kind,
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
      });
      setRows(res.rows as unknown as T[]);
      setPagination(res.pagination);
    } catch (e: any) {
      setError(cleanError(e, "Could not load this list"));
      setRows([]);
      setPagination(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [kind, subjectType, subjectId, range.from, range.to, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  return { rows, pagination, page, setPage, loading, error, reload: load };
}
