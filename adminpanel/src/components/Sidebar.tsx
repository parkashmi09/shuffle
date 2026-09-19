import React, { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";
import { BRAND_PRIMARY, BRAND_PRIMARY_MUTED, BRAND_PRIMARY_MUTED_HOVER } from "../constants/branding";
import { SHELL_TOP_BAR_HEIGHT } from "../constants/layout";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Avatar,
  Divider,
  Typography,
  IconButton,
  Box,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  History,
  LogOut,
  ArrowUpCircle,
  ArrowDownCircle,
  Bell,
  Gift,
  ChevronsRight,
  Shield,
  File,
  Gamepad2,
  ArrowBigUpIcon,
  BookOpen,
  X,
  Percent,
  Gamepad,
  Settings,
  Settings2,
  Image,
  Trophy,
  BellRing,
  Search,
  TrendingUp,
  BarChart3,
  Target,
  Dices,
  ScrollText,
  Landmark,
  Sparkles,
} from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";
import { roleKey } from "../constants/permissions";
import { SHUFFLE_GROUP_ACCESS, SHUFFLE_PAGE_GROUPS } from "../constants/shuffleNav";
import { API_BASE_URL, clearStaffSession } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

/** The same table, keyed so `Super Admin` finds the `SuperAdmin` row. */
const GROUP_ACCESS_BY_KEY: Record<string, string[]> = Object.fromEntries(
  Object.entries(SHUFFLE_GROUP_ACCESS).map(([name, groups]) => [roleKey(name), groups])
);

const ICON_BY_PATH: Record<string, React.ReactNode> = {
  "/admin-dashboard": <LayoutDashboard size={18} />,
  "/users": <Users size={18} />,
  "/reports": <File size={18} />,
  "/kyc": <Shield size={18} />,
  "/wallet": <Wallet size={18} />,
  "/redeemcode": <Gift size={18} />,
  "/turnover-report": <BarChart3 size={18} />,
  "/admin-management": <Shield size={18} />,
  "/activity-log": <ScrollText size={18} />,
  "/percentage-hierarchy": <ArrowBigUpIcon size={18} />,
  "/vaultpro": <Landmark size={18} />,
  "/history": <History size={18} />,
  "/deposit": <ArrowUpCircle size={18} />,
  "/withdraw": <ArrowDownCircle size={18} />,
  "/account-statement": <File size={18} />,
  "/affiliate": <Target size={18} />,
  "/giftcard-admin": <Gift size={18} />,
  "/spinwheel": <Gamepad2 size={18} />,
  "/races": <Trophy size={18} />,
  "/blog": <BookOpen size={18} />,
  "/siteconfig": <Settings size={18} />,
  "/providers-priority": <Trophy size={18} />,
  "/vendor-priority": <ArrowBigUpIcon size={18} />,
  "/type-priority": <Gamepad2 size={18} />,
  "/trending-games": <TrendingUp size={18} />,
  "/only-on-stake": <Sparkles size={18} />,
  "/notification": <Bell size={18} />,
};

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  requireRole?: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const SIDEBAR_WIDTH = 256;

const drawerPaperSx = {
  width: SIDEBAR_WIDTH,
  bgcolor: "#0E1831",
  borderRight: "1px solid #1E2D55",
  color: "#F9F9F9",
  display: "flex",
  flexDirection: "column",
  overflowX: "hidden",
  "&::-webkit-scrollbar": { width: 4 },
  "&::-webkit-scrollbar-thumb": {
    bgcolor: "#1E2D55",
    borderRadius: 2,
  },
} as const;

/* ------------------------------------------------------------------
   Component
   ------------------------------------------------------------------ */
