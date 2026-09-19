import React from "react";
import { Box, Typography, Alert } from "@mui/material";

import CurationBoard from "./game-curation/CurationBoard";

/**
 * The home page's "Trending Games" row.
 *
 * ── IT WAS TWENTY GAMES IN A SOURCE FILE ─────────────────────────────────
 *
 * The site rendered this row from `src/Pages/homePage/trendingGamesData.js` —
 * a hand-written list transcribed from a screenshot, with the tile art
 * imported as bundled PNGs. Changing what was "trending" meant a code change
 * and a deploy, and most of those twenty games are not in this platform's
 * catalogue at all, so the row advertised games nobody could open.
 *
 * The site reads `casino/js-games/v1/collections/trending` now and falls back
 * to that built-in list only while this one is empty. Saving anything here
 * takes over the row.
 */
const TrendingGames: React.FC = () => (
  <Box sx={{ p: { xs: 2, md: 3 } }}>
    <Typography sx={{ color: "#F9F9F9", fontSize: "1.35rem", fontWeight: 800 }}>Trending Games</Typography>
    <Typography sx={{ color: "#8384A5", fontSize: "0.82rem", mt: 0.5, mb: 2 }}>
      The row under the search bar on the home page, in this order.
    </Typography>

    <Alert
      severity="info"
      sx={{ mb: 2, bgcolor: "rgba(136,108,255,0.08)", color: "#C8CAE5", border: "1px solid #1E2D55" }}
    >
      While this list is empty the site shows its built-in default row. The first save replaces it.
    </Alert>

    <CurationBoard
      scope="collection"
      curationKey="trending"
      title="Home page — Trending Games"
      subtitle="Shown in this order, left to right, on the home page."
    />
  </Box>
);

export default TrendingGames;
