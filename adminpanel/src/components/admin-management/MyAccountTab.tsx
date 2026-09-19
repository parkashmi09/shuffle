/*  ──────────────────────────────────────────────────────────────
    MyAccountTab.tsx
    • Only “SuperAdmin” (case–insensitive) can edit profile,
      add balance or change email settings.
    • Every staff role (whole agent hierarchy) can change their OWN
      password — the backend's self branch validates the old password.
    • All other profile fields are read-only for non-SuperAdmin roles.
    • Adds an "Add Balance" card (SuperAdmin only) that POSTs to
      /adminwalletadd and shows the updated balance returned by the server.
    ────────────────────────────────────────────────────────────── */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Avatar, Chip, Typography, TextField,
  InputAdornment, IconButton, Button, Snackbar, Alert, CircularProgress
} from "@mui/material";
import {
  User, Mail, Phone, Globe, Eye, EyeOff, KeyRound, Lock,
  Edit, Save, X, Shield, Copy, Link as LinkIcon, Bell, Send
} from "lucide-react";
import { apiFetch, buildPath } from "../../utils/api";
import { ENDPOINTS } from "../../services/endpoints";
import { useWhatsappRef, WaRef } from "../../hooks/waHook";
import { ALL_PAGE_PATHS } from "../../constants/permissions";
/* ---------- helpers & constants -------------------------------------- */
interface UserData {
  name: string;
  email: string;
  role: string;
  phone: string;
  country: string;
  agent_code?: string;
}

/* shared dark-theme styling for the email-settings text fields */
const emailFieldSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#0C0D1D",
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" },
  },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1E2D55" },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiInputBase-input": { color: "#ffffff" },
} as const;

/* =========================================================================
   COMPONENT
   ========================================================================= */
