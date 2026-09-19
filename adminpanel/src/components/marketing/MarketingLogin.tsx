import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography, Alert, InputAdornment,
  IconButton, CircularProgress, alpha,
} from '@mui/material';
import { Visibility, VisibilityOff, InsightsOutlined, PersonOutline, LockOutlined } from '@mui/icons-material';
import { C } from '../admin-dashboard/shared';
import { marketingLogin, getMarketingToken } from '../../services/marketingApi';

/**
 * Marketing panel sign-in.
 *
 * Note: this intentionally does not carry the STATIC_CREDENTIALS fallback that
 * components/Login.tsx has — every sign-in here goes to the server.
 */
const MarketingLogin: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in — skip the form.
  if (getMarketingToken()) return <Navigate to="/marketing" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }

    setLoading(true);
    try {
      await marketingLogin(username.trim(), password);
      navigate('/marketing', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh', bgcolor: C.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', p: 2,
        backgroundImage: `radial-gradient(circle at 20% 10%, ${alpha(C.primary, 0.14)}, transparent 45%),
                          radial-gradient(circle at 85% 85%, ${alpha('#7B5EF5', 0.12)}, transparent 45%)`,
      }}
    >
      <Paper
        elevation={0}
        component="form"
        onSubmit={submit}
        sx={{
          width: '100%', maxWidth: 420, p: { xs: 3, sm: 4.5 }, borderRadius: 4,
          bgcolor: C.card, border: `1px solid ${C.border}`,
          boxShadow: `0 24px 64px ${alpha('#000', 0.45)}`,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3.5 }}>
          <Box
            sx={{
              width: 56, height: 56, borderRadius: 3, mb: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha(C.primary, 0.15), color: C.primary,
            }}
          >
            <InsightsOutlined sx={{ fontSize: 30 }} />
          </Box>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.4rem' }}>
            Marketing Panel
          </Typography>
          <Typography sx={{ color: C.textSecondary, fontSize: '0.82rem', mt: 0.5 }}>
            Acquisition &amp; deposit analytics
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2.5, borderRadius: 2, bgcolor: alpha(C.error, 0.12),
              color: C.text, border: `1px solid ${alpha(C.error, 0.4)}`,
              '& .MuiAlert-icon': { color: C.error },
            }}
          >
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          disabled={loading}
          sx={{ mb: 2.5 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonOutline sx={{ color: C.textMuted, fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
          sx={{ mb: 3.5 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlined sx={{ color: C.textMuted, fontSize: 20 }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((s) => !s)}
                  edge="end"
                  size="small"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  sx={{ color: C.textMuted }}
                >
                  {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          sx={{
            py: 1.4, borderRadius: 2.5, fontWeight: 700, fontSize: '0.95rem',
            textTransform: 'none', bgcolor: C.primary,
            '&:hover': { bgcolor: C.primaryLight },
          }}
        >
          {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Sign in'}
        </Button>

        <Typography sx={{ color: C.textMuted, fontSize: '0.72rem', textAlign: 'center', mt: 3 }}>
          This panel is read-only. Contact your administrator for access.
        </Typography>
      </Paper>
    </Box>
  );
};

export default MarketingLogin;
