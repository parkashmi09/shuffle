import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Tabs, Tab, Typography, Alert, Chip, Stack } from "@mui/material";

import { apiFetch } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";
import CurationBoard from "./game-curation/CurationBoard";
import { CollectionSummary } from "./game-curation/types";

/**
 * The curated lobby collections — hot, live casino, popular slots, crash,
 * Indian, and the home page's trending row.
 *
 * ── IT CURATED THE WRONG CATALOGUE ───────────────────────────────────────
 *
 * This screen posted to the legacy `/api/gis/admin/gis/<collection>` paths,
 * which write a CSV of aggregator `uuid`s. The site lists `js_games` and
 * launches by `game_uid`; an aggregator uuid opens nothing. Every collection
 * built here was invisible on the site.
 *
 * `trending` is listed here as well as having its own screen — the same list,
 * reachable from either place, because an operator who is already curating
 * collections should not have to go somewhere else for the one that happens to
 * sit on the home page.
 */
const ProvidersPriority: React.FC = () => {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<CollectionSummary[]>(ENDPOINTS.casinoJsCuration.collections);
      setCollections(Array.isArray(res) ? res : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Could not load the collections");
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * ── THERE USED TO BE TWO "ALL GAMES" TABS ───────────────────────────────
   *
   * `all` is one of the collections the server returns, and this screen also
   * inserted a hand-made "All Games" tab at index 0 pointing at the same key.
   * Two tabs, same list, different labels and different counts — the synthetic
   * one always read 0 because the catalogue pull behind it was failing.
   * The collection is the only one now; what makes it different is how it is
   * BOARDED, not that it is a separate screen.
   */
  const active = useMemo(
    () => collections[Math.min(Math.max(tab, 0), Math.max(collections.length - 1, 0))] ?? null,
    [collections, tab]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography sx={{ color: "#F9F9F9", fontSize: "1.35rem", fontWeight: 800 }}>Providers Priority</Typography>
      <Typography sx={{ color: "#8384A5", fontSize: "0.82rem", mt: 0.5, mb: 2 }}>
        The curated rows of the casino lobby. Each list is ordered by hand and rendered in that order on the site.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Tabs
        value={Math.min(tab, Math.max(collections.length - 1, 0))}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          borderBottom: "1px solid #1E2D55",
          "& .MuiTab-root": { color: "#8384A5", textTransform: "none", fontWeight: 600, minHeight: 44 },
          "& .Mui-selected": { color: "#F9F9F9 !important" },
        }}
      >
        {collections.map((collection) => (
          <Tab
            key={collection.key}
            label={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <span>{collection.label}</span>
                <Chip
                  size="small"
                  label={collection.key === "all" ? `${collection.games} top` : collection.games}
                  sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#0B1427", color: "#8384A5" }}
                />
              </Stack>
            }
          />
        ))}
      </Tabs>

      {loading && collections.length === 0 ? (
        <Typography sx={{ color: "#8384A5", fontSize: "0.85rem" }}>Loading collections…</Typography>
      ) : active ? (
        <CurationBoard
          key={active.key}
          scope="collection"
          curationKey={active.key}
          title={active.label}
          /* `all` is the whole catalogue with a curated head; the other six are
             exactly the games an operator picked. See CurationBoard's prop. */
          priorityOverCatalogue={active.key === "all"}
          onSaved={load}
        />
      ) : null}
    </Box>
  );
};

export default ProvidersPriority;
