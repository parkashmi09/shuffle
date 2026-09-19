import React from 'react';
import { Outlet, Navigate, useNavigate, NavLink } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Avatar, Chip, alpha } from '@mui/material';
import {
  InsightsOutlined, LogoutOutlined, VisibilityOutlined,
  BarChartOutlined, PersonOutlineOutlined, GroupsOutlined,
} from '@mui/icons-material';
import { C } from '../admin-dashboard/shared';
import { getMarketingToken, getMarketingUser, clearMarketingSession } from '../../services/marketingApi';

/* Only the three read-only views this account can actually open — no admin
   navigation, so nothing is advertised that the account cannot reach. */
const NAV = [
  { to: '/marketing', end: true, label: 'Dashboard', icon: <BarChartOutlined sx={{ fontSize: 18 }} /> },
  { to: '/marketing/direct-users', end: false, label: 'Direct Users', icon: <PersonOutlineOutlined sx={{ fontSize: 18 }} /> },
  { to: '/marketing/agent-users', end: false, label: 'Agent Users', icon: <GroupsOutlined sx={{ fontSize: 18 }} /> },
];

const SIDEBAR_W = 216;

/**
 * Shell for the marketing panel: top bar + a narrow sidebar limited to the
 * marketing views. Collapses to a horizontal strip on small screens.
 */
const MarketingLayout: React.FC = () => {
  const navigate = useNavigate();
  const user = getMarketingUser();

  if (!getMarketingToken()) return <Navigate to="/marketing/login" replace />;

  const logout = () => {
    clearMarketingSession();
    navigate('/marketing/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: C.bg }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ bgcolor: C.card, borderBottom: `1px solid ${C.border}` }}
      >
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 1 }}>
          <Avatar sx={{ bgcolor: alpha(C.primary, 0.15), color: C.primary, width: 38, height: 38 }}>
            <InsightsOutlined fontSize="small" />
          </Avatar>

          <Box sx={{ mr: 'auto' }}>
            <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>
              Marketing Panel
            </Typography>
            <Typography sx={{ color: C.textSecondary, fontSize: '0.72rem' }}>
              {user?.username ? `Signed in as ${user.username}` : 'Analytics'}
            </Typography>
          </Box>

          <Chip
            size="small"
            icon={<VisibilityOutlined sx={{ fontSize: 15 }} />}
            label="Read-only"
            sx={{
              bgcolor: alpha(C.info, 0.14), color: C.info, fontWeight: 700,
              fontSize: '0.7rem', '& .MuiChip-icon': { color: 'inherit' },
            }}
          />

          <Button
            onClick={logout}
            startIcon={<LogoutOutlined />}
            sx={{
              color: C.textSecondary, textTransform: 'none', fontWeight: 600,
              '&:hover': { color: C.error, bgcolor: alpha(C.error, 0.08) },
            }}
          >
            Sign out
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Sidebar — becomes a horizontal scrolling strip under md. */}
        <Box
          component="nav"
          sx={{
            width: { xs: '100%', md: SIDEBAR_W },
            flexShrink: 0,
            position: { xs: 'static', md: 'sticky' },
            top: 64,
            borderRight: { xs: 'none', md: `1px solid ${C.border}` },
            borderBottom: { xs: `1px solid ${C.border}`, md: 'none' },
            bgcolor: C.card,
            minHeight: { md: 'calc(100vh - 64px)' },
            p: 1.5,
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            gap: 0.5,
            overflowX: { xs: 'auto', md: 'visible' },
          }}
        >
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.2,
                    px: 1.75, py: 1.15, borderRadius: 2, whiteSpace: 'nowrap',
                    cursor: 'pointer', transition: 'all 160ms ease',
                    color: isActive ? C.primaryLight : C.textSecondary,
                    bgcolor: isActive ? alpha(C.primary, 0.14) : 'transparent',
                    borderLeft: {
                      xs: 'none',
                      md: `2px solid ${isActive ? C.primary : 'transparent'}`,
                    },
                    '&:hover': {
                      bgcolor: isActive ? alpha(C.primary, 0.18) : C.cardHover,
                      color: isActive ? C.primaryLight : C.text,
                    },
                  }}
                >
                  {item.icon}
                  <Typography sx={{ fontSize: '0.83rem', fontWeight: isActive ? 700 : 600 }}>
                    {item.label}
                  </Typography>
                </Box>
              )}
            </NavLink>
          ))}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default MarketingLayout;
