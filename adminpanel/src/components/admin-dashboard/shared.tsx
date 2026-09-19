import React from 'react';
import { Avatar, Box, Chip, Paper, Skeleton, Typography, alpha } from '@mui/material';
import { ArrowDownward, ArrowForward, ArrowUpward } from '@mui/icons-material';

export const C = {
  bg: '#0C0D1D', card: '#0E1831', cardLight: '#121E38', cardHover: '#162140',
  border: '#1E2D55', primary: '#886CFF', primaryLight: '#9B82FF',
  text: '#F9F9F9', textMuted: '#878AA2', textSecondary: '#8384A5',
  success: '#0ECC68', error: '#E01B4F', warning: '#FFC23F', info: '#A08FFF',
};

export const CHART_COLORS = ['#886CFF', '#A08FFF', '#7B5EF5', '#0ECC68', '#FFC23F', '#E01B4F', '#9B82FF', '#8384A5'];

export interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string;
  subtitle: string;
  change?: number;
  loading: boolean;
  /** When set, the card becomes an activatable control that drills into the
   *  underlying records. Omitted on existing dashboards, which stay static. */
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, iconBg, title, value, subtitle, change, loading, onClick }) => {
  const showChange = typeof change === 'number';
  const isPositive = (change ?? 0) >= 0;
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      // Keyboard-reachable only when it actually does something.
      {...(onClick ? {
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
        },
      } : {})}
      sx={{
        p: 2.5, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}`,
        transition: 'all 200ms ease', position: 'relative', overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        '&:focus-visible': { outline: `2px solid ${C.primary}`, outlineOffset: 2 },
        '&:hover': { borderColor: C.primary, transform: 'translateY(-2px)', boxShadow: `0 8px 32px ${alpha(C.primary, 0.15)}` },
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${iconBg}, ${alpha(iconBg, 0.3)})`,
        },
      }}
    >
      {loading ? (
        <Box>
          <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: C.cardHover }} />
          <Skeleton width="60%" sx={{ mt: 1.5, bgcolor: C.cardHover }} />
          <Skeleton width="40%" sx={{ bgcolor: C.cardHover }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha(iconBg, 0.15), color: iconBg, width: 44, height: 44 }}>
              {icon}
            </Avatar>
            {showChange && (
              <Chip
                size="small"
                icon={isPositive ? <ArrowUpward sx={{ fontSize: 14 }} /> : <ArrowDownward sx={{ fontSize: 14 }} />}
                label={`${isPositive ? '+' : ''}${(change as number).toFixed(1)}%`}
                sx={{
                  bgcolor: alpha(isPositive ? C.success : C.error, 0.15),
                  color: isPositive ? C.success : C.error,
                  fontWeight: 700, fontSize: '0.7rem', height: 24,
                  '& .MuiChip-icon': { color: 'inherit', fontSize: 14 },
                }}
              />
            )}
          </Box>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.65rem', lineHeight: 1.1, mb: 0.25 }}>
            {value}
          </Typography>
          <Typography sx={{ color: C.textMuted, fontSize: '0.78rem', fontWeight: 500 }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 0.5 }}>
            <Typography sx={{ color: C.textSecondary, fontSize: '0.7rem' }}>{subtitle}</Typography>
            <ArrowForward sx={{ fontSize: 12, color: C.textSecondary }} />
          </Box>
        </>
      )}
    </Paper>
  );
};

export const ChartCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; height?: number }> = ({ title, icon, children, height = 280 }) => (
  <Paper
    elevation={0}
    sx={{
      p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}`,
      transition: 'border-color 200ms', '&:hover': { borderColor: alpha(C.primary, 0.4) },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ bgcolor: alpha(C.primary, 0.12), color: C.primary, width: 32, height: 32 }}>
          {icon}
        </Avatar>
        <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>{title}</Typography>
      </Box>
    </Box>
    <Box sx={{ height }}>{children}</Box>
  </Paper>
);

export const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Paper sx={{ bgcolor: C.cardLight, border: `1px solid ${C.border}`, p: 1.5, borderRadius: 2 }}>
      <Typography sx={{ color: C.textMuted, fontSize: '0.7rem', mb: 0.5 }}>{label}</Typography>
      {payload.map((entry: any, i: number) => (
        <Typography key={i} sx={{ color: entry.color, fontSize: '0.8rem', fontWeight: 700 }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </Typography>
      ))}
    </Paper>
  );
};

export const fmtCurrency = (v: string | number | undefined) =>
  parseFloat(String(v || '0')).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Money in the currency the API says it converted to — NOT a fixed symbol.
 *
 * The dashboard converts every source currency through `exchangerate.usd_rate`
 * and reports `valuation.currency`. Rendering those figures with a hardcoded ₹
 * relabels dollars as rupees, which is a wrong number rather than a wrong font.
 */
export const fmtMoney = (v: string | number | null | undefined, currency = 'USD') => {
  const n = parseFloat(String(v ?? '0'));
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const fmtInr = (v: number | string | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (v: number) => v.toLocaleString('en-US');

export const pct = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

export const isToday = (iso: string) => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
