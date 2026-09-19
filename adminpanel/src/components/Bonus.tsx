import React, { useState, useEffect } from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from "@mui/material";
import { styled } from "@mui/system";
import axios from "axios";
import { ENDPOINTS } from '../services/endpoints';

// API Constants
/**
 * Legacy authenticated all four with a shared static `role-key` HEADER — one
 * key per role, committed in the client bundle — and named the player with a
 * `userid` query parameter. Holding the key made you "a user", not "this user".
 */
const API_URL_USERBONUS = ENDPOINTS.bonus.records;
const API_URL_BONUSGAME = ENDPOINTS.bonus.games;
const API_URL_USERBONUS_update = ENDPOINTS.bonus.records;
const API_URL_BONUSGAME_update = ENDPOINTS.bonus.games;
const ROLE_KEY = "3c95e1f2a6b8d740c9e3812f5d7694b0a2c8157e943fd6802b5e9c71m4a3h8p9";

// Unified Type Definition
interface BonusData {
  userid: number;
  name?: string;
  vipbonus?: number;
  specialbonus?: number;
  generalbonus?: number;
  joiningbonus?: number;
  dailybonus?: number;
  weeklybonus?: number;
  monthlybonus?: number;
  depositbonus?: number;
  rakebackbonus?: number;
  createdat: string;
  updatedat: string;
}

// Form State Interface
interface BonusFormState {
  name: string;
  vipbonus: string;
  specialbonus: string;
  generalbonus: string;
  joiningbonus: string;
  dailybonus: string;
  weeklybonus: string;
  monthlybonus: string;
  depositbonus: string;
  rakebackbonus: string;
}

// Styled components
const StyledTableContainer = styled(TableContainer)({
  backgroundColor: "#121E38",
  color: "white",
  borderRadius: "8px",
  marginTop: "16px",
});

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    backgroundColor: "#121E38",
    color: "white",
    borderRadius: "8px",
    width: "90%",
    maxWidth: "500px",
  },
});

