import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { Shield, ShieldCheck, ShieldAlert, Copy, CheckCircle, Eye, EyeOff } from "lucide-react";

import { apiFetch, ApiError } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";

/**
 * Two-factor authentication for the signed-in operator.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS SCREEN HAS TO EXIST
 *
 * Staff tokens carry `wallet:credit`, `withdrawals:approve` and `users:lock`
 * over other people's money, and until now they were protected by a password
 * alone — while PLAYERS could already enrol in TOTP and the player login
 * enforced it. The credential with the most authority on the platform had the
 * weakest protection.
 *
 * The backend refuses a session to any account at level 3 or above (super
 * admin, admin, sub-admin) that has not enrolled. Without a screen to enrol
 * FROM, that rule would simply lock those operators out — a security control
 * with no path through it is an outage, not a control. This is the path.
 *
 * ── EVERY CALL IS ABOUT THE CALLER ───────────────────────────────────────
 *
 * No staff id is sent anywhere here; the account comes from the verified
 * token. That is what makes "turn off someone else's second factor"
 * unexpressible rather than merely refused — which is exactly how the player
 * version of this went wrong, taking a `uid` from the request body on an
 * unauthenticated route.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface Status {
  isEnabled: boolean;
  hasInitiated: boolean;
  /** True when this operator's ROLE obliges them to enrol. */
  required: boolean;
  enrolledAt: string | null;
}

type Stage = "idle" | "scanning";

const CARD_SX = {
  background: "#0E1831",
  border: "1px solid #1E2D55",
  borderRadius: "16px",
  p: { xs: 2.5, sm: 4 },
  maxWidth: 640,
};

const inputSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#10182E",
    borderRadius: "12px",
    color: "#F9F9F9",
    "& fieldset": { borderColor: "#1E2D55" },
    "&:hover fieldset": { borderColor: "#886CFF" },
    "&.Mui-focused fieldset": { borderColor: "#886CFF" },
  },
  "& .MuiInputLabel-root": { color: "#8384A5", "&.Mui-focused": { color: "#A08FFF" } },
  "& .MuiFormHelperText-root": { color: "#8384A5" },
};

