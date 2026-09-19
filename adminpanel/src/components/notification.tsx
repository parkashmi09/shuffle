import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Box,
  Chip,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Fade,
  InputAdornment,
  Grid,
  SelectChangeEvent
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Send as SendIcon,
  People as PeopleIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { apiFetch, apiFetchPage } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

/**
 * One REGISTERED DEVICE, in the shape `GET /notifications/devices` actually
 * answers with.
 *
 * This component was written against legacy `GET /firebase/allToken`, whose
 * envelope was `{success, tokens: [...]}` with `user_id`/`last_used` on each
 * row. The current endpoint answers the platform's standard paginated envelope
 * — `{success, data: [...], meta}` — so `data.tokens` was `undefined`, state
 * became `undefined`, and the first `.map` in the render threw.
 *
 * A player with two devices appears twice; `id` is the DEVICE and `userId` the
 * player, which is what a send is addressed to.
 */
interface Device {
  id: number;
  userId: number;
  /** Null when the owning row has no name on file — never assume a string. */
  name: string | null;
  email: string | null;
  platform: string | null;
  active: boolean;
  /** Masked upstream: identifiable in a support conversation, not usable. */
  token: string;
  registeredAt: string;
}

/** The API's own vocabulary — `NOTIFICATION_TYPES` in the admin service. */
const NOTIFICATION_TYPES = ['general', 'deposit', 'withdrawal', 'bonus', 'bet', 'promotion'] as const;
type NotificationType = (typeof NOTIFICATION_TYPES)[number];

interface NotificationData {
  title: string;
  body: string;
  type: NotificationType;
  extraInfo: string;
}

interface SortConfig {
  key: 'name' | 'email' | 'platform' | 'registeredAt';
  direction: 'asc' | 'desc';
}

/** The list endpoint's ceiling — `limit` is validated `max(200)`. */
const PAGE_SIZE = 200;

/** Sortable text, with a null owner sorting last rather than as "null". */
const text = (value: string | null | undefined): string => value ?? '';

interface SendResult {
  recorded?: number;
  delivered?: number;
  devices?: number;
  players?: number;
}

function formatSendSuccess(result: SendResult, isBulk: boolean, targetLabel: string): string {
  const recorded = Number(result?.recorded ?? 0);
  const delivered = Number(result?.delivered ?? 0);
  const devices = Number(result?.devices ?? 0);
  const pushNote =
    devices > 0
      ? ` Push reached ${delivered}/${devices} device${devices === 1 ? '' : 's'}.`
      : ' No push devices registered — players still see it in the site notification panel.';

  if (isBulk) {
    const players = Number(result?.players ?? recorded);
    return `Saved to ${recorded} player inbox${recorded === 1 ? '' : 'es'} (${players} in your tree).${pushNote}`;
  }

  return `Saved for ${targetLabel} (${recorded} inbox).${pushNote}`;
}

