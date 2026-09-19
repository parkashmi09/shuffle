import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { Shield } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

interface Props {
  /** Optional explicit page path; defaults to current location.pathname */
  page?: string;
  /** Optional authority key required in addition to (or instead of) page */
  authority?: string;
  children: React.ReactNode;
}

const RequirePermission: React.FC<Props> = ({ page, authority, children }) => {
  const location = useLocation();
  const { pageVisible, can, loading, isSuper } = usePermissions();

  if (isSuper) return <>{children}</>;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: '#886CFF' }} />
      </Box>
    );
  }

  const target = page ?? location.pathname;
  const pageOk = pageVisible(target);
  const authOk = authority ? can(authority) : true;

  if (!pageOk || !authOk) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, gap: 2 }}>
        <Shield size={56} color="#1E2D55" />
        <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '1.1rem' }}>Access Denied</Typography>
        <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>
          You don't have permission to view this page.
        </Typography>
        <Navigate to="/admin-management" replace />
      </Box>
    );
  }

  return <>{children}</>;
};

export default RequirePermission;
