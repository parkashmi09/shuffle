import React, { useMemo, useState } from 'react';
import { Box, Tab, Tabs, alpha } from '@mui/material';
import { PeopleAlt, AccountTree, SportsCricket } from '@mui/icons-material';
import DirectUsersTab from './admin-dashboard/DirectUsersTab';
import AgentSystemTab from './admin-dashboard/AgentSystemTab';
import SportsTab from './admin-dashboard/SportsTab';
import { roleKey } from '../constants/permissions';

const C = {
  card: '#0E1831',
  border: '#1E2D55',
  primary: '#886CFF',
  text: '#F9F9F9',
  textMuted: '#8384A5',
};

type TabKey = 'direct' | 'agent' | 'sports';

/* Roles that see the platform-wide Direct Users tab. Compared through `roleKey`
   because the `roles` table spells them with a space — `Super Admin` — while
   every list in this app spells them closed-up. Same gate as Users.tsx. */
const DIRECT_TAB_ROLES = new Set(['SuperAdmin', 'MotherAdmin'].map(roleKey));

const AdminDashboard: React.FC = () => {
  const isSuperAdmin = useMemo(
    () => DIRECT_TAB_ROLES.has(roleKey(localStorage.getItem('userRole') || '')),
    []
  );
  const [tab, setTab] = useState<TabKey>(isSuperAdmin ? 'direct' : 'agent');

  /* Non-SuperAdmin staff only see Agent System scoped to their downline. */
  if (!isSuperAdmin) {
    return (
      <Box sx={{ minHeight: '100vh' }}>
        <Box
          sx={{
            mb: 3,
            bgcolor: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            px: 1,
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={tab === 'direct' ? 'agent' : tab}
            onChange={(_, v: TabKey) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 52,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 14,
                color: C.textMuted,
                minHeight: 52,
                px: 2.5,
                '&.Mui-selected': { color: C.text, bgcolor: alpha(C.primary, 0.08) },
              },
              '& .MuiTabs-indicator': { height: 3, bgcolor: C.primary, borderRadius: 3 },
            }}
          >
            <Tab value="agent" icon={<AccountTree sx={{ fontSize: 18 }} />} iconPosition="start" label="Agent System" />
            <Tab value="sports" icon={<SportsCricket sx={{ fontSize: 18 }} />} iconPosition="start" label="Sports" />
          </Tabs>
        </Box>
        {tab === 'sports' ? <SportsTab /> : <AgentSystemTab />}
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Box
        sx={{
          mb: 3,
          bgcolor: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 3,
          px: 1,
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v: TabKey) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 52,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 14,
              color: C.textMuted,
              minHeight: 52,
              px: 2.5,
              '&.Mui-selected': { color: C.text, bgcolor: alpha(C.primary, 0.08) },
            },
            '& .MuiTabs-indicator': { height: 3, bgcolor: C.primary, borderRadius: 3 },
          }}
        >
          <Tab value="direct" icon={<PeopleAlt sx={{ fontSize: 18 }} />} iconPosition="start" label="Direct Users" />
          <Tab value="agent" icon={<AccountTree sx={{ fontSize: 18 }} />} iconPosition="start" label="Agent System" />
          <Tab value="sports" icon={<SportsCricket sx={{ fontSize: 18 }} />} iconPosition="start" label="Sports" />
        </Tabs>
      </Box>

      {tab === 'direct' && <DirectUsersTab />}
      {tab === 'agent' && <AgentSystemTab />}
      {tab === 'sports' && <SportsTab />}
    </Box>
  );
};

export default AdminDashboard;
