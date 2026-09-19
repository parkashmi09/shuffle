import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  BarChart,
  ListAlt,
  PersonAdd,
  AccountCircle,
  AdminPanelSettings,
  Insights,
  Shield,
} from '@mui/icons-material';
import { NavLink, Outlet } from 'react-router-dom';

/**
 * The admin-management shell: a tab strip and an outlet.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS REMOVED FROM THIS FILE, AND WHY
 *
 * It also carried a `UserManagementTab` component and a `SAMPLE_ADMINS` array
 * holding three fabricated staff records with PLAINTEXT PASSWORDS
 * (`Admin@123`, `SubAdmin@123`, `User@123`), which it wrote into
 * `localStorage` under `adminUsers` on mount.
 *
 * That component was never exported and never rendered — the routed screen is
 * `./admin-management/UserManagementTab`, which talks to the real staff API.
 * The dead copy still mattered for two reasons: its passwords were compiled
 * into the shipped bundle, and the login page had a fallback that
 * AUTHENTICATED against the `adminUsers` key it seeded. So a mock screen was
 * feeding a real sign-in path, and anyone with devtools could add themselves
 * to that array and be admitted.
 *
 * The login fallback is gone (see `Login.tsx`) and so is the mock. What
 * remains is the layout, which is all this file was ever used for.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ICON_SX = { fontSize: 16 };

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart sx={ICON_SX} /> },
  { id: 'agents', label: 'Agent Listing', icon: <ListAlt sx={ICON_SX} /> },
  { id: 'staff-portal', label: 'Staff Portal', icon: <PersonAdd sx={ICON_SX} /> },
  { id: 'myaccount', label: 'My Account', icon: <AccountCircle sx={ICON_SX} /> },
  { id: 'access', label: 'Executives', icon: <AdminPanelSettings sx={ICON_SX} /> },
  { id: 'marketing-users', label: 'Marketing', icon: <Insights sx={ICON_SX} /> },
  /**
   * Second-factor enrolment.
   *
   * Reachable from the tab strip rather than buried in settings, because the
   * backend refuses a session to any account at level 3 or above that has not
   * enrolled. An operator who hits that wall needs to find this screen without
   * being told where it is.
   */
  { id: 'security', label: 'Security', icon: <Shield sx={ICON_SX} /> },
];

const AdminManagementLayout = () => (
  <Box sx={{ width: '100%' }}>
    <Box
      sx={{
        bgcolor: '#0E1831',
        borderBottom: '1px solid #1E2D55',
        overflowX: 'auto',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Box sx={{ display: 'flex' }}>
        {tabs.map((tab) => (
          <NavLink key={tab.id} to={tab.id} end style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 2.5,
                  py: 1.5,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  color: isActive ? '#886CFF' : '#8384A5',
                  bgcolor: isActive ? 'rgba(136,108,255,0.08)' : 'transparent',
                  borderBottom: isActive ? '2px solid #886CFF' : '2px solid transparent',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 400,
                  transition: 'all 150ms ease',
                  '&:hover': {
                    color: isActive ? '#886CFF' : '#F9F9F9',
                    bgcolor: isActive ? 'rgba(136,108,255,0.08)' : '#162140',
                  },
                }}
              >
                {tab.icon}
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 'inherit', color: 'inherit' }}>
                  {tab.label}
                </Typography>
              </Box>
            )}
          </NavLink>
        ))}
      </Box>
    </Box>

    <Box sx={{ bgcolor: '#0C0D1D', minHeight: '100vh' }}>
      <Outlet />
    </Box>
  </Box>
);

export default AdminManagementLayout;
