import React, { useEffect, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { apiFetch } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';
import UsersTable, { UsersTableUser } from './UsersTable';

interface Props {
  onOpenRisk: (userId: string) => void;
  onOpenBalanceSheet?: (userId: string) => void;
  onOpenReport?: (userId: string, userName: string) => void;
}

const DirectUsersTab: React.FC<Props> = ({ onOpenRisk, onOpenBalanceSheet, onOpenReport }) => {
  const [users, setUsers] = useState<UsersTableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any>(ENDPOINTS.directory.list);
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
      if (!Array.isArray(arr)) {
        console.warn('[DirectUsersTab] /getUserData returned non-array payload:', data);
      }
      setUsers(arr.map((u: any) => ({
        id: String(u.id ?? ''),
        name: String(u.name ?? '—'),
        email: String(u.email ?? '—'),
        country: String(u.country ?? ''),
        phone: String(u.phone ?? ''),
        total_deposit_inr: Number(u.total_deposit_inr ?? u.total_deposit_usd ?? 0) || 0,
        total_withdrawal_inr: Number(u.total_withdrawal_inr ?? u.total_withdrawal_usd ?? 0) || 0,
        is_locked: u.is_locked === true || u.is_locked === 't',
        sports_betlocked: u.sports_betlocked === true || u.sports_betlocked === 't',
      })).reverse());
    } catch (e: any) {
      console.error('[DirectUsersTab] /getUserData failed:', e);
      setError(e?.message || 'Failed to load direct users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}
          sx={{ mb: 2, bgcolor: 'rgba(224,27,79,0.12)', color: '#E01B4F', border: '1px solid rgba(224,27,79,0.3)' }}>
          /getUserData failed: {error}
        </Alert>
      )}
      <UsersTable
        users={users}
        loading={loading}
        title="Direct Users"
        onRefresh={fetchUsers}
        onOpenRisk={onOpenRisk}
        onOpenBalanceSheet={onOpenBalanceSheet}
        onOpenReport={onOpenReport}
      />
    </Box>
  );
};

export default DirectUsersTab;