const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));

  const userRole = localStorage.getItem("userRole") || "Guest";
  const userName = localStorage.getItem("userName") || "Admin";
  /**
   * Looked up by NORMALISED role name — see `roleKey`.
   *
   * `GROUP_ACCESS["Super Admin"]` is undefined (the table spells it
   * `SuperAdmin`), so this resolved to `[]` and the platform owner saw a
   * sidebar with no groups in it at all.
   */
  const allowedGroups =
    GROUP_ACCESS_BY_KEY[roleKey(userRole)] ?? [];

  const { isSuper, pageVisible, groupVisible } = usePermissions();

  /* -------- menu definition (Shuffle operator scope) -------- */
  const menuGroups: MenuGroup[] = SHUFFLE_PAGE_GROUPS.map((group) => ({
    title: group.title,
    items: group.pages.map((page) => ({
      path: page.path,
      label: page.label,
      icon: ICON_BY_PATH[page.path] ?? <File size={18} />,
    })),
  }));

  /* -------- apply role + permission filter --------
     Super roles see the legacy GROUP_ACCESS list.
     Sub-admins see only what their permissions grant
     (groupVisible AND pageVisible from usePermissions). */
  const filteredMenuGroups = menuGroups
    .filter((g) => {
      if (isSuper) return allowedGroups.includes(g.title);
      return groupVisible(g.title);
    })
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (i.requireRole && i.requireRole !== userRole) return false;
        if (isSuper) return true;
        return pageVisible(i.path);
      }),
    }))
    .filter((g) => g.items.length > 0);

  /* -------- auto-expand active group -------- */
  useEffect(() => {
    filteredMenuGroups.forEach((group) => {
      const activeInside = group.items.some((item) => item.path === location.pathname);
      if (activeInside) {
        setCollapsed((prev) => ({ ...prev, [group.title]: false }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  /* -------- helpers -------- */
  const toggleGroup = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  const handleLogout = () => {
    // Record the logout in the activity log before clearing the token.
    // Fire-and-forget — never block sign-out on the log call.
    const token = localStorage.getItem("token");
    if (token) {
      // `keepalive` so the revoke still goes out if the tab is closing.
      fetch(`${API_BASE_URL}${ENDPOINTS.auth.logout}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }
    /**
     * Everything goes except the theme.
     *
     * This used to carry `adminUsers` across sign-out — a leftover from a mock
     * admin screen that kept staff records, PLAINTEXT PASSWORDS INCLUDED, in
     * localStorage. The screen is gone and the login no longer consults that
     * key, so preserving it only left credentials on a shared machine after the
     * operator thought they had signed out.
     */
    clearStaffSession();
    navigate("/login");
    toggleSidebar();
  };

  const handleItemClick = () => {
    if (!isDesktop) toggleSidebar();
  };

  /* -------- drawer content -------- */
  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ---- Logo / top bar ---- */}
      <Box
        sx={{
          px: 2,
          py: 1.75,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          borderBottom: "1px solid #1E2D55",
          minHeight: SHELL_TOP_BAR_HEIGHT,
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <BrandLogo showTagline height={32} />
        </Box>
        {!isDesktop && (
          <IconButton onClick={toggleSidebar} sx={{ color: "#8384A5", "&:hover": { color: "#F9F9F9" } }}>
            <X size={20} />
          </IconButton>
        )}
      </Box>

      {/* ---- User badge ---- */}
      <Box sx={{ p: 2, borderBottom: "1px solid #1E2D55" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: BRAND_PRIMARY,
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ color: "#F9F9F9", fontWeight: 600 }}>
              {userName}
            </Typography>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              {userRole}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ---- Menu groups ---- */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1, px: 1 }}>
        {filteredMenuGroups.map((group) => (
          <Box key={group.title} sx={{ mb: 0.5 }}>
            {/* Group header */}
            <ListItemButton
              onClick={() => toggleGroup(group.title)}
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                "&:hover": { bgcolor: "transparent" },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  color: "#878AA2",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.65rem",
                }}
              >
                {group.title}
              </Typography>
              <ChevronsRight
                size={14}
                color="#878AA2"
                style={{
                  transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: !collapsed[group.title] ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
            </ListItemButton>

            {/* Collapsible items */}
            <Collapse in={!collapsed[group.title]} timeout={250} unmountOnExit>
              <List disablePadding sx={{ mt: 0.25 }}>
                {group.items.map((item) => (
                  <ListItem key={item.path} disablePadding sx={{ mb: "1px" }}>
                    <NavLink
                      to={item.path}
                      onClick={handleItemClick}
                      style={{ width: "100%", textDecoration: "none" }}
                    >
                      {({ isActive }) => (
                        <ListItemButton
                          selected={isActive}
                          sx={{
                            borderRadius: 1.5,
                            py: 0.85,
                            px: 1.5,
                            transition: "all 150ms ease",
                            color: isActive ? BRAND_PRIMARY : "#8384A5",
                            bgcolor: isActive ? BRAND_PRIMARY_MUTED : "transparent",
                            "&:hover": {
                              bgcolor: isActive ? BRAND_PRIMARY_MUTED_HOVER : "#162140",
                              color: isActive ? BRAND_PRIMARY : "#F9F9F9",
                            },
                            "&.Mui-selected": {
                              bgcolor: BRAND_PRIMARY_MUTED,
                              "&:hover": { bgcolor: BRAND_PRIMARY_MUTED_HOVER },
                            },
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 32,
                              color: "inherit",
                            }}
                          >
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: "0.82rem",
                              fontWeight: isActive ? 600 : 400,
                            }}
                          />
                          {isActive && (
                            <Box
                              sx={{
                                width: 3,
                                height: 20,
                                borderRadius: 2,
                                bgcolor: BRAND_PRIMARY,
                                position: "absolute",
                                right: 0,
                              }}
                            />
                          )}
                        </ListItemButton>
                      )}
                    </NavLink>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>
        ))}
      </Box>

      {/* ---- Logout ---- */}
      <Divider sx={{ borderColor: "#1E2D55" }} />
      <Box sx={{ p: 1.5 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 1.5,
            py: 1,
            px: 1.5,
            color: "#8384A5",
            transition: "all 150ms ease",
            "&:hover": {
              bgcolor: "rgba(239, 68, 68, 0.1)",
              color: "#EF4444",
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <LogOut size={18} />
          </ListItemIcon>
          <ListItemText
            primary="Log Out"
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop: permanent drawer */}
      {isDesktop && (
        <Drawer
          variant="permanent"
          open
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": drawerPaperSx,
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile: temporary drawer with backdrop */}
      {!isDesktop && (
        <Drawer
          variant="temporary"
          open={isOpen}
          onClose={toggleSidebar}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": drawerPaperSx,
            "& .MuiBackdrop-root": {
              bgcolor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
};

export default Sidebar;
