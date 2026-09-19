import React from "react";
import { Box, Typography, Alert, Chip, Stack } from "@mui/material";

import CurationBoard from "./game-curation/CurationBoard";

/**
 * The casino lobby's "Only on Stake" shelf — the exclusives row, badged 2x VIP.
 *
 * ── IT WAS SIXTY TILES IN A SOURCE FILE, AND THEY WERE THE WRONG SIXTY ───
 *
 * The site drew this row from `src/Pages/casinoPage/casinoData.js`, a list
 * transcribed from a capture of stake.com. Those tiles name Stake's library
 * rather than this deployment's catalogue, so none of them could be opened —
 * and changing what was "exclusive" meant a code change and a deploy on one of
 * the lobby's most prominent rows.
 *
 * The group page behind it (`/casino/group/only-on-stake`) was worse in a
 * quieter way: it had no list at all and guessed one, showing every game whose
 * vendor happened to be `in-house` or `hacksaw`. That is a database fact, not
 * an editorial decision, and nobody made it.
 *
 * Both read `casino/js-games/v1/collections/only-on-stake` now. What is saved
 * here is what players see, in this order, in both places.
 *
 * ── THE BADGE IS NOT EDITED HERE ─────────────────────────────────────────
 *
 * "2x VIP" is a promotion the row advertises, not a property of the games in
 * it, so it stays with the row on the site. It is named below so an operator
 * can see which shelf this is without having to go and look.
 */
const OnlyOnStake: React.FC = () => (
  <Box sx={{ p: { xs: 2, md: 3 } }}>
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Typography sx={{ color: "#F9F9F9", fontSize: "1.35rem", fontWeight: 800 }}>Only on Shuffle</Typography>
      <Chip
        size="small"
        label="2x VIP"
        sx={{
          height: 20,
          fontSize: "0.68rem",
          fontWeight: 700,
          bgcolor: "rgba(14,204,104,0.14)",
          color: "#0ECC68",
        }}
      />
    </Stack>
    <Typography sx={{ color: "#8384A5", fontSize: "0.82rem", mt: 0.5, mb: 2 }}>
      The exclusives row in the casino lobby, and the group page behind its "View All".
    </Typography>

    <Alert
      severity="info"
      sx={{ mb: 2, bgcolor: "rgba(136,108,255,0.08)", color: "#C8CAE5", border: "1px solid #1E2D55" }}
    >
      While this list is empty the site falls back to its built-in row. The first save replaces it, on both
      the lobby and the group page.
    </Alert>

    <CurationBoard
      scope="collection"
      curationKey="only-on-stake"
      title="Casino lobby — Only on Shuffle"
      subtitle="Shown in this order, left to right, under the 2x VIP badge."
    />
  </Box>
);

export default OnlyOnStake;
