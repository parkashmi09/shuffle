import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Typography, alpha } from '@mui/material';
import { ErrorOutlineOutlined } from '@mui/icons-material';
import { C } from './admin-dashboard/shared';

/**
 * Catch-all for unmatched URLs.
 *
 * Without this the router matched nothing and rendered an empty tree, so a
 * mistyped or not-yet-built path showed a blank white page with no clue that
 * anything was wrong.
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Send people back to the panel they were actually trying to use.
  const isMarketing = pathname.startsWith('/marketing');
  const home = isMarketing ? '/marketing' : '/';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper
        elevation={0}
        sx={{
          maxWidth: 460, width: '100%', p: 5, borderRadius: 4, textAlign: 'center',
          bgcolor: C.card, border: `1px solid ${C.border}`,
        }}
      >
        <Box
          sx={{
            width: 56, height: 56, borderRadius: '50%', mx: 'auto', mb: 2.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha(C.warning, 0.14), color: C.warning,
          }}
        >
          <ErrorOutlineOutlined sx={{ fontSize: 30 }} />
        </Box>

        <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.3rem', mb: 1 }}>
          Page not found
        </Typography>
        <Typography sx={{ color: C.textSecondary, fontSize: '0.85rem', mb: 3, wordBreak: 'break-all' }}>
          Nothing is routed at <code>{pathname}</code>.
        </Typography>

        <Button
          variant="contained"
          onClick={() => navigate(home, { replace: true })}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: C.primary, '&:hover': { bgcolor: C.primaryLight } }}
        >
          Go back
        </Button>
      </Paper>
    </Box>
  );
};

export default NotFound;
