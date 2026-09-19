import React, { useState, useEffect } from "react";
import {
  Switch,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Grid,
  Divider,
  FormControlLabel
} from "@mui/material";
import { API_BASE_URL, buildPath, getStaffToken } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

const authHeader = (): Record<string, string> => {
  const token = getStaffToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface SportConfig {
  id: number;
  game_id: number;
  game_name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const SportsConfigSection = () => {
  const [sportsConfig, setSportsConfig] = useState<SportConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSportsConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${ENDPOINTS.sportsCatalogue.sports}`, { headers: authHeader() });
      const data = await response.json();
      setSportsConfig(data.data || []);
    } catch (error) {
      console.error("Failed to load sports configuration:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSportsConfig();
  }, []);

  const handleSportToggle = async (id: number, enabled: boolean) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}${buildPath(ENDPOINTS.sportsCatalogue.sport, { id })}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: enabled }),
      });
      const data = await response.json();

      if (data.success) {
        // Update the local state with the new config
        setSportsConfig(prevConfig =>
          prevConfig.map(sport =>
            sport.id === id ? { ...sport, enabled } : sport
          )
        );
      } else {
        console.error("Failed to update sport configuration");
      }
    } catch (error) {
      console.error("Failed to update sport configuration:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && sportsConfig.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div>
      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" gutterBottom>
        Sports Configuration
      </Typography>
      <Grid container spacing={2}>
        {sportsConfig.map((sport) => (
          <Grid item xs={6} md={3} key={sport.id}>
            <FormControlLabel
              control={
                <Switch
                  checked={sport.enabled}
                  onChange={(e) => handleSportToggle(sport.id, e.target.checked)}
                  disabled={isLoading}
                />
              }
              label={sport.game_name}
            />
          </Grid>
        ))}
      </Grid>
    </div>
  );
};

export default SportsConfigSection;