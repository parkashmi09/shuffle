// src/components/Layout.tsx
import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Wallet } from "lucide-react";
import { apiFetch, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";

import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import { SHELL_TOP_BAR_HEIGHT } from "../constants/layout";

interface UserBar {
  name: string;
  role: string;
  balance: number;
}

/** `GET /admin/staff/rollup/:staffId` — `balance` is a decimal string, not a number. */
interface Rollup {
  staffId: number;
  includesSubtree: boolean;
  staffAccounts: number;
  players: number;
  balance: string;
  currency: string;
}

const Layout = () => {
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [isSidebarOpen, setSB] = useState(false);
  const [user, setUser] = useState<UserBar>({ name: "", role: "", balance: 0 });

  /* ──────────────────────────────  fetch /api/staff/:id  */
  const fetchMe = async () => {
    const id = localStorage.getItem("currentUserId");
    if (!id) return;

    const [info, roll] = await Promise.all([
      apiFetch<{ name: string; role: string }>(buildPath(ENDPOINTS.staff.get, { staffId: id })),
      apiFetch<Rollup>(buildPath(ENDPOINTS.staff.rollup, { staffId: id })),
    ]);

    setUser({
      name: info.name,
      role: info.role,
      // `apiFetch` already unwraps the `{success, data}` envelope, so the fields
      // are on `roll` itself — reaching for `roll.data` read undefined and the
      // header rendered 0.00 against a real balance.
      balance: Number(roll.balance ?? 0),
    });
  };

  useEffect(() => { fetchMe(); }, []);
  useEffect(() => {
    window.addEventListener("balance-changed", fetchMe);
    return () => window.removeEventListener("balance-changed", fetchMe);
  }, []);

  /* ──────────────────────────────  helpers  */
  const pageTitle = (() => {
    const seg = location.pathname.split("/").filter(Boolean).pop() || "dashboard";
    return seg
      .replace(/-/g, " ")
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase());
  })();

  /* ──────────────────────────────  render  */
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#0C0D1D" }}>
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setSB(!isSidebarOpen)} />

      {/* Right column: AppBar + Main */}
      <Box
        component="div"
        sx={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: "100vh",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {/* ── Top AppBar ── */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: "#0E1831",
            borderRadius: 0,
            border: "none",
            borderBottom: "1px solid #1E2D55",
            zIndex: 10,
          }}
        >
          <Toolbar
            sx={{
              justifyContent: "space-between",
              minHeight: SHELL_TOP_BAR_HEIGHT,
              height: SHELL_TOP_BAR_HEIGHT,
              boxSizing: "border-box",
              px: 2,
              py: 0,
            }}
          >
            {/* Left: hamburger + title */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              {!isDesktop && (
                <IconButton
                  onClick={() => setSB(!isSidebarOpen)}
                  size="small"
                  sx={{ color: "#8384A5", "&:hover": { color: "#F9F9F9", bgcolor: "#162140" } }}
                >
                  <MenuIcon fontSize="small" />
                </IconButton>
              )}

              <Typography
                noWrap
                sx={{
                  color: "#F9F9F9",
                  fontWeight: 600,
                  fontSize: { xs: "0.9rem", sm: "1.05rem" },
                }}
              >
                {pageTitle}
              </Typography>
            </Box>

            {/* Right: wallet + user */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
              {/* Wallet badge */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  bgcolor: "#0C0D1D",
                  border: "1px solid #1E2D55",
                  borderRadius: 2,
                  px: 1.25,
                  py: 0.5,
                  cursor: "pointer",
                  "&:hover": { borderColor: "#886CFF" },
                }}
                onClick={fetchMe}
              >
                <Wallet size={15} color="#FFC23F" />
                <Typography sx={{ color: "#F9F9F9", fontSize: "0.75rem", fontWeight: 700 }}>
                  {user.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>

              {/* User pill */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: "#886CFF",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                </Avatar>

                <Box sx={{ display: { xs: "none", sm: "block" } }}>
                  <Typography sx={{ color: "#F9F9F9", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.2 }}>
                    {user.name || "..."}
                  </Typography>
                  <Typography sx={{ color: "#878AA2", fontSize: "0.65rem", lineHeight: 1.2 }}>
                    {user.role}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

        {/* ── Main Content ── */}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            bgcolor: "#0C0D1D",
            p: { xs: 1.5, sm: 2, md: 2.5 },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