const Notification: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'name',
    direction: 'asc'
  });

  const [notificationData, setNotificationData] = useState<NotificationData>({
    title: '',
    body: '',
    type: 'general',
    extraInfo: ''
  });

  const fetchDevices = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      /**
       * `GET /firebase/allToken` returned every FCM token on the platform to
       * anyone who asked — which is enough to push to those devices through
       * Firebase directly, without going through this API at all. This one is
       * scoped to the caller's tree, paged, and the token comes back masked.
       */
      const { data, pagination } = await apiFetchPage<Device>(ENDPOINTS.notifications.devices, {
        query: { limit: PAGE_SIZE, offset: 0, activeOnly: true }
      });
      // `apiFetchPage` guarantees an array, so state can never become
      // `undefined` and take the render down with it.
      setDevices(data);
      setFilteredDevices(data);
      setTotal(pagination?.total ?? data.length);
    } catch (err) {
      setDevices([]);
      setFilteredDevices([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Failed to load registered devices');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    let result = [...devices];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      // `name` and `email` are nullable on the wire — a bare `.toLowerCase()`
      // here is the same crash in a different place.
      result = result.filter(device =>
        text(device.name).toLowerCase().includes(query) ||
        text(device.email).toLowerCase().includes(query) ||
        String(device.userId).includes(query)
      );
    }

    if (platformFilter !== 'all') {
      result = result.filter(device => text(device.platform) === platformFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortConfig.key === 'registeredAt') {
        comparison = new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
      } else {
        comparison = text(a[sortConfig.key]).localeCompare(text(b[sortConfig.key]));
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    setFilteredDevices(result);
  }, [devices, searchQuery, platformFilter, sortConfig]);

  const handleSort = (key: SortConfig['key']): void => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const handleSendNotification = async (isBulk: boolean = false): Promise<void> => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = isBulk
        /**
         * `POST /firebase/send-bulk` had NO MIDDLEWARE: anyone reaching the
         * port could push a message of their own writing to every registered
         * device on the platform, from the operator's own app, carrying its
         * icon and its name. A broadcast reaches the caller's tree now.
         */
        ? ENDPOINTS.notifications.broadcast
        : ENDPOINTS.notifications.send;

      /**
       * Both bodies are validated `.strict()`, so an unexpected key is a 400 —
       * `body` and `data` are omitted when empty rather than sent blank, and a
       * broadcast carries no recipient at all (it reaches the caller's tree by
       * definition).
       */
      const payload = {
        ...(isBulk ? {} : { userId: selectedDevice?.userId }),
        title: notificationData.title.trim(),
        ...(notificationData.body.trim() ? { body: notificationData.body.trim() } : {}),
        type: notificationData.type,
        ...(notificationData.extraInfo.trim()
          ? { data: { extraInfo: notificationData.extraInfo.trim() } }
          : {})
      };

      // `apiFetch` carries the staff token and throws an `ApiError` carrying
      // the server's own message — this used to post with no Authorization
      // header at all, which the route rejects.
      const result = await apiFetch<SendResult>(endpoint, {
        method: 'POST',
        body: payload
      });

      setSuccess(
        formatSendSuccess(
          result,
          isBulk,
          text(selectedDevice?.name) || `user ${selectedDevice?.userId}`
        )
      );
      setShowModal(false);
      setNotificationData({ title: '', body: '', type: 'general', extraInfo: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification');
    }
    setLoading(false);
  };

  const handlePlatformChange = (event: SelectChangeEvent): void => {
    setPlatformFilter(event.target.value);
  };

  const handleNotificationTypeChange = (event: SelectChangeEvent): void => {
    setNotificationData({
      ...notificationData,
      type: event.target.value as NotificationType
    });
  };

  const platforms: string[] = [
    'all',
    ...Array.from(new Set(devices.map(device => text(device.platform)).filter(Boolean)))
  ];

  return (
    <div className="p-2">
      <Box sx={{ p: 3, maxWidth: '1200px', margin: '0 auto' }}>
        <Fade in timeout={1000}>
          <Card elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                    Notification Dashboard
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {total} registered {total === 1 ? 'device' : 'devices'}
                    {total > PAGE_SIZE ? ` — showing the most recent ${PAGE_SIZE}` : ''}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchDevices}
                  disabled={loading}
                >
                  Refresh Devices
                </Button>
              </Box>

              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    placeholder="Search by name, email or user id"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      endAdornment: searchQuery ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setSearchQuery('')}>
                            <ClearIcon />
                          </IconButton>
                        </InputAdornment>
                      ) : null
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Platform Filter</InputLabel>
                    <Select
                      value={platformFilter}
                      label="Platform Filter"
                      onChange={handlePlatformChange}
                      startAdornment={
                        <InputAdornment position="start">
                          <FilterIcon />
                        </InputAdornment>
                      }
                    >
                      {platforms.map(platform => (
                        <MenuItem key={platform} value={platform}>
                          {platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={<PeopleIcon />}
                    onClick={() => {
                      setSelectedDevice(null);
                      setShowModal(true);
                    }}
                    sx={{
                      height: '56px',
                      transition: 'all 0.3s ease',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}
                  >
                    Send Bulk Notification
                  </Button>
                </Grid>
              </Grid>

              {error && (
                <Fade in>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                </Fade>
              )}

              {success && (
                <Fade in>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {success}
                  </Alert>
                </Fade>
              )}

              <Fade in timeout={500}>
                <TableContainer
                  component={Paper}
                  elevation={2}
                  sx={{
                    transition: 'all 0.3s ease',
                    '&:hover': { transform: 'translateY(-2px)' }
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white' }}>
                          <TableSortLabel
                            active={sortConfig.key === 'name'}
                            direction={sortConfig.key === 'name' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('name')}
                            sx={{ '&.MuiTableSortLabel-root': { color: 'white' } }}
                          >
                            User
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ color: 'white' }}>
                          <TableSortLabel
                            active={sortConfig.key === 'email'}
                            direction={sortConfig.key === 'email' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('email')}
                            sx={{ '&.MuiTableSortLabel-root': { color: 'white' } }}
                          >
                            Email
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ color: 'white' }}>
                          <TableSortLabel
                            active={sortConfig.key === 'platform'}
                            direction={sortConfig.key === 'platform' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('platform')}
                            sx={{ '&.MuiTableSortLabel-root': { color: 'white' } }}
                          >
                            Platform
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ color: 'white' }}>
                          <TableSortLabel
                            active={sortConfig.key === 'registeredAt'}
                            direction={sortConfig.key === 'registeredAt' ? sortConfig.direction : 'asc'}
                            onClick={() => handleSort('registeredAt')}
                            sx={{ '&.MuiTableSortLabel-root': { color: 'white' } }}
                          >
                            Registered
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ color: 'white' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredDevices.map((device) => (
                        <TableRow
                          key={device.id}
                          hover
                          sx={{
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: 'action.hover',
                              transform: 'scale(1.01)'
                            }
                          }}
                        >
                          <TableCell>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {device.name || `User #${device.userId}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {device.token}
                            </Typography>
                          </TableCell>
                          <TableCell>{device.email || '—'}</TableCell>
                          <TableCell>
                            <Chip
                              label={device.platform || 'unknown'}
                              color={device.active ? 'primary' : 'default'}
                              variant="outlined"
                              size="small"
                              sx={{
                                transition: 'all 0.2s ease',
                                '&:hover': { transform: 'scale(1.1)' }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(device.registeredAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<SendIcon />}
                              onClick={() => {
                                setSelectedDevice(device);
                                setShowModal(true);
                              }}
                              sx={{
                                transition: 'all 0.2s ease',
                                '&:hover': { transform: 'translateX(2px)' }
                              }}
                            >
                              Send
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Fade>
            </CardContent>
          </Card>
        </Fade>

        <Dialog
          open={showModal}
          onClose={() => setShowModal(false)}
          maxWidth="sm"
          fullWidth
          TransitionComponent={Fade}
          transitionDuration={300}
        >
          <DialogTitle>
            {selectedDevice
              ? `Send Notification to ${selectedDevice.name || `User #${selectedDevice.userId}`}`
              : 'Send Bulk Notification'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <TextField
                label="Title"
                fullWidth
                value={notificationData.title}
                onChange={(e) =>
                  setNotificationData({ ...notificationData, title: e.target.value })
                }
                variant="outlined"
              />
              <TextField
                label="Message"
                fullWidth
                multiline
                rows={4}
                value={notificationData.body}
                onChange={(e) =>
                  setNotificationData({ ...notificationData, body: e.target.value })
                }
                variant="outlined"
              />
              <FormControl fullWidth>
                <InputLabel>Notification Type</InputLabel>
                <Select
                  value={notificationData.type}
                  label="Notification Type"
                  onChange={handleNotificationTypeChange}
                >
                  {/* The app ROUTES on this — it is not a severity colour. */}
                  {NOTIFICATION_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Additional Information"
                fullWidth
                value={notificationData.extraInfo}
                onChange={(e) =>
                  setNotificationData({ ...notificationData, extraInfo: e.target.value })
                }
                variant="outlined"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button
              onClick={() => setShowModal(false)}
              color="inherit"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => handleSendNotification(!selectedDevice)}
              // The API requires a title; refusing here beats a 400 round-trip.
              disabled={loading || !notificationData.title.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              sx={{
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'translateX(2px)' }
              }}
            >
              {loading ? 'Sending...' : 'Send Notification'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!error || !!success}
          autoHideDuration={6000}
          onClose={() => {
            setError('');
            setSuccess('');
          }}
          TransitionComponent={Fade}
          sx={{
            '& .MuiSnackbarContent-root': {
              transition: 'all 0.3s ease',
              '&:hover': { transform: 'scale(1.02)' }
            }
          }}
        >
          <Alert
            severity={error ? 'error' : 'success'}
            variant="filled"
            sx={{
              width: '100%',
              transition: 'all 0.3s ease',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            {error || success}
          </Alert>
        </Snackbar>

        <style>
          {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes scaleIn {
            from {
              transform: scale(0.95);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          html {
            scroll-behavior: smooth;
          }

          * {
            transition: background-color 0.3s ease,
                      transform 0.3s ease,
                      opacity 0.3s ease;
          }
        `}
        </style>

        <Dialog
          open={loading}
          PaperProps={{
            style: {
              backgroundColor: 'transparent',
              boxShadow: 'none',
              overflow: 'hidden'
            }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              p: 3,
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 2,
              animation: 'scaleIn 0.3s ease-out'
            }}
          >
            <CircularProgress size={60} />
            <Typography
              variant="h6"
              sx={{
                mt: 2,
                color: 'primary.main',
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              Processing...
            </Typography>
          </Box>
        </Dialog>

        {filteredDevices.length === 0 && !loading && (
          <Fade in timeout={500}>
            <Box
              sx={{
                textAlign: 'center',
                p: 4,
                mt: 4,
                bgcolor: 'background.paper',
                borderRadius: 2,
                animation: 'fadeIn 0.5s ease-out'
              }}
            >
              <Typography variant="h6" color="text.secondary">
                No registered devices found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Try adjusting your search or filters
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  setSearchQuery('');
                  setPlatformFilter('all');
                  setSortConfig({ key: 'name', direction: 'asc' });
                }}
                sx={{
                  mt: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'scale(1.05)' }
                }}
              >
                Reset Filters
              </Button>
            </Box>
          </Fade>
        )}
      </Box>
    </div>
  );
};

export default Notification;