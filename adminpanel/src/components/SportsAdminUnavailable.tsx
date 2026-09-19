import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Construction } from '@mui/icons-material';

/**
 * Sports admin screens call `/api/v1/admin/sports/*`. That service does not
 * boot in the current dev stack (missing legacy module). Show this instead of
 * a wall of gateway "Route not found" errors.
 */
const SportsAdminUnavailable: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8, px: 2 }}>
    <Paper
      elevation={0}
      sx={{
        maxWidth: 520,
        p: 4,
        textAlign: 'center',
        bgcolor: '#0E1831',
        border: '1px solid #1E2D55',
        borderRadius: 3,
      }}
    >
      <Construction sx={{ fontSize: 48, color: '#FFC23F', mb: 2 }} />
      <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '1.15rem', mb: 1 }}>
        Sports admin is not available
      </Typography>
      <Typography sx={{ color: '#8384A5', fontSize: '0.88rem', lineHeight: 1.6 }}>
        The sports service is not running in this environment, so settlement and sportsbook
        tools cannot load. Casino, users, wallet, site config, and marketing tools remain
        available from the sidebar.
      </Typography>
    </Paper>
  </Box>
);

export default SportsAdminUnavailable;
