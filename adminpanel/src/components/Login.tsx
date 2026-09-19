import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertColor,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import { Eye, EyeOff, Lock, Mail, Shield, Key, Copy, CheckCircle } from "lucide-react";
import BrandLogo from "./BrandLogo";
import {
  BRAND_NAME,
  BRAND_PRIMARY,
  BRAND_PRIMARY_DEEP,
  BRAND_PRIMARY_HOVER,
  BRAND_PRIMARY_LIGHT,
} from "../constants/branding";
import { apiFetch, ApiError } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";
import * as lordsApi from "../services/lordsApi";

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

const LoginPage = () => {
  const [formData, setFormData] = useState<FormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [snackbar, setSnackbar] = useState<SnackbarState>({ severity: "success", message: "", open: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /**
   * The second-factor code.
   *
   * Held separately from `formData` and revealed only after the server says
   * this account has 2FA — the panel cannot know that up front, and it must
   * not: an endpoint that reported "this account has 2FA" before the password
   * was proven would enumerate staff accounts for anyone who posted an email.
   *
   * So the flow is: submit credentials, get TWO_FACTOR_REQUIRED, show the
   * field with the email and password still filled in, submit again.
   */
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);

  // First-login flow states
  const [stage, setStage] = useState<"login" | "change-password" | "show-txn-password">("login");
  const [firstLoginStaffId, setFirstLoginStaffId] = useState<number | null>(null);
  const [firstLoginToken, setFirstLoginToken] = useState("");
  const [firstLoginUser, setFirstLoginUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [txnPassword, setTxnPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prevFormData => ({ ...prevFormData, [name]: value }));
    // Clear errors when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    let valid = true;
    let errors: FormErrors = {};

    if (!formData.email) {
      valid = false;
      errors.email = "Email or username is required";
    } else if (formData.email.includes('@') && !/\S+@\S+\.\S+/.test(formData.email)) {
      // Only validate email format if the input contains @ symbol
      valid = false;
      errors.email = "Please enter a valid email";
    }

    if (!formData.password) {
      valid = false;
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      valid = false;
      errors.password = "Password must be at least 6 characters";
    }

    setErrors(errors);
    return valid;
  };

  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const loginClick = async () => {
    // 1. basic front-end validation
    if (!validateForm()) return;

    setLoading(true);
    const loginIdentifier = formData.email.trim().toLowerCase();
    const pwd = formData.password;

    try {
      /* ───────────────────────────────────────────────
         2. Online login.
         If the identifier looks like an email → staff login.
         Otherwise → executive login (username + password).
         ─────────────────────────────────────────────── */
      // The v1 paths directly. `/api/staff/auth/*` only reaches these through
      // the gateway's legacy rewrite table, which is a compatibility shim for
      // clients that cannot be changed — this one can.
      const isEmail = /\S+@\S+\.\S+/.test(loginIdentifier);
      const code = twoFactorCode.trim();
      const credentialBody = {
        password: pwd,
        ...(code ? { twoFactorCode: code } : {}),
      };

      const staffLogin = () =>
        apiFetch(ENDPOINTS.auth.login, {
          method: "POST",
          body: { email: loginIdentifier, ...credentialBody },
        });

      const executiveLogin = () =>
        apiFetch(ENDPOINTS.auth.executiveLogin, {
          method: "POST",
          body: { username: loginIdentifier, ...credentialBody },
        });

      /**
       * The sign-in answer is `{token, firstLogin, hasTransactionPassword, actor}`.
       *
       * ── IT IS `actor`, AND THE ROLE IS A STRING ──────────────────────
       *
       * This read `res.user.role.name`. There is no `user` key and no nested
       * `role` object, so the line threw a TypeError on a SUCCESSFUL login —
       * which the `catch` below swallowed as "API login failed", dropping a
       * correct password through to the demo-credential fallback and failing
       * there. The id is `staffId`, not `id`, and the role is `roleName`.
       */
      type LoginResponse = {
        token: string;
        firstLogin?: boolean;
        hasTransactionPassword?: boolean;
        actor: {
          staffId: number;
          name: string;
          email?: string | null;
          roleId: number;
          roleName: string;
          level: number;
          executiveId?: number | null;
          executiveUsername?: string | null;
          permissions: string[];
        };
      };

      let res: LoginResponse;
      if (isEmail) {
        res = await staffLogin();
      } else {
        try {
          res = await staffLogin();
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            res = await executiveLogin();
          } else {
            throw err;
          }
        }
      }

      const actor = res.actor;
      const roleName = actor.roleName;       // e.g. "Super Admin", "Admin", "Executive", …

      if (roleName === "User") {
        setSnackbar({ severity: "error", message: "Users can't access the admin panel.", open: true });
        setLoading(false);
        return;
      }

      // Check if first login — force password change
      if (res.firstLogin) {
        setFirstLoginStaffId(actor.staffId);
        setFirstLoginToken(res.token);
        setFirstLoginUser(actor);
        setStage("change-password");
        setLoading(false);
        return;
      }

      // 3. persist auth
      localStorage.setItem("token", res.token);
      localStorage.setItem("userRole", roleName);
      localStorage.setItem("userEmail", actor.email || actor.executiveUsername || "");
      localStorage.setItem("userName", actor.name);
      localStorage.setItem("currentUserId", String(actor.staffId));
      if (actor.executiveId) {
        localStorage.setItem("executiveId", String(actor.executiveId));
      } else {
        localStorage.removeItem("executiveId");
      }

      setSnackbar({ severity: "success", message: `Welcome ${actor.name}!`, open: true });
      navigate("/admin-management", { replace: true });
      return;                               // stop here on success
    } catch (apiErr: any) {
      /**
       * ═══════════════════════════════════════════════════════════════
       * THE SERVER'S ANSWER IS THE ONLY ANSWER
       *
       * This `catch` used to fall through to three more attempts: a pair of
       * hardcoded credentials compiled into the bundle, and an `adminUsers`
       * array read out of `localStorage`. Either one wrote a made-up token
       * (`static-demo` / `local-admin`) and navigated into the admin shell.
       *
       * `ProtectedRoutes` only checked that *some* token string existed, so
       * both fakes rendered the full operator console. The API calls behind it
       * answered 401 — but the passwords were published in the bundle and in
       * the shipped source map, and the `adminUsers` path let anyone with
       * devtools mint a session by writing one localStorage key.
       *
       * There is no offline mode for an admin panel that administers money.
       * A failed sign-in ends here.
       * ═══════════════════════════════════════════════════════════════
       */
      const status = apiErr?.status;
      const errorCode = apiErr?.code;

      /**
       * The second factor is a STAGE, not a failure.
       *
       * `TWO_FACTOR_REQUIRED` means the password was right and this account has
       * 2FA on. The email and password stay in the form, the code field
       * appears, and the operator submits once more — re-typing a password
       * because a code was needed is the kind of friction that gets a security
       * control switched off.
       */
      if (errorCode === "STAFF_AUTH_TWO_FACTOR_REQUIRED") {
        setNeedsCode(true);
        setSnackbar({
          severity: "info",
          message: "Enter the 6-digit code from your authenticator app",
          open: true,
        });
        setLoading(false);
        return;
      }

      if (errorCode === "STAFF_AUTH_TWO_FACTOR_INVALID") {
        setNeedsCode(true);
        setTwoFactorCode("");
        setSnackbar({ severity: "error", message: apiErr.message, open: true });
        setLoading(false);
        return;
      }

      // The role requires 2FA and this account has not enrolled. Nothing the
      // operator can do by retrying, so the message says who to ask.
      if (errorCode === "STAFF_AUTH_TWO_FACTOR_ENROLMENT_REQUIRED") {
        setNeedsCode(false);
        setSnackbar({ severity: "warning", message: apiErr.message, open: true });
        setLoading(false);
        return;
      }

      const message =
        status === 401 || status === 403
          ? "Invalid email/username or password"
          : status === 429
          ? "Too many sign-in attempts. Wait a few minutes and try again."
          : apiErr?.message && status
          ? apiErr.message
          : "Cannot reach the server. Check your connection and try again.";

      setSnackbar({ severity: "error", message, open: true });
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loginClick();
  };

  /* ─── Shared sx tokens ─── */
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#10182E',
      borderRadius: '12px',
      color: '#F9F9F9',
      '& fieldset': {
        borderColor: '#1E2D55',
      },
      '&:hover fieldset': {
        borderColor: BRAND_PRIMARY,
      },
      '&.Mui-focused fieldset': {
        borderColor: BRAND_PRIMARY,
      },
    },
    '& .MuiInputLabel-root': {
      color: '#8384A5',
      '&.Mui-focused': {
        color: BRAND_PRIMARY_HOVER,
      },
    },
    '& .MuiFormHelperText-root': {
      color: '#E01B4F',
    },
  };

  return (
    <>
      {/* Full-page background */}
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0C0D1D 0%, #0E1831 50%, #172244 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          px: 2,
        }}
      >
        {/* Decorative glow orbs */}
        <Box
          sx={{
            position: 'absolute',
            top: '20%',
            left: '20%',
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: BRAND_PRIMARY_LIGHT,
            filter: 'blur(100px)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '15%',
            right: '18%',
            width: 340,
            height: 340,
            borderRadius: '50%',
            background: 'rgba(119, 23, 255, 0.10)',
            filter: 'blur(100px)',
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Card
            elevation={0}
            sx={{
              backgroundColor: 'rgba(14, 24, 49, 0.8)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(30, 45, 85, 0.5)',
              borderRadius: '20px',
              p: { xs: 4, sm: 5 },
              maxWidth: 440,
              mx: 'auto',
            }}
          >
            {/* ════════════════ STAGE: LOGIN ════════════════ */}
            {stage === "login" && (
              <>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <BrandLogo wordmark height={32} />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#F9F9F9', mb: 0.5 }}>{BRAND_NAME} Admin</Typography>
                  <Typography variant="body2" sx={{ color: '#8384A5' }}>Secure access to the operator dashboard</Typography>
                </Box>
                <Box component="form" onSubmit={handleSubmit} noValidate>
                  <TextField fullWidth name="email" id="email" label="Email" placeholder="Enter your email or username" autoComplete="email"
                    value={formData.email} onChange={handleChange} error={!!errors.email} helperText={errors.email}
                    sx={{ ...inputSx, mb: 3 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Mail size={20} color="#8384A5" /></InputAdornment> }} />
                  <TextField fullWidth name="password" id="password" label="Password" placeholder="Enter your password"
                    type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    value={formData.password} onChange={handleChange} error={!!errors.password} helperText={errors.password}
                    sx={{ ...inputSx, mb: 3.5 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Lock size={20} color="#8384A5" /></InputAdornment>,
                      endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#8384A5' }}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</IconButton></InputAdornment>,
                    }} />

                  {/* ── Second factor ──────────────────────────────────────
                      Appears only after the server has said this account has
                      2FA. Whether it does is not knowable until the password
                      is proven, and asking earlier would tell anyone who
                      posted an email which staff accounts exist. */}
                  {needsCode && (
                    <TextField fullWidth name="twoFactorCode" id="twoFactorCode"
                      label="Authenticator code" placeholder="123456"
                      /* `text` with a numeric inputMode, never type="number":
                         a number input strips the leading zero from a code
                         like 012345, which is one in ten codes silently
                         failing and getting blamed on the phone. */
                      type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      helperText="6-digit code from your authenticator app"
                      sx={{ ...inputSx, mb: 3.5 }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><Shield size={20} color="#8384A5" /></InputAdornment>,
                      }} />
                  )}

                  <Button type="submit" variant="contained" fullWidth
                    disabled={loading || (needsCode && twoFactorCode.length !== 6)}
                    sx={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY_DEEP}, ${BRAND_PRIMARY})`, borderRadius: '12px', textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', py: 1.5,
                      boxShadow: '0 4px 20px rgba(136, 108, 255, 0.35)', '&:hover': { background: `linear-gradient(135deg, #5F12CC, ${BRAND_PRIMARY_HOVER})`, transform: 'scale(1.02)' },
                      '&.Mui-disabled': { background: `linear-gradient(135deg, ${BRAND_PRIMARY_DEEP}, ${BRAND_PRIMARY})`, opacity: 0.7, color: '#fff' } }}>
                    {loading
                      ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={20} sx={{ color: '#fff' }} /><span>Signing in...</span></Box>
                      : needsCode ? 'Verify and sign in' : 'Sign in to Dashboard'}
                  </Button>
                </Box>
              </>
            )}

            {/* ════════════════ STAGE: CHANGE PASSWORD ════════════════ */}
            {stage === "change-password" && (
              <>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FFC23F, #FF9800)', borderRadius: '14px', width: 56, height: 56, mb: 2 }}>
                    <Key size={28} color="#fff" />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#F9F9F9', mb: 0.5 }}>First Login — Set New Password</Typography>
                  <Typography variant="body2" sx={{ color: '#8384A5' }}>
                    Welcome! For security, please set a new password to continue.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <TextField fullWidth label="New Password" placeholder="At least 12 characters" type="password"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    error={newPassword.length > 0 && newPassword.length < 12}
                    helperText={
                      newPassword.length > 0 && newPassword.length < 12
                        ? "Password must be at least 12 characters"
                        : "Use a different password from the one you just signed in with"
                    }
                    sx={inputSx}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Lock size={20} color="#8384A5" /></InputAdornment> }} />
                  <TextField fullWidth label="Confirm New Password" placeholder="Repeat your new password" type="password"
                    value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                    error={confirmNewPassword.length > 0 && newPassword !== confirmNewPassword}
                    helperText={confirmNewPassword.length > 0 && newPassword !== confirmNewPassword ? "Passwords do not match" : ""}
                    sx={inputSx}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Lock size={20} color="#8384A5" /></InputAdornment> }} />
                  <Button variant="contained" fullWidth disabled={loading || !newPassword || newPassword !== confirmNewPassword || newPassword.length < 12}
                    onClick={async () => {
                      setLoading(true);
                      try {
                        /**
                         * `{email, currentPassword, newPassword}`, `.strict()`.
                         *
                         * This called `(staffId, newPassword)` — two positional
                         * arguments against a one-object signature, so the body
                         * that reached the server was the staff id and the
                         * password never changed. There is no
                         * `transactionPassword` on the answer either: the route
                         * re-issues a SESSION, exactly like `/login`, and the
                         * separate transaction password is set from the profile
                         * screen. So this completes the sign-in rather than
                         * showing a code the server never sent.
                         */
                        const loginEmail =
                          firstLoginUser?.email?.trim().toLowerCase() ||
                          formData.email.trim().toLowerCase();

                        const res = await lordsApi.firstLoginPassword({
                          email: loginEmail,
                          currentPassword: formData.password,
                          newPassword,
                        });

                        localStorage.setItem("token", res.token ?? firstLoginToken);
                        localStorage.setItem("userRole", res.actor?.roleName ?? firstLoginUser?.roleName ?? "");
                        localStorage.setItem("userEmail", res.actor?.email ?? firstLoginUser?.email ?? "");
                        localStorage.setItem("userName", res.actor?.name ?? firstLoginUser?.name ?? "");
                        localStorage.setItem("currentUserId", String(res.actor?.staffId ?? firstLoginUser?.staffId ?? ""));

                        setSnackbar({ severity: "success", message: "Password updated — signing you in.", open: true });
                        navigate("/admin-management", { replace: true });
                      } catch (e: any) {
                        const fieldMessages = Array.isArray(e?.details)
                          ? e.details.map((d: { message?: string }) => d.message).filter(Boolean).join(" ")
                          : "";
                        setSnackbar({
                          severity: "error",
                          message: fieldMessages || e?.message || "Failed to change password",
                          open: true,
                        });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    sx={{ background: 'linear-gradient(135deg, #FFC23F, #FF9800)', borderRadius: '12px', textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', py: 1.5, color: '#0C0D1D',
                      '&:hover': { background: 'linear-gradient(135deg, #FFB300, #E68900)' },
                      '&.Mui-disabled': { opacity: 0.5, color: '#0C0D1D' } }}>
                    {loading ? <CircularProgress size={20} /> : 'Set Password & Continue'}
                  </Button>
                </Box>
              </>
            )}

            {/* ════════════════ STAGE: SHOW TRANSACTION PASSWORD ════════════════ */}
            {stage === "show-txn-password" && (
              <>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0ECC68, #0BB858)', borderRadius: '14px', width: 56, height: 56, mb: 2 }}>
                    <CheckCircle size={28} color="#fff" />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#F9F9F9', mb: 0.5 }}>Your Transaction Password</Typography>
                  <Typography variant="body2" sx={{ color: '#8384A5' }}>
                    This 8-digit password is required for all sensitive operations (transfers, credit changes, status updates). Save it securely — it will not be shown again.
                  </Typography>
                </Box>

                <Box sx={{ bgcolor: '#10182E', border: '2px solid #0ECC68', borderRadius: '16px', p: 3, textAlign: 'center', mb: 3 }}>
                  <Typography sx={{ color: '#8384A5', fontSize: 12, mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>Transaction Password</Typography>
                  <Typography sx={{ color: '#0ECC68', fontSize: 36, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 6 }}>
                    {txnPassword}
                  </Typography>
                  <Button size="small" startIcon={copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    onClick={() => { navigator.clipboard.writeText(txnPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    sx={{ mt: 1, color: copied ? '#0ECC68' : '#8384A5', textTransform: 'none' }}>
                    {copied ? 'Copied!' : 'Copy to clipboard'}
                  </Button>
                </Box>

                <Box sx={{ bgcolor: 'rgba(255,194,63,0.08)', border: '1px solid rgba(255,194,63,0.3)', borderRadius: '12px', p: 2, mb: 3 }}>
                  <Typography sx={{ color: '#FFC23F', fontSize: 13, fontWeight: 600, mb: 0.5 }}>Important</Typography>
                  <Typography sx={{ color: '#8384A5', fontSize: 12 }}>
                    Write down this password and keep it safe. You will need it to perform transfers, change credit limits, update user status, and other administrative actions.
                  </Typography>
                </Box>

                <Button variant="contained" fullWidth
                  onClick={() => {
                    // Now complete the login
                    localStorage.setItem("token", firstLoginToken);
                    localStorage.setItem("userRole", firstLoginUser.roleName);
                    localStorage.setItem("userEmail", firstLoginUser.email || "");
                    localStorage.setItem("userName", firstLoginUser.name);
                    localStorage.setItem("currentUserId", String(firstLoginUser.staffId));
                    navigate("/admin-management", { replace: true });
                  }}
                  sx={{ background: 'linear-gradient(135deg, #0ECC68, #0BB858)', borderRadius: '12px', textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', py: 1.5, color: '#fff',
                    '&:hover': { background: 'linear-gradient(135deg, #0BB858, #099E4A)' } }}>
                  I've saved my password — Continue to Dashboard
                </Button>
              </>
            )}
          </Card>

          <Typography variant="body2" sx={{ textAlign: 'center', mt: 3, color: '#8384A5' }}>
            &copy; 2026 {BRAND_NAME} Admin. All rights reserved.
          </Typography>
        </Container>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default LoginPage;