const TwoFactorSettings = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");

  const [qrCode, setQrCode] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [copied, setCopied] = useState(false);

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [disarming, setDisarming] = useState(false);

  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const say = (message: string, severity: "success" | "error" | "info" = "success") =>
    setToast({ open: true, message, severity });

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await apiFetch<Status>(ENDPOINTS.auth.twoFactorStatus));
    } catch (error) {
      say(error instanceof ApiError ? error.message : "Could not load your 2FA status", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  /**
   * Start enrolment.
   *
   * The secret is returned exactly once, here, for manual entry when a camera
   * is not available. It is never retrievable afterwards — which is why the
   * screen keeps it visible until the code is confirmed rather than clearing
   * it on the first mistyped digit.
   */
  const begin = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<{ qrCode: string; secret: string }>(ENDPOINTS.auth.twoFactorBegin, {
        method: "POST",
      });
      setQrCode(res.qrCode);
      setManualSecret(res.secret);
      setCode("");
      setStage("scanning");
    } catch (error) {
      say(error instanceof ApiError ? error.message : "Could not start 2FA setup", "error");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await apiFetch(ENDPOINTS.auth.twoFactorConfirm, { method: "POST", body: { code } });
      // Nothing about the secret survives the confirmation — an operator who
      // needs it again re-enrols, which issues a new one and invalidates the
      // old QR screenshot.
      setQrCode("");
      setManualSecret("");
      setCode("");
      setStage("idle");
      await loadStatus();
      say("Two-factor authentication is on. You will be asked for a code at your next sign-in.");
    } catch (error) {
      setCode("");
      say(error instanceof ApiError ? error.message : "That code was not accepted", "error");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await apiFetch(ENDPOINTS.auth.twoFactorDisable, { method: "POST", body: { code, password } });
      setCode("");
      setPassword("");
      setDisarming(false);
      await loadStatus();
      say("Two-factor authentication is off.", "info");
    } catch (error) {
      setCode("");
      say(error instanceof ApiError ? error.message : "Could not turn 2FA off", "error");
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(manualSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress sx={{ color: "#886CFF" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Card sx={CARD_SX}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 3 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: "14px",
              flexShrink: 0,
              background: status?.isEnabled
                ? "linear-gradient(135deg, #0ECC68, #0AA655)"
                : "linear-gradient(135deg, #886CFF, #A08FFF)",
            }}
          >
            {status?.isEnabled ? <ShieldCheck size={26} color="#fff" /> : <Shield size={26} color="#fff" />}
          </Box>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#F9F9F9" }}>
                Two-Factor Authentication
              </Typography>
              <Chip
                size="small"
                label={status?.isEnabled ? "On" : "Off"}
                sx={{
                  fontWeight: 600,
                  color: status?.isEnabled ? "#0ECC68" : "#8384A5",
                  backgroundColor: status?.isEnabled ? "rgba(14,204,104,0.12)" : "rgba(131,132,165,0.12)",
                }}
              />
              {status?.required && (
                <Chip
                  size="small"
                  label="Required for your role"
                  sx={{ fontWeight: 600, color: "#FFC23F", backgroundColor: "rgba(255,194,63,0.12)" }}
                />
              )}
            </Box>
            <Typography variant="body2" sx={{ color: "#8384A5" }}>
              A code from your phone, on top of your password. Your account can move other people&apos;s
              money — a password on its own is one phishing page away from someone else holding it.
            </Typography>
          </Box>
        </Box>

        {status?.required && !status.isEnabled && (
          <Alert severity="warning" sx={{ mb: 3, backgroundColor: "rgba(255,194,63,0.1)", color: "#FFC23F" }}>
            Your role requires two-factor authentication. You will not be able to sign in again until you
            finish enrolling here.
          </Alert>
        )}

        <Divider sx={{ borderColor: "#1E2D55", mb: 3 }} />

        {/* ── Enrolment ──────────────────────────────────────────────── */}
        {stage === "scanning" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Typography variant="body2" sx={{ color: "#8384A5" }}>
              Scan this with Google Authenticator, Authy or 1Password, then enter the code it shows.
            </Typography>

            {qrCode && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Box sx={{ p: 2, backgroundColor: "#fff", borderRadius: "12px", lineHeight: 0 }}>
                  <img src={qrCode} alt="Two-factor QR code" width={200} height={200} />
                </Box>
              </Box>
            )}

            <Box>
              <Typography variant="caption" sx={{ color: "#8384A5", display: "block", mb: 0.75 }}>
                No camera? Enter this key by hand instead:
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    letterSpacing: "0.06em",
                    color: "#F9F9F9",
                    backgroundColor: "#10182E",
                    border: "1px solid #1E2D55",
                    borderRadius: "10px",
                    px: 1.5,
                    py: 1.25,
                    wordBreak: "break-all",
                  }}
                >
                  {manualSecret}
                </Box>
                <IconButton onClick={copySecret} sx={{ color: copied ? "#0ECC68" : "#8384A5" }}>
                  {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
                </IconButton>
              </Box>
            </Box>

            <TextField
              fullWidth
              label="Code from your app"
              placeholder="123456"
              /* Never type="number" — it drops the leading zero from a code
                 like 012345, so one in ten codes fails for no visible reason. */
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(digitsOnly(e.target.value))}
              helperText="6 digits. It changes every 30 seconds."
              sx={inputSx}
            />

            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button
                variant="contained"
                disabled={busy || code.length !== 6}
                onClick={confirm}
                sx={{
                  flex: 1,
                  background: "linear-gradient(135deg, #886CFF, #A08FFF)",
                  borderRadius: "12px",
                  textTransform: "none",
                  fontWeight: 600,
                  py: 1.25,
                }}
              >
                {busy ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Turn on"}
              </Button>
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() => {
                  setStage("idle");
                  setQrCode("");
                  setManualSecret("");
                  setCode("");
                }}
                sx={{
                  borderRadius: "12px",
                  textTransform: "none",
                  color: "#8384A5",
                  borderColor: "#1E2D55",
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Off, and not enrolling ─────────────────────────────────── */}
        {stage === "idle" && !status?.isEnabled && (
          <Button
            variant="contained"
            disabled={busy}
            onClick={begin}
            sx={{
              background: "linear-gradient(135deg, #886CFF, #A08FFF)",
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 600,
              py: 1.25,
              px: 3,
            }}
          >
            {busy ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Set up two-factor authentication"}
          </Button>
        )}

        {/* ── On ─────────────────────────────────────────────────────── */}
        {stage === "idle" && status?.isEnabled && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, color: "#0ECC68" }}>
              <ShieldCheck size={18} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Active
                {status.enrolledAt ? ` since ${new Date(status.enrolledAt).toLocaleDateString()}` : ""}
              </Typography>
            </Box>

            {!disarming ? (
              <Box>
                <Button
                  variant="text"
                  disabled={status.required}
                  onClick={() => setDisarming(true)}
                  startIcon={<ShieldAlert size={18} />}
                  sx={{ textTransform: "none", color: status.required ? "#5A5D75" : "#E01B4F", px: 0 }}
                >
                  Turn off two-factor authentication
                </Button>
                {status.required && (
                  <Typography variant="caption" sx={{ color: "#8384A5", display: "block" }}>
                    Your role requires it, so it cannot be turned off. Ask an administrator if your role
                    needs to change.
                  </Typography>
                )}
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Alert severity="error" sx={{ backgroundColor: "rgba(224,27,79,0.1)", color: "#E01B4F" }}>
                  Turning this off leaves your password as the only thing protecting an account that can
                  move other people&apos;s balances.
                </Alert>

                {/* Both a code AND the password: a stolen session alone must
                    not be able to strip the second factor, or 2FA is removable
                    by exactly the attack it exists to survive. */}
                <TextField
                  fullWidth
                  label="Current code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(digitsOnly(e.target.value))}
                  sx={inputSx}
                />
                <TextField
                  fullWidth
                  label="Your password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={inputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "#8384A5" }}>
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={busy || code.length !== 6 || !password}
                    onClick={disable}
                    sx={{ borderRadius: "12px", textTransform: "none", fontWeight: 600 }}
                  >
                    {busy ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Turn off"}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() => {
                      setDisarming(false);
                      setCode("");
                      setPassword("");
                    }}
                    sx={{ borderRadius: "12px", textTransform: "none", color: "#8384A5", borderColor: "#1E2D55" }}
                  >
                    Keep it on
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Card>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TwoFactorSettings;
