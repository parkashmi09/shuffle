import React from 'react';
import { Box, Typography, Alert, alpha } from '@mui/material';
import { C } from '../admin-dashboard/shared';
import CustomerTable from './CustomerTable';

interface Props {
  channel: 'direct' | 'agent';
}

const COPY = {
  direct: {
    title: 'Direct Customers',
    subtitle: 'Customers who registered on the site themselves, with no agent attribution.',
  },
  agent: {
    title: 'Agent Customers',
    subtitle: 'Customers onboarded under an agent referral code, shown with their agent.',
  },
};

const MarketingCustomers: React.FC<Props> = ({ channel }) => {
  const copy = COPY[channel];

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.3rem' }}>
          {copy.title}
        </Typography>
        <Typography sx={{ color: C.textSecondary, fontSize: '0.82rem' }}>
          {copy.subtitle}
        </Typography>
      </Box>

      {/* `country` is not captured at registration anywhere in the signup flow,
          so the Location column falls back to last-seen IP. Flagging it beats
          showing an empty column that looks like a loading bug. */}
      <Alert
        severity="info"
        sx={{
          mb: 2.5, borderRadius: 2, bgcolor: alpha(C.info, 0.09),
          color: C.text, border: `1px solid ${alpha(C.info, 0.28)}`,
          '& .MuiAlert-icon': { color: C.info },
        }}
      >
        Country is not collected during registration, so Location shows the customer’s
        last-seen IP address instead.
      </Alert>

      <CustomerTable
        query={{ channel }}
        showAgent={channel === 'agent'}
        pageSize={25}
      />
    </Box>
  );
};

export default MarketingCustomers;
