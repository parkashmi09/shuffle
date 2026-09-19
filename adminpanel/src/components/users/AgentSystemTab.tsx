import React, { useEffect, useState } from 'react';
import { Alert, Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { People, Groups } from '@mui/icons-material';
import { apiFetch } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';
import UsersTable, { UsersTableUser } from './UsersTable';
import StaffTable, { StaffRow } from './StaffTable';

interface Props {
  onOpenRisk: (userId: string) => void;
  onOpenStaffRisk: (staffId: string) => void;
  onOpenBalanceSheet?: (userId: string) => void;
  onOpenReport?: (userId: string, userName: string) => void;
}

/** One page of the agent tree. `total` is every player, not just this page. */
interface AgentUsersResponse {
  currency?: string;
  scope?: { isSuperAdmin: boolean; staffId: number | null };
  total?: number;
  users: any[];
  staff: any[];
}

/**
 * The service caps a page at 200. The tables filter and sort client-side, so
 * this asks for the whole ceiling in one go and shows the server's total next
 * to it — a truncated list presented as the complete book is how the legacy
 * version of this screen misled operators with a bare `LIMIT 1000`.
 */
const PAGE_LIMIT = 200;

const C = { border: '#1E2D55', primary: '#886CFF', textMuted: '#878AA2', cardLight: '#121E38' };

const AgentSystemTab: React.FC<Props> = ({ onOpenRisk, onOpenStaffRisk, onOpenBalanceSheet, onOpenReport }) => {
  const [view, setView] = useState<'users' | 'staff'>('users');
  const [users, setUsers] = useState<UsersTableUser[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AgentUsersResponse>(ENDPOINTS.reports.agentUsers, {
        query: { limit: PAGE_LIMIT },
      });
      setTotal(Number(res.total ?? res.users?.length ?? 0));
      setUsers((res.users ?? []).map((u: any) => ({
        id: String(u.id ?? ''),
        name: String(u.name ?? '—'),
        email: String(u.email ?? '—'),
        country: String(u.country ?? ''),
        phone: String(u.phone ?? ''),
        // The service sends exact decimal strings; the table wants numbers.
        total_deposit_inr: Number(u.totalDeposit ?? 0) || 0,
        total_withdrawal_inr: Number(u.totalWithdrawal ?? 0) || 0,
        pnl_inr: Number(u.pnl ?? 0) || 0,
        is_locked: u.isLocked === true,
        sports_betlocked: u.sportsBetlocked === true,
        staff_name: u.staffName ?? null,
        staff_email: u.staffEmail ?? null,
      })));
      setStaff((res.staff ?? []).map((s: any) => ({
        id: String(s.id ?? ''),
        name: String(s.name ?? '—'),
        email: String(s.email ?? '—'),
        country: String(s.country ?? ''),
        phone: String(s.phone ?? ''),
        role_id: Number(s.roleId ?? 0),
        role_name: s.roleName ?? '—',
        role_level: Number(s.roleLevel ?? 0),
        parent_id: s.parentId ? String(s.parentId) : null,
        parent_name: s.parentName ?? null,
        system_locked: s.systemLocked === true,
        sports_betlocked: s.sportsBetlocked === true,
        created_at: s.createdAt,
      })));
    } catch (e: any) {
      setError(e?.message || 'Failed to load agent users');
      setUsers([]);
      setStaff([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}
          sx={{ mb: 2, bgcolor: 'rgba(224,27,79,0.12)', color: '#E01B4F', border: '1px solid rgba(224,27,79,0.3)' }}>
          Failed to load the agent system: {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, v) => { if (v) setView(v); }}
          size="small"
          sx={{
            bgcolor: C.cardLight, borderRadius: 1.5,
            '& .MuiToggleButton-root': {
              color: C.textMuted, textTransform: 'none', border: `1px solid ${C.border}`, px: 2, py: 0.5, fontWeight: 600, fontSize: '0.82rem',
              '&.Mui-selected': { color: '#fff', bgcolor: C.primary, '&:hover': { bgcolor: C.primary } },
              '& svg': { mr: 0.75, fontSize: 16 },
            },
          }}
        >
          <ToggleButton value="users">
            <People />Users ({total > users.length ? `${users.length} of ${total}` : users.length})
          </ToggleButton>
          <ToggleButton value="staff"><Groups />Staff ({staff.length})</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {view === 'users' ? (
        <UsersTable
          users={users}
          loading={loading}
          title="Agent System — Users"
          onRefresh={fetchAll}
          onOpenRisk={onOpenRisk}
          onOpenBalanceSheet={onOpenBalanceSheet}
          onOpenReport={onOpenReport}
          showStaffColumn
        />
      ) : (
        <StaffTable
          staff={staff}
          loading={loading}
          title="Agent System — Downline Staff"
          onRefresh={fetchAll}
          onOpenRisk={onOpenStaffRisk}
        />
      )}
    </Box>
  );
};

export default AgentSystemTab;
