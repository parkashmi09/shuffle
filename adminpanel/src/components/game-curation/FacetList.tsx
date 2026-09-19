import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  InputAdornment,
  CircularProgress,
  Chip,
  ListItemButton,
} from "@mui/material";
import { Search } from "lucide-react";

import { Facet } from "./types";
import { cardSx, inputSx } from "./styles";

/* The left-hand column of the vendor and type screens: which list are we
   editing. Filtered in the browser — there are a few dozen vendors and about
   fifty types, and a round trip per keystroke for that is worse than useless. */

interface Props {
  title: string;
  facets: Facet[];
  loading: boolean;
  selected: string | null;
  onSelect: (name: string) => void;
  /** Word for one entry, used in the empty state: "vendor", "type". */
  noun: string;
}

const FacetList: React.FC<Props> = ({ title, facets, loading, selected, onSelect, noun }) => {
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return facets;
    return facets.filter((f) => f.name.toLowerCase().includes(term));
  }, [facets, q]);

  return (
    <Paper sx={{ ...cardSx, display: "flex", flexDirection: "column", height: "100%", minHeight: 420 }}>
      <Box sx={{ p: 2, borderBottom: "1px solid #1E2D55" }}>
        <Typography sx={{ color: "#F9F9F9", fontWeight: 700, mb: 1.25 }}>{title}</Typography>
        <TextField
          fullWidth
          size="small"
          placeholder={`Filter ${noun}s…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={inputSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={15} color="#8384A5" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>
        {loading ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <CircularProgress size={20} sx={{ color: "#886CFF" }} />
          </Box>
        ) : shown.length === 0 ? (
          <Typography sx={{ color: "#8384A5", fontSize: "0.8rem", py: 4, textAlign: "center" }}>
            No {noun} matches that.
          </Typography>
        ) : (
          shown.map((facet) => (
            <ListItemButton
              key={facet.name}
              selected={selected === facet.name}
              onClick={() => onSelect(facet.name)}
              sx={{
                px: 2,
                py: 1,
                "&.Mui-selected": { bgcolor: "rgba(136,108,255,0.16)" },
                "&.Mui-selected:hover": { bgcolor: "rgba(136,108,255,0.22)" },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: "100%", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    noWrap
                    sx={{ color: selected === facet.name ? "#F9F9F9" : "#C8CAE5", fontSize: "0.83rem", fontWeight: 600 }}
                  >
                    {facet.name}
                  </Typography>
                  <Typography sx={{ color: "#8384A5", fontSize: "0.7rem" }}>
                    {facet.games} game{facet.games === 1 ? "" : "s"}
                  </Typography>
                </Box>
                {/* Curated vs not is the one thing an operator scans this list
                    for — which of these have I already ordered. */}
                {facet.curated && (
                  <Chip
                    size="small"
                    label={facet.prioritized}
                    sx={{
                      height: 19,
                      minWidth: 26,
                      fontSize: "0.66rem",
                      bgcolor: "rgba(136,108,255,0.2)",
                      color: "#A08FFF",
                    }}
                  />
                )}
              </Stack>
            </ListItemButton>
          ))
        )}
      </Box>
    </Paper>
  );
};

export default FacetList;
