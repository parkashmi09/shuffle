import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { Person, Groups } from '@mui/icons-material';
import DirectUsersTab from './users/DirectUsersTab';
import AgentSystemTab from './users/AgentSystemTab';
import RiskManagementDialog from './users/RiskManagementDialog';
import StaffRiskDialog from './users/StaffRiskDialog';
import BalanceSheetDialog from './users/BalanceSheetDialog';
import PlayerReportDialog from './users/PlayerReportDialog';
import { roleKey } from '../constants/permissions';

const C = {
  bg: '#0C0D1D', card: '#0E1831', border: '#1E2D55',
  primary: '#886CFF', text: '#F9F9F9', textMuted: '#878AA2',
};

/**
 * Only SuperAdmin / MotherAdmin see the "Direct Users" tab — every other staff
 * role sees the Agent System view scoped to their own downline.
 *
 * Compared through `roleKey`, NOT by exact name. The `roles` table spells the
 * owner's role `Super Admin`, with a space; this list spells it closed-up. The
 * exact-match `Set` therefore never matched anybody, `canSeeDirect` was false
 * for every account including the platform owner, and BOTH TABS DISAPPEARED —
 * the page dropped straight into the Agent System view with no way back to
 * Direct Users. Same bug the sidebar's `GROUP_ACCESS_BY_KEY` already fixed.
 */
const DIRECT_TAB_ROLES = new Set(['SuperAdmin', 'MotherAdmin'].map(roleKey));

const Users: React.FC = () => {
  const userRole = localStorage.getItem('userRole') || 'Guest';
  const canSeeDirect = DIRECT_TAB_ROLES.has(roleKey(userRole));
  const [tab, setTab] = useState<'direct' | 'agent'>(canSeeDirect ? 'direct' : 'agent');
  const [riskUserId, setRiskUserId] = useState<string | null>(null);
  const [riskStaffId, setRiskStaffId] = useState<string | null>(null);
  const [balanceUserId, setBalanceUserId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  // Balance sheet is available to the whole staff hierarchy, but only for users
  // (UsersTable rows) — never for staff/agent rows.
  const openBalanceSheet = setBalanceUserId;
  const openReport = (id: string, name: string) => setReportTarget({ id, name });

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ color: C.text, fontWeight: 800, fontSize: { xs: '1.3rem', sm: '1.5rem' }, lineHeight: 1.2 }}>
          Users
        </Typography>
        <Typography sx={{ color: C.textMuted, fontSize: '0.78rem', mt: 0.25 }}>
          Manage direct users and agent-system accounts with per-user risk controls
        </Typography>
      </Box>

      {canSeeDirect && (
        <Box sx={{ borderBottom: `1px solid ${C.border}`, mb: 2.5 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              minHeight: 42,
              '& .MuiTab-root': {
                color: C.textMuted,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.88rem',
                minHeight: 42,
                gap: 0.75,
                '&.Mui-selected': { color: C.primary },
              },
              '& .MuiTabs-indicator': { bgcolor: C.primary, height: 3, borderRadius: '3px 3px 0 0' },
            }}
          >
            <Tab value="direct" label="Direct Users" icon={<Person sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab value="agent" label="Agent System" icon={<Groups sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
        </Box>
      )}

      {tab === 'direct' && canSeeDirect && <DirectUsersTab onOpenRisk={setRiskUserId} onOpenBalanceSheet={openBalanceSheet} onOpenReport={openReport} />}
      {(tab === 'agent' || !canSeeDirect) && <AgentSystemTab onOpenRisk={setRiskUserId} onOpenStaffRisk={setRiskStaffId} onOpenBalanceSheet={openBalanceSheet} onOpenReport={openReport} />}

      <RiskManagementDialog
        open={riskUserId !== null}
        userId={riskUserId}
        onClose={() => setRiskUserId(null)}
      />

      <StaffRiskDialog
        open={riskStaffId !== null}
        staffId={riskStaffId}
        onClose={() => setRiskStaffId(null)}
      />

      <BalanceSheetDialog
        open={balanceUserId !== null}
        userId={balanceUserId}
        onClose={() => setBalanceUserId(null)}
      />

      <PlayerReportDialog
        open={reportTarget !== null}
        userId={reportTarget?.id ?? null}
        userName={reportTarget?.name ?? null}
        onClose={() => setReportTarget(null)}
      />
    </Box>
  );
};

export default Users;