export default function MyAccountTab() {

  // ── Grab staffId from localStorage (as number) ─────────────────────────
  const rawId = localStorage.getItem("currentUserId");
  const staffId = rawId ? parseInt(rawId, 10) : null;

  // ── Fetch the user’s WhatsApp referral info ─────────────────────────────
  const waRef: WaRef | null = useWhatsappRef(staffId);

  /* ── base state ──────────────────────────────────────────────────── */
  const [me, setMe] = useState<UserData | null>(null);
  const [editMode, setEM] = useState(false);
  const [editData, setED] = useState<Partial<UserData>>({});

  /* ── password section ───────────────────────────────────────────── */
  const [oldPwd, setOld] = useState("");
  const [newPwd, setNew] = useState("");
  const [showOld, setSO] = useState(false);
  const [showNew, setSN] = useState(false);

  /* ── balance state (new) ─────────────────────────────────────────── */
  const [balance, setBalance] = useState("");         // amount as string
  const [loadingBal, setLoadingBal] = useState(false);

  /* ── email notification settings (SuperAdmin only) ───────────────── */
  const [notifyEmail, setNotifyEmail] = useState("");   // inbox that receives alerts
  const [gmailUser, setGmailUser] = useState("");       // Gmail address used to send
  const [gmailAppPwd, setGmailAppPwd] = useState("");   // Gmail app password (write-only)
  const [hasAppPwd, setHasAppPwd] = useState(false);
  const [showAppPwd, setShowAppPwd] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  /* ── misc UI state ──────────────────────────────────────────────── */
  const [loadingPwd, setLoadPwd] = useState(false);
  const [savingProf, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false, msg: "", sev: "success"
  });

  const canEdit = React.useMemo(() => {
    /** role from API wins, otherwise fall back to localStorage */
    const raw = (me?.role || localStorage.getItem("userRole") || "")
      .toLowerCase()
      .replace(/\s+/g, "");      /* "Super Admin" → "superadmin" */
    return raw === "superadmin";
  }, [me]);

  /* ── fetch my profile once ──────────────────────────────────────── */
  useEffect(() => {
    const id = localStorage.getItem("currentUserId");
    if (!id) return;
    apiFetch<UserData>(buildPath(ENDPOINTS.staff.get, { staffId: id }))
      .then(res => setMe({
        name: res.name,
        email: res.email,
        role: res.role,
        phone: res.phone || "",
        country: res.country || "",
        agent_code: res.agent_code || ""
      }))
      .catch(() => {/* ignore – snack not needed on first load */});
  }, []);

  /* ── load email notification settings (SuperAdmin only) ──────────── */
  useEffect(() => {
    if (!canEdit) return;
    apiFetch<{ gmailuser: string; apaynotificationemail: string; hasAppPassword: boolean }>(ENDPOINTS.siteConfig.email)
      .then(res => {
        setNotifyEmail(res.apaynotificationemail || "");
        setGmailUser(res.gmailuser || "");
        setHasAppPwd(!!res.hasAppPassword);
      })
      .catch(() => {/* card simply starts empty if it can't load */});
  }, [canEdit]);

  const saveEmailSettings = async () => {
    if (!canEdit) return;
    setSavingEmail(true);
    try {
      const payload: Record<string, string> = {
        apaynotificationemail: notifyEmail.trim(),
        gmailuser: gmailUser.trim(),
      };
      if (gmailAppPwd.trim()) payload.gmailapppassword = gmailAppPwd.trim();
      await apiFetch(ENDPOINTS.siteConfig.email, { method: "PUT", body: JSON.stringify(payload) });
      if (gmailAppPwd.trim()) setHasAppPwd(true);
      setGmailAppPwd("");
      setSnack({ open: true, msg: "Email settings saved", sev: "success" });
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Save failed", sev: "error" });
    } finally { setSavingEmail(false); }
  };

  const sendTestEmail = async () => {
    if (!canEdit) return;
    setTestingEmail(true);
    try {
      const res = await apiFetch<{ message?: string }>(ENDPOINTS.siteConfig.emailTest, { method: "POST" });
      setSnack({ open: true, msg: res?.message || "Test email sent", sev: "success" });
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Test failed — check Gmail / app password", sev: "error" });
    } finally { setTestingEmail(false); }
  };

  /* ─── helpers ───────────────────────────────────────────────────── */
  const startEdit = () => { if (canEdit) { setED(me ?? {}); setEM(true); } };
  const cancelEdit = () => { setEM(false); setED({}); };
  const field = (k: keyof UserData) => editData[k] ?? "";

  /* ─── save profile ──────────────────────────────────────────────── */
  const saveProfile = async () => {
    if (!canEdit) return;
    const id = localStorage.getItem("currentUserId");
    if (!id) return;

    setSaving(true);
    try {
      await apiFetch(buildPath(ENDPOINTS.staff.update, { staffId: id }), {
        method: "PATCH",
        body: JSON.stringify({ name: field("name"), phone: field("phone"), country: field("country") })
      });
      setMe(prev => prev ? { ...prev, ...editData } as UserData : prev);
      setSnack({ open: true, msg: "Profile updated!", sev: "success" });
      cancelEdit();
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Update failed", sev: "error" });
    } finally { setSaving(false); }
  };

  /* ─── change password ───────────────────────────────────────────── */
  const changePwd = async () => {
    if (!oldPwd || !newPwd)
      return setSnack({ open: true, msg: "Fill both password fields", sev: "error" });

    setLoadPwd(true);
    try {
      await apiFetch(ENDPOINTS.staff.password, {
        method: "PATCH",
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
      });
      setSnack({ open: true, msg: "Password updated!", sev: "success" });
      setOld(""); setNew("");
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Password change failed", sev: "error" });
    } finally { setLoadPwd(false); }
  };

  /* ─── copy text to clipboard ────────────────────────────────────── */
  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSnack({ open: true, msg: `${label} copied`, sev: "success" });
    } catch {
      setSnack({ open: true, msg: "Copy failed", sev: "error" });
    }
  };

  /* ─── add balance (calls your /adminwalletadd endpoint) ──────────── */
