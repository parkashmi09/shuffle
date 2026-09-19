import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

// ====== Types ======
interface FancyResult {
  id: number;
  fancyname: string;
  eventid: number;
  matchid: number;
  lastfetchdate: string; // ISO timestamp
  // If your table has more columns later, add them here
}

interface PaginationState {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

interface FancyResultResponse {
  results: FancyResult[]; // what our simple backend returned earlier
  pagination: {
    total?: number;
    totalPages?: number;
    page?: number;
    limit?: number;
  };
}

// ====== Component ======
const FancyResultNotShowingFromApi: React.FC = () => {
  const staffId = localStorage.getItem("currentUserId");
  const token = localStorage.getItem("token");

  const [rows, setRows] = useState<FancyResult[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [pagination, setPagination] = useState<PaginationState>({
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    limit: 20,
  });

  // ---- Configurable base URL (adjust to your API) ----
  const BASE_URL = useMemo(() => {
    return (
      "https://api.stake.com"
    );
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      fetchData(1); // reset to page 1 on search
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // fetch when page changes
  useEffect(() => {
    fetchData(pagination.currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage]);

  // ---- Fetch ----
  const fetchData = async (pageToFetch: number) => {
    setLoading(true);
    try {
      const limit = pagination.limit;
      let url = `${BASE_URL}/sportsbetting/fancynotsettle?page=${pageToFetch}&limit=${limit}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(staffId ? { "x-staff-id": staffId } : {}),
      };

      const { data } = await axios.get<FancyResultResponse>(url, { headers });

      // server returns { results, pagination: { total, totalPages, page, limit } }
      const results = (data as any).results || [];
      const serverPagination = (data as any).pagination || {};

      setRows(results as FancyResult[]);
      setPagination({
        totalCount: serverPagination.total ?? 0,
        totalPages: serverPagination.totalPages ?? Math.ceil((serverPagination.total ?? 0) / limit),
        currentPage: serverPagination.page ?? pageToFetch,
        limit: serverPagination.limit ?? limit,
      });
    } catch (e) {
      console.error("Failed to fetch fancy results:", e);
    } finally {
      setLoading(false);
    }
  };

  // ---- Handlers ----
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (pagination.totalPages && newPage > pagination.totalPages)) return;
    setPagination((p) => ({ ...p, currentPage: newPage }));
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };

  // ---- Formatters ----
  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString() : "-";

  // ---- UI ----
  return (
    <div className="ml-0 lg:ml-[256px] p-6">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold mb-6">Fancy Api Report</h1>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              id="search-input"
              type="text"
              placeholder="Search by fancy name, event id, or match id"
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-end justify-end">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-100 rounded border hover:bg-gray-200 disabled:opacity-50"
              aria-label="Clear filters"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="mb-4">
          <span className="text-gray-600">
            Showing {rows.length} of {pagination.totalCount} records
          </span>
        </div>

        {/* Loading / No results */}
        {loading && rows.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500">Loading fancy results...</p>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500">No fancy results found</p>
          </div>
        )}

        {/* Table */}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full bg-white shadow-md rounded-lg overflow-hidden">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fancy Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Fetch Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{r.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.fancyname}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.eventid}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.matchid}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.lastfetchdate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center mt-6">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-4 py-2 mr-4 bg-gray-100 rounded border hover:bg-gray-200 disabled:opacity-50"
              aria-label="Previous page"
            >
              Previous
            </button>

            <div className="text-center px-4 py-2 bg-gray-50 rounded border min-w-[80px]">
              {pagination.currentPage} / {pagination.totalPages || 1}
            </div>

            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages || pagination.totalPages === 0}
              className="px-4 py-2 ml-4 bg-gray-100 rounded border hover:bg-gray-200 disabled:opacity-50"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FancyResultNotShowingFromApi;
