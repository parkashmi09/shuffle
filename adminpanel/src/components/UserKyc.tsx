import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Chip,
  Avatar,
  Button,
  IconButton,
  Divider,
  Skeleton,
  TextField,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Person,
  LocationOn,
  Badge as BadgeIcon,
  Refresh,
  AssignmentInd,
  ImageNotSupported,
  TaskAlt,
  Block,
} from '@mui/icons-material';
import { ENDPOINTS } from '../services/endpoints';
import { api, apiFetchPage, apiDownload, buildPath } from '../utils/api';

type DocumentField = 'idFront' | 'idBack' | 'passport';

interface KycApplication {
  id: number;
  userId: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  city: string;
  country: string;
  documentType: string;
  /** Which documents EXIST — the service never returns filesystem paths. */
  documents: Record<DocumentField, boolean>;
  status: 'Pending' | 'Verified' | 'Rejected';
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
}

/**
 * KYC review. `PUT /kyc/update-status` took the decision and the target from an
 * unauthenticated body; the reviewer comes from the staff token now.
 *
 * The listing filters client-side, so it asks for one page at the validator's
 * ceiling. Beyond 200 open applications the tabs under-count.
 */
const PAGE_LIMIT = 200;

const STATUS_CONFIG = {
  Pending:  { color: '#FFC23F', bg: 'rgba(255,194,63,0.12)',  border: 'rgba(255,194,63,0.3)',  icon: <HourglassEmpty sx={{ fontSize: 14 }} /> },
  Verified: { color: '#0ECC68', bg: 'rgba(14,204,104,0.12)', border: 'rgba(14,204,104,0.3)', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  Rejected: { color: '#E01B4F', bg: 'rgba(224,27,79,0.12)',  border: 'rgba(224,27,79,0.3)',  icon: <Cancel sx={{ fontSize: 14 }} /> },
};

const FILTERS = ['All', 'Pending', 'Verified', 'Rejected'] as const;

/**
 * Load one identity document.
 *
 * It cannot be an `<img src>` any more. The document route is staff-only and
 * the browser sends no Authorization header on an image request, so the tag
 * would render a 401 body. It is fetched as a blob and shown from an object
 * URL, which is revoked when the tile goes away — the response is
 * `no-store, private` and there is no reason to keep the scan alive longer.
 */
function useDocument(kycId?: number, field?: DocumentField, available?: boolean) {
  const [src, setSrc] = useState<string | undefined>();

  useEffect(() => {
    if (!kycId || !field || !available) {
      setSrc(undefined);
      return undefined;
    }

    let url: string | undefined;
    let cancelled = false;

    apiDownload(buildPath(ENDPOINTS.kyc.document, { kycId, field }))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => { if (!cancelled) setSrc(undefined); });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [kycId, field, available]);

  return src;
}

const avatarColor = (name: string) => {
  const colors = ['#886CFF', '#7B5EF5', '#0ECC68', '#FFC23F'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

/* ── Doc image tile ── */
const DocImage: React.FC<{ kycId?: number; field: DocumentField; available?: boolean; label: string }> = ({
  kycId,
  field,
  available,
  label,
}) => {
  const src = useDocument(kycId, field, available);

  return (
  <Box>
    <Typography sx={{ color: '#8384A5', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
      {label}
    </Typography>
    {src ? (
      <Box
        component="img"
        src={src}
        alt={label}
        sx={{
          width: '100%',
          height: 160,
          objectFit: 'contain',
          borderRadius: 1.5,
          border: '1px solid #1E2D55',
          bgcolor: '#0C0D1D',
        }}
        onError={(e: any) => { e.target.style.display = 'none'; }}
      />
    ) : (
      <Box sx={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#0C0D1D', borderRadius: 1.5, border: '1px dashed #1E2D55', gap: 1 }}>
        <ImageNotSupported sx={{ color: '#1E2D55', fontSize: 32 }} />
        <Typography sx={{ color: '#8384A5', fontSize: '0.72rem' }}>No image</Typography>
      </Box>
    )}
  </Box>
  );
};

/* ── Info row ── */
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
    <Typography sx={{ color: '#8384A5', fontSize: '0.78rem' }}>{label}</Typography>
    <Typography sx={{ color: '#F9F9F9', fontSize: '0.78rem', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</Typography>
  </Box>
);

const Kyc: React.FC = () => {
  const [applications, setApplications] = useState<KycApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<KycApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('Pending');

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data } = await apiFetchPage<KycApplication>(ENDPOINTS.kyc.applications, {
        query: { limit: PAGE_LIMIT },
      });
      setApplications(data);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    const iv = setInterval(fetchApplications, 120000);
    return () => clearInterval(iv);
  }, []);

  const updateStatus = async (userId: string, status: 'Verified' | 'Rejected') => {
    setActionLoading(true);
    try {
      await api.put(ENDPOINTS.kyc.review, {
        userId: Number(userId),
        status,
        // `.strict()` on the validator — the key is omitted, not sent as null.
        ...(status === 'Rejected' ? { rejectionReason } : {}),
      });
      setApplications(prev =>
        prev.map(a => a.userId === userId ? { ...a, status, rejectionReason: status === 'Rejected' ? rejectionReason : undefined } : a)
      );
      setSelectedApp(prev => prev?.userId === userId ? { ...prev, status, rejectionReason: status === 'Rejected' ? rejectionReason : undefined } : prev);
      setRejectionReason('');
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = applications.filter(a => filter === 'All' || a.status === filter);
  const counts = {
    All: applications.length,
    Pending:  applications.filter(a => a.status === 'Pending').length,
    Verified: applications.filter(a => a.status === 'Verified').length,
    Rejected: applications.filter(a => a.status === 'Rejected').length,
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Stat chips row ── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const cfg = f === 'All' ? { color: '#886CFF', bg: 'rgba(136,108,255,0.12)', border: 'rgba(136,108,255,0.3)' } : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG];
          return (
            <Box
              key={f}
              onClick={() => setFilter(f)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                bgcolor: filter === f ? cfg.bg : '#0E1831',
                border: `1px solid ${filter === f ? cfg.border : '#1E2D55'}`,
                borderRadius: 2, px: 2, py: 1, cursor: 'pointer',
                transition: 'all 150ms ease',
                '&:hover': { borderColor: cfg.border, bgcolor: cfg.bg },
              }}
            >
              <Typography sx={{ color: filter === f ? cfg.color : '#8384A5', fontSize: '0.78rem', fontWeight: 700 }}>
                {f}
              </Typography>
              <Box sx={{ bgcolor: filter === f ? cfg.color : '#1E2D55', color: filter === f ? '#0C0D1D' : '#8384A5', borderRadius: 10, px: 0.75, fontSize: '0.65rem', fontWeight: 800, minWidth: 18, textAlign: 'center' }}>
                {counts[f]}
              </Box>
            </Box>
          );
        })}
        <Tooltip title="Refresh">
          <IconButton onClick={fetchApplications} sx={{ ml: 'auto', color: '#8384A5', border: '1px solid #1E2D55', borderRadius: 1.5, '&:hover': { color: '#886CFF', borderColor: '#886CFF' } }}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Main layout ── */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>

        {/* ── Left: applications list ── */}
        <Card sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0, bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1E2D55' }}>
            <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '0.9rem' }}>
              Applications
              <Typography component="span" sx={{ ml: 1, color: '#8384A5', fontWeight: 400, fontSize: '0.78rem' }}>
                ({filtered.length})
              </Typography>
            </Typography>
          </Box>

          <Box sx={{ maxHeight: 520, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#1E2D55', borderRadius: 2 } }}>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Box key={i} sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1E2D5533', display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Skeleton variant="circular" width={36} height={36} sx={{ bgcolor: '#1E2D55', flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="70%" sx={{ bgcolor: '#1E2D55' }} />
                      <Skeleton variant="text" width="50%" sx={{ bgcolor: '#1E2D55' }} />
                    </Box>
                  </Box>
                ))
              : filtered.length === 0
              ? (
                <Box sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <AssignmentInd sx={{ color: '#1E2D55', fontSize: 36 }} />
                  <Typography sx={{ color: '#8384A5', fontSize: '0.8rem' }}>No {filter !== 'All' ? filter.toLowerCase() : ''} applications</Typography>
                </Box>
              )
              : filtered.map(app => {
                  const cfg = STATUS_CONFIG[app.status];
                  const isSelected = selectedApp?.id === app.id;
                  const name = `${app.firstName} ${app.lastName}`;
                  return (
                    <Box
                      key={app.id}
                      onClick={() => { setSelectedApp(app); setRejectionReason(''); }}
                      sx={{
                        px: 2, py: 1.5,
                        borderBottom: '1px solid #1E2D5533',
                        cursor: 'pointer',
                        bgcolor: isSelected ? 'rgba(136,108,255,0.08)' : 'transparent',
                        borderLeft: isSelected ? '3px solid #886CFF' : '3px solid transparent',
                        transition: 'all 150ms ease',
                        '&:hover': { bgcolor: isSelected ? 'rgba(136,108,255,0.1)' : '#121E38' },
                        display: 'flex', alignItems: 'center', gap: 1.5,
                      }}
                    >
                      <Avatar sx={{ width: 34, height: 34, fontSize: '0.72rem', fontWeight: 700, bgcolor: avatarColor(name), flexShrink: 0 }}>
                        {name.slice(0, 2).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ color: '#F9F9F9', fontSize: '0.82rem', fontWeight: 600 }}>
                          {name}
                        </Typography>
                        <Typography noWrap sx={{ color: '#8384A5', fontSize: '0.68rem' }}>
                          {app.userId}
                        </Typography>
                      </Box>
                      <Chip
                        label={app.status}
                        size="small"
                        sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.65rem', height: 20, border: `1px solid ${cfg.border}`, flexShrink: 0 }}
                      />
                    </Box>
                  );
                })}
          </Box>
        </Card>

        {/* ── Right: application detail ── */}
        <Card sx={{ flex: 1, minWidth: 0, bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 }}>
          {!selectedApp ? (
            <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <AssignmentInd sx={{ fontSize: 48, color: '#1E2D55' }} />
              <Typography sx={{ color: '#F9F9F9', fontWeight: 600 }}>No Application Selected</Typography>
              <Typography sx={{ color: '#8384A5', fontSize: '0.82rem' }}>Select an application from the list to review</Typography>
            </Box>
          ) : (
            <>
              {/* Detail header */}
              <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid #1E2D55', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Avatar sx={{ width: 38, height: 38, fontSize: '0.85rem', fontWeight: 700, bgcolor: avatarColor(`${selectedApp.firstName} ${selectedApp.lastName}`) }}>
                  {`${selectedApp.firstName} ${selectedApp.lastName}`.slice(0, 2).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '0.95rem' }}>
                    {selectedApp.firstName} {selectedApp.lastName}
                  </Typography>
                  <Typography sx={{ color: '#8384A5', fontSize: '0.72rem' }}>
                    Submitted {new Date(selectedApp.submittedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Typography>
                </Box>
                {(() => {
                  const cfg = STATUS_CONFIG[selectedApp.status];
                  return (
                    <Chip
                      icon={cfg.icon}
                      label={selectedApp.status}
                      size="small"
                      sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.75rem', border: `1px solid ${cfg.border}`, '& .MuiChip-icon': { color: cfg.color } }}
                    />
                  );
                })()}
              </Box>

              <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {/* Personal Info */}
                <Box sx={{ bgcolor: '#0C0D1D', border: '1px solid #1E2D55', borderRadius: 2, p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Person sx={{ color: '#886CFF', fontSize: 16 }} />
                    <Typography sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Personal Information
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: '#1E2D55', mb: 1.5 }} />
                  <InfoRow label="Full Name" value={`${selectedApp.firstName} ${selectedApp.lastName}`} />
                  <InfoRow label="Gender" value={selectedApp.gender} />
                  <InfoRow label="Date of Birth" value={new Date(selectedApp.dateOfBirth).toLocaleDateString()} />
                  <InfoRow label="Document Type" value={selectedApp.documentType.toUpperCase()} />
                </Box>

                {/* Address */}
                <Box sx={{ bgcolor: '#0C0D1D', border: '1px solid #1E2D55', borderRadius: 2, p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <LocationOn sx={{ color: '#7B5EF5', fontSize: 16 }} />
                    <Typography sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Address
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: '#1E2D55', mb: 1.5 }} />
                  <InfoRow label="Address" value={selectedApp.address} />
                  <InfoRow label="City" value={selectedApp.city} />
                  <InfoRow label="Country" value={selectedApp.country} />
                  <InfoRow label="User ID" value={selectedApp.userId} />
                </Box>

                {/* Documents */}
                <Box sx={{ bgcolor: '#0C0D1D', border: '1px solid #1E2D55', borderRadius: 2, p: 2, gridColumn: { xs: '1', sm: '1 / -1' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <BadgeIcon sx={{ color: '#FFC23F', fontSize: 16 }} />
                    <Typography sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Document Verification
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: '#1E2D55', mb: 1.5 }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: selectedApp.documentType === 'idcard' ? '1fr 1fr' : '1fr', gap: 2 }}>
                    {selectedApp.documentType === 'idcard' ? (
                      <>
                        <DocImage kycId={selectedApp.id} field="idFront" available={selectedApp.documents?.idFront} label="ID Front" />
                        <DocImage kycId={selectedApp.id} field="idBack" available={selectedApp.documents?.idBack} label="ID Back" />
                      </>
                    ) : (
                      <DocImage kycId={selectedApp.id} field="passport" available={selectedApp.documents?.passport} label="Passport" />
                    )}
                  </Box>
                </Box>

                {/* Rejection reason (if already rejected) */}
                {selectedApp.status === 'Rejected' && selectedApp.rejectionReason && (
                  <Box sx={{ bgcolor: 'rgba(224,27,79,0.08)', border: '1px solid rgba(224,27,79,0.3)', borderRadius: 2, p: 2, gridColumn: { xs: '1', sm: '1 / -1' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Block sx={{ color: '#E01B4F', fontSize: 16 }} />
                      <Typography sx={{ color: '#E01B4F', fontSize: '0.78rem', fontWeight: 700 }}>Rejection Reason</Typography>
                    </Box>
                    <Typography sx={{ color: '#F9F9F9', fontSize: '0.82rem' }}>{selectedApp.rejectionReason}</Typography>
                  </Box>
                )}

                {/* Action area (only for Pending) */}
                {selectedApp.status === 'Pending' && (
                  <Box sx={{ bgcolor: '#0C0D1D', border: '1px solid #1E2D55', borderRadius: 2, p: 2, gridColumn: { xs: '1', sm: '1 / -1' } }}>
                    <Typography sx={{ color: '#8384A5', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1.5 }}>
                      Review Decision
                    </Typography>
                    <TextField
                      multiline
                      rows={3}
                      fullWidth
                      placeholder="Rejection reason (required if rejecting)…"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#0E1831',
                          borderRadius: 1.5,
                          fontSize: '0.85rem',
                          color: '#F9F9F9',
                          '& fieldset': { borderColor: '#1E2D55' },
                          '&:hover fieldset': { borderColor: '#886CFF' },
                          '&.Mui-focused fieldset': { borderColor: '#886CFF' },
                        },
                        '& textarea': { color: '#F9F9F9' },
                        '& textarea::placeholder': { color: '#8384A5' },
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        startIcon={actionLoading ? <CircularProgress size={14} /> : <Block />}
                        disabled={!rejectionReason.trim() || actionLoading}
                        onClick={() => updateStatus(selectedApp.userId, 'Rejected')}
                        sx={{
                          borderColor: 'rgba(224,27,79,0.4)',
                          color: '#E01B4F',
                          '&:hover': { borderColor: '#E01B4F', bgcolor: 'rgba(224,27,79,0.08)' },
                          '&.Mui-disabled': { borderColor: '#1E2D55', color: '#1E2D55' },
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={actionLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <TaskAlt />}
                        disabled={actionLoading}
                        onClick={() => updateStatus(selectedApp.userId, 'Verified')}
                        sx={{ bgcolor: '#0ECC68', '&:hover': { bgcolor: '#0BAD58' }, fontWeight: 700 }}
                      >
                        Approve
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Card>
      </Box>
    </Box>
  );
};

export default Kyc;
