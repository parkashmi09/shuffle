/* =========================================================================
   WithdrawPage.tsx – Unified withdraw page with tabs for Direct & Agent users
   ========================================================================= */
import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { AccountBalanceWallet, SwapHoriz } from '@mui/icons-material';
import WithdrawSelf from './SelfWithdraw';
import Withdraw from './Withdraw';

const TABS = [
  { id: 'direct', label: 'Direct Users', icon: <AccountBalanceWallet sx={{ fontSize: 16 }} /> },
  { id: 'agent', label: 'Agent Users', icon: <SwapHoriz sx={{ fontSize: 16 }} /> },
];

export default function WithdrawPage() {
  const [tab, setTab] = useState('direct');

  return (
    <Box sx={{ width: '100%' }}>
      {/* Tab bar */}
      <Box sx={{ bgcolor: '#0E1831', borderBottom: '1px solid #1E2D55', overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
        <Box sx={{ display: 'flex' }}>
          {TABS.map(t => (
            <Box
              key={t.id}
              onClick={() => setTab(t.id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 2.5, py: 1.5, whiteSpace: 'nowrap', cursor: 'pointer',
                color: tab === t.id ? '#886CFF' : '#8384A5',
                bgcolor: tab === t.id ? 'rgba(136,108,255,0.08)' : 'transparent',
                borderBottom: tab === t.id ? '2px solid #886CFF' : '2px solid transparent',
                fontSize: '0.8rem', fontWeight: tab === t.id ? 700 : 400,
                transition: 'all 150ms ease',
                '&:hover': { color: tab === t.id ? '#886CFF' : '#F9F9F9', bgcolor: tab === t.id ? 'rgba(136,108,255,0.08)' : '#162140' },
              }}
            >
              {t.icon}
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 'inherit', color: 'inherit' }}>{t.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ bgcolor: '#0C0D1D', minHeight: '80vh' }}>
        {tab === 'direct' && <WithdrawSelf />}
        {tab === 'agent' && <Withdraw />}
      </Box>
    </Box>
  );
}