const addBalance = async () => {
  if (!canEdit) return;
  if (!balance) return setSnack({ open: true, msg: "Enter a balance amount", sev: "error" });

  const amount = Number(balance);
  if (Number.isNaN(amount) || !isFinite(amount)) {
    return setSnack({ open: true, msg: "Enter a valid number", sev: "error" });
  }

  setLoadingBal(true);
  try {
    // Direct call to external API
    const res = await apiFetch(ENDPOINTS.wallet.adjust, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount })
    });

    // Expecting { message: "...", balance: { staff_id, inr } }
    const inr = res?.balance?.inr;
    if (typeof inr !== "undefined") {
      setSnack({ open: true, msg: `Balance updated — ₹${inr}`, sev: "success" });
    } else {
      setSnack({ open: true, msg: "Balance updated!", sev: "success" });
    }
    setBalance("");
  } catch (e: any) {
    const msg = e?.message || e?.error || "Failed to add balance";
    setSnack({ open: true, msg, sev: "error" });
  } finally {
    setLoadingBal(false);
  }
};

  /* ─── EXECUTIVE branch ──────────────────────────────────────────────
     Executives don't sit in the staff table, so /api/staff/{id} returns
     nothing. Render a tailored read-only profile sourced from
     /lords/access/me/permissions. */
  const isExecutive = !!localStorage.getItem("executiveId");
  if (isExecutive) {
    return <ExecutiveAccountCard />;
  }

  /* ─── loading skeleton ──────────────────────────────────────────── */
  if (!me)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", bgcolor: "#0C0D1D" }}>
        <CircularProgress />
      </Box>
    );

  /* ===================================================================
     RENDER
     =================================================================== */
  return (
    <Box sx={{ p: 3, background: "#0C0D1D", minHeight: "100vh" }}>
      <Box sx={{ maxWidth: 800, mx: "auto" }}>
        <Stack spacing={3}>

          {/* ───────── Profile card ───────── */}
          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #1E2D55",
            background: "#0E1831" }}>
            <CardContent sx={{ p: 4 }}>
              {/* header */}
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3, alignItems: "center" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <Avatar sx={{ width: 80, height: 80, bgcolor: "#886CFF", fontSize: "2rem", fontWeight: 700 }}>
                    {(editMode ? field("name") : me.name).charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "#ffffff", mb: 1 }}>
                      {editMode ? field("name") : me.name}
                    </Typography>
                    <Chip label={me.role} size="small"
                      sx={{ bgcolor: "rgba(100,110,205,0.15)", color: "#886CFF", fontWeight: 600 }} />
                  </Box>
                </Box>

                {/* edit buttons */}
                {canEdit && (
                  editMode ? (
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <IconButton onClick={saveProfile} disabled={savingProf}
                        sx={{ bgcolor: "#10b981", color: "#fff", "&:hover": { bgcolor: "#059669" } }}>
                        {savingProf ? <CircularProgress size={20} /> : <Save size={20} />}
                      </IconButton>
                      <IconButton onClick={cancelEdit}
                        sx={{ bgcolor: "#dc2626", color: "#fff", "&:hover": { bgcolor: "#b91c1c" } }}>
                        <X size={20} />
                      </IconButton>
                    </Box>
                  ) : (
                    <IconButton onClick={startEdit}
                      sx={{ bgcolor: "#886CFF", color: "#fff", "&:hover": { bgcolor: "#9B82FF" } }}>
                      <Edit size={20} />
                    </IconButton>
                  )
                )}
              </Box>

              {/* grid of fields */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                {/* Name */}
                <ProfileRow icon={<User size={20} />} iconBg="#f0fdf4" iconColor="#16a34a"
                  label="Full Name" editMode={editMode}
                  value={editMode ? field("name") : me.name}
                  onChange={v => setED(d => ({ ...d, name: v }))} />
                {/* Email – readonly */}
                <ProfileRow icon={<Mail size={20} />} iconBg="#fffbeb" iconColor="#f59e0b"
                  label="Email" value={me.email} />
                {/* Phone */}
                <ProfileRow icon={<Phone size={20} />} iconBg="#f0f9ff" iconColor="#0ea5e9"
                  label="Phone Number" editMode={editMode}
                  value={editMode ? field("phone") : me.phone || "Not provided"}
                  onChange={v => setED(d => ({ ...d, phone: v }))} />
                {/* Country */}
                <ProfileRow icon={<Globe size={20} />} iconBg="#fdf2f8" iconColor="#ec4899"
                  label="Country" editMode={editMode}
                  value={editMode ? field("country") : me.country || "Not provided"}
                  onChange={v => setED(d => ({ ...d, country: v }))} />
              </Box>
            </CardContent>
          </Card>

          {/* ───────── Agent Code card ───────── */}
          {me.agent_code && (
            <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #1E2D55", bgcolor: "#0E1831" }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(136,108,255,0.15)", color: "#886CFF" }}>
                    <LinkIcon size={20} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#ffffff", fontSize: 18 }}>
                      Agent ID & Shareable Link
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                      Share this link or code — new players who sign up with it will be attached to you.
                    </Typography>
                  </Box>
                </Box>

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" sx={{ color: "#94a3b8", mb: 0.5, fontSize: 12 }}>
                      Agent ID
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        fullWidth
                        value={me.agent_code}
                        InputProps={{ readOnly: true }}
                        sx={{
                          "& .MuiOutlinedInput-root": { bgcolor: "#0C0D1D" },
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1E2D55" },
                          "& .MuiInputBase-input": { color: "#ffffff", fontFamily: "monospace", fontWeight: 600 }
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={() => copyText(me.agent_code!, "Agent ID")}
                        startIcon={<Copy size={18} />}
                        sx={{ bgcolor: "#886CFF", "&:hover": { bgcolor: "#9B82FF" } }}
                      >
                        Copy
                      </Button>
                    </Stack>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: "#94a3b8", mb: 0.5, fontSize: 12 }}>
                      Shareable Link
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        fullWidth
                        value={`${window.location.origin}/referal/${me.agent_code}`}
                        InputProps={{ readOnly: true }}
                        sx={{
                          "& .MuiOutlinedInput-root": { bgcolor: "#0C0D1D" },
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1E2D55" },
                          "& .MuiInputBase-input": { color: "#ffffff" }
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={() => copyText(`${window.location.origin}/referal/${me.agent_code}`, "Link")}
                        startIcon={<Copy size={18} />}
                        sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}
                      >
                        Copy
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* ───────── Password card (every staff role — change own password) ───────── */}
          {(
            <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #1E2D55", bgcolor: "#0E1831" }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(220,38,38,0.15)", color: "#ef4444" }}>
                    <Lock size={20} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#ffffff", fontSize: 18 }}>
                      Change Password
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                      Update your password to keep your account secure
                    </Typography>
                  </Box>
                </Box>

                <Stack spacing={3}>
                  <PwdField label="Current Password"
                    value={oldPwd} onChange={setOld}
                    show={showOld} setShow={setSO} />
                  <PwdField label="New Password"
                    value={newPwd} onChange={setNew}
                    show={showNew} setShow={setSN} />

                  <Button variant="contained" disabled={loadingPwd || !oldPwd || !newPwd}
                    onClick={changePwd}
                    startIcon={loadingPwd ? <CircularProgress size={20} /> : <Shield size={20} />}
                    sx={{ py: 1.5, px: 4, borderRadius: 2, bgcolor: "#886CFF",
                      fontWeight: 600, alignSelf: "flex-start",
                      "&:hover": { bgcolor: "#9B82FF" },
                      "&:disabled": { bgcolor: "#1E2D55" } }}>
                    {loadingPwd ? "Updating…" : "Update Password"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* ───────── Add Balance card (SuperAdmin only) ───────── */}
          {canEdit && (
            <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #1E2D55", bgcolor: "#0E1831" }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                    <Shield size={20} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#ffffff", fontSize: 18 }}>
                      Add Balance
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                      Credit balance to Superadmin Only
                    </Typography>
                  </Box>
                </Box>

                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Amount (INR)"
                    type="number"
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    sx={{ flex: 1,
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "#0C0D1D",
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" }
                      },
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1E2D55" },
                      "& .MuiInputLabel-root": { color: "#94a3b8" },
                      "& .MuiInputBase-input": { color: "#ffffff" }
                    }}
                  />
                  <Button
                    variant="contained"
                    disabled={loadingBal || !balance}
                    onClick={addBalance}
                    startIcon={loadingBal ? <CircularProgress size={20} /> : <Save size={20} />}
                    sx={{
                      borderRadius: 2,
                      bgcolor: "#10b981", fontWeight: 600,
                      "&:hover": { bgcolor: "#059669" },
                      "&:disabled": { bgcolor: "#1E2D55" }
                    }}
                  >
                    {loadingBal ? "Adding…" : "Add Balance"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* ───────── Email Notifications card (SuperAdmin only) ───────── */}
          {canEdit && (
            <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #1E2D55", bgcolor: "#0E1831" }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(255,194,63,0.15)", color: "#FFC23F" }}>
                    <Bell size={20} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#ffffff", fontSize: 18 }}>
                      Deposit / Withdrawal Email Alerts
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                      Set the inbox that receives payment-gateway alerts and the Gmail account used to send them.
                      Use a Gmail App Password (not your normal password).
                    </Typography>
                  </Box>
                </Box>

                <Stack spacing={2.5}>
                  <TextField
                    fullWidth label="Notification Email (receives alerts)"
                    value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
                    placeholder="alerts@yourdomain.com"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Mail size={18} style={{ color: "#94a3b8" }} /></InputAdornment> }}
                    sx={emailFieldSx}
                  />
                  <TextField
                    fullWidth label="Gmail Address (sends mail)"
                    value={gmailUser} onChange={e => setGmailUser(e.target.value)}
                    placeholder="yourgmail@gmail.com"
                    InputProps={{ startAdornment: <InputAdornment position="start"><User size={18} style={{ color: "#94a3b8" }} /></InputAdornment> }}
                    sx={emailFieldSx}
                  />
                  <TextField
                    fullWidth label={hasAppPwd ? "Gmail App Password (leave blank to keep current)" : "Gmail App Password"}
                    type={showAppPwd ? "text" : "password"}
                    value={gmailAppPwd} onChange={e => setGmailAppPwd(e.target.value)}
                    placeholder={hasAppPwd ? "•••••••••••• (saved)" : "16-character app password"}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><KeyRound size={18} style={{ color: "#94a3b8" }} /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button onClick={() => setShowAppPwd(s => !s)} sx={{ minWidth: "auto", p: 1, color: "#94a3b8", "&:hover": { bgcolor: "transparent" } }}>
                            {showAppPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                    sx={emailFieldSx}
                  />
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained" disabled={savingEmail} onClick={saveEmailSettings}
                      startIcon={savingEmail ? <CircularProgress size={18} /> : <Save size={18} />}
                      sx={{ bgcolor: "#886CFF", fontWeight: 600, "&:hover": { bgcolor: "#9B82FF" }, "&:disabled": { bgcolor: "#1E2D55" } }}
                    >
                      {savingEmail ? "Saving…" : "Save Settings"}
                    </Button>
                    <Button
                      variant="outlined" disabled={testingEmail} onClick={sendTestEmail}
                      startIcon={testingEmail ? <CircularProgress size={18} /> : <Send size={18} />}
                      sx={{ color: "#FFC23F", borderColor: "#FFC23F", fontWeight: 600, "&:hover": { borderColor: "#FFC23F", bgcolor: "rgba(255,194,63,0.08)" } }}
                    >
                      {testingEmail ? "Sending…" : "Send Test"}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* ───────── WhatsApp Referral Card ───────── */}
          {waRef && (
            <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #1E2D55", bgcolor: "#0E1831" }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: "#ffffff" }}>
                  Your WhatsApp Referral
                </Typography>
                <Typography sx={{ color: "#94a3b8" }}>
                  <strong style={{ color: "#ffffff" }}>Slug:</strong> {waRef.slug}
                </Typography>
                <Typography sx={{ color: "#94a3b8" }}>
                  <strong style={{ color: "#ffffff" }}>Phone:</strong> {waRef.phone}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    href={waRef.link}
                    target="_blank"
                    sx={{
                      textTransform: "none",
                      bgcolor: "#25D366", color: "#fff",
                      "&:hover": { bgcolor: "#128C7E" }
                    }}
                  >
                    Open in WhatsApp
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity={snack.sev} sx={{ borderRadius: 2, fontWeight: 500 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/* =======================================================================
   REUSABLE SMALL SUB-COMPONENTS
   ======================================================================= */
type RowProps = {
  icon: JSX.Element;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  editMode?: boolean;
  onChange?: (v: string) => void;
};
function ProfileRow({ icon, iconBg, iconColor, label, value, editMode, onChange }: RowProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: iconBg, color: iconColor }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ color: "#94a3b8", fontSize: 12 }}>{label}</Typography>
        {editMode && onChange
          ? <TextField variant="standard" value={value} onChange={e => onChange(e.target.value)}
            sx={{
              "& .MuiInput-underline:before": { borderBottomColor: "#1E2D55" },
              "& .MuiInput-underline:hover:before": { borderBottomColor: "#886CFF" },
              "& .MuiInput-underline:after": { borderBottomColor: "#886CFF" },
              "& .MuiInputBase-input": { color: "#ffffff" }
            }} />
          : <Typography variant="body1" sx={{ fontWeight: 600, color: "#ffffff" }}>{value}</Typography>}
      </Box>
    </Box>
  );
}

function PwdField({ label, value, onChange, show, setShow }: { label: string; value: string;
  onChange: (s: string) => void; show: boolean; setShow: (b: boolean) => void }) {
  return (
    <TextField fullWidth variant="outlined" label={label}
      type={show ? "text" : "password"} value={value}
      onChange={e => onChange(e.target.value)}
      InputProps={{
        startAdornment: <InputAdornment position="start">
          {label === "Current Password"
            ? <KeyRound size={20} style={{ color: "#94a3b8" }} />
            : <Lock size={20} style={{ color: "#94a3b8" }} />}
        </InputAdornment>,
        endAdornment: <InputAdornment position="end">
          <Button onClick={() => setShow(!show)}
            sx={{ minWidth: "auto", p: 1, color: "#94a3b8", "&:hover": { bgcolor: "transparent" } }}>
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </Button>
        </InputAdornment>
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          bgcolor: "#0C0D1D",
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" }
        },
        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1E2D55" },
        "& .MuiInputLabel-root": { color: "#94a3b8" },
        "& .MuiInputBase-input": { color: "#ffffff" }
      }} />
  );
}

/* =========================================================================
   EXECUTIVE ACCOUNT CARD
   Read-only profile for users logged in as Executive.
   Sources data from GET /lords/access/me/permissions which returns
   { role, permissions, profile }.
   ========================================================================= */
interface ExecMeResponse {
  role: string;
  permissions: { groups: Record<string, boolean>; pages: Record<string, boolean>; authority: Record<string, boolean> };
  profile?: {
    id: number;
    username: string;
    status: string;
    parentUsername?: string;
    parentRole?: string;
    lastLogin?: string;
    lastLoginIp?: string;
    createdAt?: string;
  };
}

function ExecutiveAccountCard() {
  const [data, setData] = useState<ExecMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ExecMeResponse>(ENDPOINTS.access.myPermissions)
      .then(setData)
      .catch((e: any) => setErr(e?.message || "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", bgcolor: "#0C0D1D" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (err || !data) {
    return (
      <Box sx={{ p: 4, color: "#E01B4F", textAlign: "center" }}>
        {err || "No profile data"}
      </Box>
    );
  }

  const p = data.profile;
  const pageCount  = ALL_PAGE_PATHS.filter(path => data.permissions?.pages?.[path]).length;
  const totalPages = ALL_PAGE_PATHS.length;
  const grantedAuthority = Object.entries(data.permissions?.authority ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  const fmt = (s?: string) => s ? new Date(s).toLocaleString() : "—";

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>
      <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ sm: "center" }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: "#886CFF", fontSize: "1.4rem", fontWeight: 700 }}>
              {(p?.username?.[0] || "E").toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: "#F9F9F9", fontSize: "1.15rem", fontWeight: 700 }}>
                {p?.username || "Executive"}
              </Typography>
              <Typography sx={{ color: "#8384A5", fontSize: "0.8rem" }}>
                Executive · ID #{p?.id ?? "—"}
                {p?.parentUsername && ` · under ${p.parentUsername}${p.parentRole ? ` (${p.parentRole})` : ""}`}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip
                  label={p?.status || "active"}
                  size="small"
                  sx={{
                    bgcolor: p?.status === "active" ? "rgba(14,204,104,0.12)" : "rgba(224,27,79,0.12)",
                    color:   p?.status === "active" ? "#0ECC68" : "#E01B4F",
                    fontWeight: 700, fontSize: "0.7rem", textTransform: "capitalize",
                  }} />
                <Chip label={`${pageCount} / ${totalPages} pages`} size="small"
                  sx={{ bgcolor: "rgba(136,108,255,0.12)", color: "#A08FFF", fontSize: "0.7rem" }} />
                <Chip label={`${grantedAuthority.length} actions`} size="small"
                  sx={{ bgcolor: "rgba(14,204,104,0.12)", color: "#0ECC68", fontSize: "0.7rem" }} />
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 }}>
        <CardContent>
          <Typography sx={{ color: "#F9F9F9", fontSize: "0.95rem", fontWeight: 700, mb: 1.5 }}>Account</Typography>
          <Stack spacing={1.25}>
            {[
              ["Username",      p?.username],
              ["Status",        p?.status],
              ["Parent",        p?.parentUsername ? `${p.parentUsername}${p.parentRole ? ` (${p.parentRole})` : ""}` : "—"],
              ["Created",       fmt(p?.createdAt)],
              ["Last login",    fmt(p?.lastLogin)],
              ["Last login IP", p?.lastLoginIp || "—"],
            ].map(([k, v]) => (
              <Stack key={k as string} direction="row" justifyContent="space-between"
                sx={{ borderBottom: "1px solid #1E2D5533", pb: 1 }}>
                <Typography sx={{ color: "#8384A5", fontSize: "0.82rem" }}>{k}</Typography>
                <Typography sx={{ color: "#F9F9F9", fontSize: "0.82rem", fontWeight: 600, fontFamily: "monospace" }}>
                  {String(v ?? "—")}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 }}>
        <CardContent>
          <Typography sx={{ color: "#F9F9F9", fontSize: "0.95rem", fontWeight: 700, mb: 1.5 }}>
            Granted Actions
          </Typography>
          {grantedAuthority.length === 0 ? (
            <Typography sx={{ color: "#8384A5", fontSize: "0.82rem" }}>
              No action permissions yet — your upline can grant them in Access Management.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {grantedAuthority.map(k => (
                <Chip key={k} label={k} size="small"
                  sx={{ bgcolor: "#10182E", color: "#F9F9F9", fontSize: "0.7rem", fontFamily: "monospace",
                    border: "1px solid #1E2D55" }} />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Typography sx={{ color: "#8384A5", fontSize: "0.72rem", textAlign: "center" }}>
        To change your password ask your upline to use the Reset Password action in Access Management.
      </Typography>
    </Box>
  );
}
