import React, { useCallback, useEffect, useState } from "react";
import { Box, Grid, Typography, Alert } from "@mui/material";

import { apiFetch } from "../../utils/api";
import CurationBoard from "./CurationBoard";
import FacetList from "./FacetList";
import { CurationScope, Facet } from "./types";

/* The vendor and type screens are the same page with a different facet
   endpoint and a different scope, so they are one component with two callers.
   Picking a facet on the left opens its curated list on the right. */

interface Props {
  scope: Extract<CurationScope, "vendor" | "type">;
  /** The admin endpoint listing the facets — vendors or game types. */
  facetsPath: string;
  heading: string;
  blurb: string;
  listTitle: string;
  noun: string;
}

const FacetCurationPage: React.FC<Props> = ({ scope, facetsPath, heading, blurb, listTitle, noun }) => {
  const [facets, setFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Facet[]>(facetsPath);
      const list = Array.isArray(res) ? res : [];
      setFacets(list);
      setError(null);
      // Open something rather than an empty right-hand side: the first facet
      // that already has a curated list, else simply the first one.
      setSelected((prev) => prev ?? list.find((f) => f.curated)?.name ?? list[0]?.name ?? null);
    } catch (e: any) {
      setError(e?.message || `Could not load the ${noun} list`);
      setFacets([]);
    } finally {
      setLoading(false);
    }
  }, [facetsPath, noun]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography sx={{ color: "#F9F9F9", fontSize: "1.35rem", fontWeight: 800 }}>{heading}</Typography>
      <Typography sx={{ color: "#8384A5", fontSize: "0.82rem", mt: 0.5, mb: 2.5 }}>{blurb}</Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4} lg={3}>
          <FacetList
            title={listTitle}
            facets={facets}
            loading={loading}
            selected={selected}
            onSelect={setSelected}
            noun={noun}
          />
        </Grid>
        <Grid item xs={12} md={8} lg={9}>
          {selected ? (
            <CurationBoard
              scope={scope}
              curationKey={selected}
              title={selected}
              pickerFilter={scope === "vendor" ? { vendor: selected } : { type: selected }}
              onSaved={load}
            />
          ) : (
            <Typography sx={{ color: "#8384A5", fontSize: "0.85rem", p: 4 }}>
              Pick a {noun} on the left to order its games.
            </Typography>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default FacetCurationPage;