const Bonus: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"userBonus" | "bonusGame">("userBonus");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [userBonuses, setUserBonuses] = useState<BonusData[]>([]);
  const [bonusGames, setBonusGames] = useState<BonusData[]>([]);
  const [selectedBonus, setSelectedBonus] = useState<BonusData | null>(null);
  const [formState, setFormState] = useState<BonusFormState>({
    name: "",
    vipbonus: "",
    specialbonus: "",
    generalbonus: "",
    joiningbonus: "",
    dailybonus: "",
    weeklybonus: "",
    monthlybonus: "",
    depositbonus: "",
    rakebackbonus: "",
  });

  const calculateUserTotal = (user: BonusData) => {
    return (
      (user.vipbonus || 0) +
      (user.specialbonus || 0) +
      (user.generalbonus || 0) +
      (user.joiningbonus || 0)
    );
  };

  const calculateBonusGameTotal = (bonus: BonusData) => {
    return (
      (bonus.dailybonus || 0) +
      (bonus.weeklybonus || 0) +
      (bonus.monthlybonus || 0) +
      (bonus.depositbonus || 0) +
      (bonus.rakebackbonus || 0)
    );
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleUpdateBonus = async () => {
    if (!selectedBonus) return;

    try {
      if (activeTab === "bonusGame") {
        const payload = {
          userid: selectedBonus.userid,
          role: 'admin',
          target_userid: selectedBonus.userid,
          dailybonus: formState.dailybonus ? Number(formState.dailybonus) : 0,
          weeklybonus: formState.weeklybonus ? Number(formState.weeklybonus) : 0,
          monthlybonus: formState.monthlybonus ? Number(formState.monthlybonus) : 0,
          depositbonus: formState.depositbonus ? Number(formState.depositbonus) : 0,
          rakebackbonus: formState.rakebackbonus ? Number(formState.rakebackbonus) : 0,
          luckyspin: 0,
          rollcompetitionbonus: 0
        };
        await axios.put(API_URL_BONUSGAME_update, payload, {
          headers: { "role-key": ROLE_KEY },
        });
      } else {
        const payload = {
          userid: selectedBonus.userid,
          name: formState.name || selectedBonus.name,
          vipbonus: formState.vipbonus ? Number(formState.vipbonus) : 0,
          specialbonus: formState.specialbonus ? Number(formState.specialbonus) : 0,
          generalbonus: formState.generalbonus ? Number(formState.generalbonus) : 0,
          joiningbonus: formState.joiningbonus ? Number(formState.joiningbonus) : 0,
        };
        await axios.put(API_URL_USERBONUS_update, payload, {
          headers: { "role-key": ROLE_KEY },
        });
      }
      await fetchData();
      handleCloseDialog();
    } catch (error) {
      console.error("Failed to update bonus", error);
    }
  };

  const handleCloseDialog = () => {
    setSelectedBonus(null);
    setFormState({
      name: "",
      vipbonus: "",
      specialbonus: "",
      generalbonus: "",
      joiningbonus: "",
      dailybonus: "",
      weeklybonus: "",
      monthlybonus: "",
      depositbonus: "",
      rakebackbonus: "",
    });
  };

  const handleOpenDialog = (bonus: BonusData) => {
    setSelectedBonus(bonus);
    setFormState({
      name: bonus.name || "",
      vipbonus: "",
      specialbonus: "",
      generalbonus: "",
      joiningbonus: "",
      dailybonus: "",
      weeklybonus: "",
      monthlybonus: "",
      depositbonus: "",
      rakebackbonus: "",
    });
  };

  const handleInputChange = (field: keyof BonusFormState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const fetchData = async () => {
    try {
      const endpoint = activeTab === "userBonus" ? API_URL_USERBONUS : API_URL_BONUSGAME;
      const response = await axios.get<BonusData[]>(endpoint, {
        headers: { "role-key": ROLE_KEY },
      });

      const dataWithNames = response.data.map(item => ({
        ...item,
        name: item.name || `User ${item.userid}`
      }));

      if (activeTab === "userBonus") {
        setUserBonuses(dataWithNames);
      } else {
        setBonusGames(dataWithNames);
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeTab} data`, error);
    }
  };

  const filterData = (data: BonusData[]) => {
    return data.filter((item) =>
      (item.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const renderUserBonusTable = () => (
    <StyledTableContainer>
      <Table>
        <TableHead>
          <TableRow>
            {["User ID", "Name", "Total Bonus", "VIP Bonus", "Special Bonus", "General Bonus", "Joining Bonus", "Actions"].map((header) => (
              <TableCell key={header} style={{ color: "white", fontWeight: "bold" }}>
                {header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {filterData(userBonuses).map((bonus) => (
            <TableRow key={bonus.userid} hover>
              <TableCell style={{ color: 'white' }}>{bonus.userid}</TableCell>
              <TableCell style={{ color: 'white' }}>{bonus.name || "N/A"}</TableCell>
              <TableCell style={{ color: 'white' }}>{calculateUserTotal(bonus)}</TableCell>
              <TableCell style={{ color: 'white' }}>{bonus.vipbonus || 0}</TableCell>
              <TableCell style={{ color: 'white' }}>{bonus.specialbonus || 0}</TableCell>
              <TableCell style={{ color: 'white' }}>{bonus.generalbonus || 0}</TableCell>
              <TableCell style={{ color: 'white' }}>{bonus.joiningbonus || 0}</TableCell>
              <TableCell>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleOpenDialog(bonus)}
                >
                  Add
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );

  const renderBonusGamesTable = () => (
    <StyledTableContainer>
      <Table>
        <TableHead>
          <TableRow>
            {["User ID", "Name", "Total Bonus", "Daily Bonus", "Weekly Bonus", "Monthly Bonus", "Deposit Bonus", "Rakeback Bonus", "Actions"].map(
              (header) => (
                <TableCell key={header} style={{ color: "white", fontWeight: "bold" }}>
                  {header}
                </TableCell>
              )
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {filterData(bonusGames).map((game) => (
            <TableRow key={game.userid} hover>
              <TableCell style={{ color: 'white' }}>{game.userid}</TableCell>
              <TableCell style={{ color: 'white' }}>{game.name || "N/A"}</TableCell>
              <TableCell style={{ color: 'white' }}>{calculateBonusGameTotal(game)}</TableCell>
              <TableCell style={{ color: 'white' }}>{game.dailybonus || 0}</TableCell>
              <TableCell style={{ color: 'white' }}>{game.weeklybonus || 0}</TableCell>
              <TableCell style={{ color: 'white' }}>{game.monthlybonus || 0}</TableCell>
              <TableCell style={{ color: 'white' }}>{game.depositbonus || 0}</TableCell>
              <TableCell style={{ color: 'white' }}>{game.rakebackbonus || 0}</TableCell>
              <TableCell>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleOpenDialog(game)}
                >
                  Add
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );

  return (
    <div className="p-2">
      <Box sx={{ padding: 2, backgroundColor: "#0E1831", color: "white", borderRadius: "8px" }}>
        <Typography variant="h5" sx={{ marginBottom: 2 }}>
          Bonus Management
        </Typography>
        <Tabs
          value={activeTab}
          onChange={(event, newValue) => setActiveTab(newValue)}
          sx={{
            "& .MuiTabs-flexContainer": {
              justifyContent: "space-between",
            },
            "& .MuiTab-root": {
              color: "white",
              textTransform: "none",
              fontSize: "16px",
            },
            "& .Mui-selected": {
              color: "#90caf9",
            },
          }}
        >
          <Tab value="userBonus" label="User Bonuses" />
          <Tab value="bonusGame" label="Bonus Games" />
        </Tabs>
        <Box sx={{ marginY: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">🔍</InputAdornment>,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "#121E38",
                color: "white",
              },
            }}
          />
        </Box>
        {activeTab === "userBonus" ? renderUserBonusTable() : renderBonusGamesTable()}
        <StyledDialog open={!!selectedBonus} onClose={handleCloseDialog}>
          <DialogTitle>ADD Bonus</DialogTitle>
          <DialogContent>
            {selectedBonus && (
              <>
                <TextField
                  fullWidth
                  margin="dense"
                  label="Name"
                  value={formState.name}
                  onChange={handleInputChange("name")}
                  sx={{ "& .MuiInputBase-root": { color: "white" } }}
                />
                {activeTab === "userBonus" ? (
                  <>
                    <TextField
                      fullWidth
                      margin="dense"
                      label="VIP Bonus"
                      type="number"
                      value={formState.vipbonus}
                      onChange={handleInputChange("vipbonus")}
                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                    <TextField
                      fullWidth
                      margin="dense"
                      label="Special Bonus"
                      type="number"
                      value={formState.specialbonus}
                      onChange={handleInputChange("specialbonus")}
                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                    <TextField
                      fullWidth
                      margin="dense"
                      label="General Bonus"
                      type="number"
                      value={formState.generalbonus}
                      onChange={handleInputChange("generalbonus")}
                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                    <TextField
                      fullWidth
                      margin="dense"
                      label="Joining Bonus"
                      type="number"
                      value={formState.joiningbonus}
                      onChange={handleInputChange("joiningbonus")}

                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                  </>
                ) : (
                  <>
                    <TextField
                      fullWidth
                      margin="dense"
                      label="Daily Bonus"
                      type="number"
                      value={formState.dailybonus}
                      onChange={handleInputChange("dailybonus")}
                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                    <TextField
                      fullWidth
                      margin="dense"
                      label="Weekly Bonus"
                      type="number"
                      value={formState.weeklybonus}
                      onChange={handleInputChange("weeklybonus")}
                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                    <TextField
                      fullWidth
                      margin="dense"
                      label="Monthly Bonus"
                      type="number"
                      value={formState.monthlybonus}
                      onChange={handleInputChange("monthlybonus")}
                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                    <TextField
                      fullWidth
                      margin="dense"
                      label="Deposit Bonus"
                      type="number"
                      value={formState.depositbonus}
                      onChange={handleInputChange("depositbonus")}
                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                    <TextField
                      fullWidth
                      margin="dense"
                      label="Rakeback Bonus"
                      type="number"
                      value={formState.rakebackbonus}
                      onChange={handleInputChange("rakebackbonus")}
                      sx={{ "& .MuiInputBase-root": { color: "white" } }}
                    />
                  </>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleUpdateBonus}
              variant="contained"
              color="primary"
            >
              ADD
            </Button>
            <Button onClick={handleCloseDialog} variant="outlined" color="secondary">
              Cancel
            </Button>
          </DialogActions>
        </StyledDialog>
      </Box>
    </div>
  );
};

export default Bonus;