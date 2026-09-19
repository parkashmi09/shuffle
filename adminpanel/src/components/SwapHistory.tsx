import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  TextField,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  InputAdornment,
  SelectChangeEvent,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { apiFetch } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

interface SwapHistoryItem {
  id: number;
  uid: number;
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  fee_percentage: number;
  fee_amount: number;
  fee_currency: string;
  usd_rate_from: number;
  usd_rate_to: number;
  created_at: string;
  user_name: string;
}

type SortField = keyof SwapHistoryItem;

interface SortConfig {
  field: SortField;
  direction: 'asc' | 'desc';
}

const SwapHistory: React.FC = () => {
  const [data, setData] = useState<SwapHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [fromCurrency, setFromCurrency] = useState<string>('');
  const [toCurrency, setToCurrency] = useState<string>('');

  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'created_at',
    direction: 'desc'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      // Every swap on the platform, staff-scoped. Legacy took a `uid` from the
      // query on an unauthenticated route.
      setData(await apiFetch(ENDPOINTS.swap.history));
    } catch (err) {
      setError('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get unique currencies for filters
  const uniqueFromCurrencies = Array.from(new Set(data.map(item => item.from_currency)));
  const uniqueToCurrencies = Array.from(new Set(data.map(item => item.to_currency)));

  // Handle sorting
  const handleSort = (field: SortField) => {
    setSortConfig({
      field,
      direction: sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  // Filter and sort data
  const filteredAndSortedData = [...data]
    .filter(item => {
      const searchLower = search.toLowerCase();
      return (
        (item.user_name?.toLowerCase().includes(searchLower) ||
          item.uid.toString().includes(searchLower)) &&
        (!fromCurrency || item.from_currency === fromCurrency) &&
        (!toCurrency || item.to_currency === toCurrency)
      );
    })
    .sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortConfig.direction === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

  const resetFilters = () => {
    setSearch('');
    setFromCurrency('');
    setToCurrency('');
  };

  if (error) {
    return (
      <Box className="p-2">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <div className="p-2">
      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" marginBottom={3}>
            <Typography variant="h5" component="h2">
              Swap History
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} marginBottom={3}>
            <TextField
              label="Search by Username or UID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              fullWidth
            />

            <FormControl style={{ minWidth: 150 }}>
              <InputLabel>From Currency</InputLabel>
              <Select
                value={fromCurrency}
                label="From Currency"
                onChange={(e: SelectChangeEvent) => setFromCurrency(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {uniqueFromCurrencies.map(currency => (
                  <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl style={{ minWidth: 150 }}>
              <InputLabel>To Currency</InputLabel>
              <Select
                value={toCurrency}
                label="To Currency"
                onChange={(e: SelectChangeEvent) => setToCurrency(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {uniqueToCurrencies.map(currency => (
                  <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              startIcon={<ClearIcon />}
              onClick={resetFilters}
              variant="outlined"
              color="secondary"
            >
              Clear Filters
            </Button>
          </Stack>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig.field === 'created_at'}
                      direction={sortConfig.direction}
                      onClick={() => handleSort('created_at')}
                    >
                      Date/Time
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig.field === 'user_name'}
                      direction={sortConfig.direction}
                      onClick={() => handleSort('user_name')}
                    >
                      Username
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>UID</TableCell>
                  <TableCell>From Currency</TableCell>
                  <TableCell>To Currency</TableCell>
                  <TableCell align="right">From Amount</TableCell>
                  <TableCell align="right">To Amount</TableCell>
                  <TableCell align="right">Fee Amount</TableCell>
                  <TableCell align="right">Fee %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No data found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{row.user_name}</TableCell>
                      <TableCell>{row.uid}</TableCell>
                      <TableCell>
                        <Chip label={row.from_currency} color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={row.to_currency} color="secondary" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        {row.from_amount.toFixed(8)}
                      </TableCell>
                      <TableCell align="right">
                        {row.to_amount.toFixed(8)}
                      </TableCell>
                      <TableCell align="right">
                        {row.fee_amount.toFixed(8)}
                      </TableCell>
                      <TableCell align="right">
                        {(row.fee_percentage * 100).toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default SwapHistory;