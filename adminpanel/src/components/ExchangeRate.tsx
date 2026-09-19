
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
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
  Paper,
} from '@mui/material';
import { Edit as EditIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { apiFetch, buildPath } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

interface ExchangeRate {
  currency: string;
  usd_rate: number;
  last_updated: string;
}

const PRECISION = 6;

const roundToFixed = (num: number, decimals: number): number => {
  return Number(Math.round(Number(num + 'e' + decimals)) + 'e-' + decimals);
};

const ExchangeRate: React.FC = () => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<ExchangeRate | null>(null);
  const [newRate, setNewRate] = useState<string>('');
  const [updateLoading, setUpdateLoading] = useState(false);

  const fetchRates = async () => {
    try {
      setLoading(true);
      setRates(await apiFetch(ENDPOINTS.exchangeRate.read));
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleEditClick = (rate: ExchangeRate) => {
    setSelectedCurrency(rate);
    setNewRate((1 / rate.usd_rate).toFixed(PRECISION));
    setEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!selectedCurrency || !newRate) return;

    try {
      setUpdateLoading(true);
      const directRate = parseFloat(newRate);
      const usdRate = roundToFixed(1 / directRate, PRECISION);

      const response = await fetch(buildPath(ENDPOINTS.exchangeRate.update, { currency: selectedCurrency.currency }), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usd_rate: usdRate
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchRates();
        setEditDialog(false);
      } else {
        setError('Failed to update rate');
      }
    } catch (err) {
      setError('Error updating rate');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-2">
      <div style={{ padding: '1rem' }}>
        <Card>
          <CardHeader
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5" component="h2">
                  Exchange Rates
                </Typography>
                <Button
                  onClick={fetchRates}
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                >
                  Refresh
                </Button>
              </div>
            }
          />
          <CardContent>
            {error && (
              <Alert severity="error" style={{ marginBottom: '1rem' }}>
                {error}
              </Alert>
            )}

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Currency</TableCell>
                    <TableCell>1 USD Rate</TableCell>
                    <TableCell>Currency Rate</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rates.map((rate) => (
                    <TableRow key={rate.currency}>
                      <TableCell component="th" scope="row">
                        {rate.currency}
                      </TableCell>
                      <TableCell>
                        1 USD = {(1 / rate.usd_rate).toFixed(PRECISION)} {rate.currency}
                      </TableCell>
                      <TableCell>
                        1 {rate.currency} = {rate.usd_rate.toFixed(PRECISION)} USD
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(rate)}
                        >
                          <EditIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <Dialog open={editDialog} onClose={() => setEditDialog(false)}>
          <DialogTitle>
            Update {selectedCurrency?.currency} Exchange Rate
          </DialogTitle>
          <DialogContent>
            <div style={{ paddingTop: '1rem' }}>
              <TextField
                label={`1 USD equals how many ${selectedCurrency?.currency}?`}
                type="number"
                value={newRate}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewRate(value);
                }}
                fullWidth
                inputProps={{ step: "0.000001" }}
              />
              {selectedCurrency && newRate && !isNaN(parseFloat(newRate)) && (
                <Typography variant="body2" color="text.secondary" style={{ marginTop: '1rem' }}>
                  Current rate: 1 USD = {(1 / selectedCurrency.usd_rate).toFixed(PRECISION)} {selectedCurrency.currency}
                  <br />
                  New rate: 1 {selectedCurrency.currency} = {(1 / parseFloat(newRate)).toFixed(PRECISION)} USD
                </Typography>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateLoading}
              variant="contained"
            >
              {updateLoading ? (
                <>
                  <CircularProgress size={20} style={{ marginRight: '0.5rem' }} />
                  Updating...
                </>
              ) : (
                'Update Rate'
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
};

export default ExchangeRate;