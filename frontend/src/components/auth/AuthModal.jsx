import { useEffect, useState } from "react";
import { cx } from "../../lib/carousel";
import { useSession } from "../../lib/sessionContext";
import { ApiError, NetworkError } from "../../lib/api";
import { auth as authApi } from "../../lib/endpoints";
import Modal from "../ui/Modal";
import { clearStoredReferral, normalizeReferralInput, readStoredReferral } from "../../lib/referralCapture";
import { usePublicSiteConfig } from "../../lib/usePublicSiteConfig";
import { useSiteFeatures } from "../../lib/useSiteFeatures";

/**
 * Login / Register modal — a 1:1 port of the reference AuthModal
 * (left artwork panel, tab outline, forms, OAuth buttons).
 */

const oauth = [
  { id: "Google", icon: "/icons/brands/google.svg" },
  { id: "Line", icon: "/icons/brands/line.svg" },
  { id: "Telegram", icon: "/icons/brands/telegram.svg" },
];


/** Inline validation message — reference `ErrorMessage` (rendered under the field). */
function ErrorMessage({ children }) {
  return children ? (
    <div className="ErrorMessage_root" role="alert">
      {children}
    </div>
  ) : null;
}

function TextField({ label, name, placeholder, type = "text", inputMode, autoComplete, value, onChange, error }) {
  return (
    <div className="TextInput_formControlWrapper">
      <div className="TextInput_labelGroup">
        <div className="LabelBlock_root TextInput_labelBlock">
          <label className="TextInput_label" htmlFor={`auth-${name}`}>
            <span>{label}</span>
          </label>
        </div>
      </div>
      <div className="InputWrapper_root">
        <input
          id={`auth-${name}`}
          className={cx("Input_root", error && "Input_hasError")}
          placeholder={placeholder}
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}

function PasswordField({ forgot = false, onForgot, value, onChange, error, autoComplete = "current-password" }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="FormControlWrapper_root">
        <label className="Label_root" htmlFor="auth-password">
          Password*
        </label>
        <div className="InputWrapper_root">
          <input
            id="auth-password"
            placeholder="Enter Password"
            className={cx("Input_root Input_hasRightIcon", error && "Input_hasError")}
            type={shown ? "text" : "password"}
            name="password"
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
          />
          <button type="button" className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_icon Icon_root" aria-label={shown ? "Hide password" : "Show password"} onClick={() => setShown((s) => !s)}>
            <span className="ButtonVariants_buttonContent Icon_backgroundColor">
              <img alt="eye" src="/icons/eye-outline.svg" />
            </span>
          </button>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
      </div>
      {forgot && (
        <button className="PasswordInput_forgotPasswordText" type="button" onClick={onForgot}>
          Forgot Password?
        </button>
      )}
    </div>
  );
}

function OauthButtons() {
  return (
    <div className="OauthButtons_oauthButtonGroup">
      {oauth.map((o) => (
        <button key={o.id} type="button" value={o.id} aria-label={`Continue with ${o.id}`} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_secondary ButtonVariants_hasIcon">
          <span className="ButtonVariants_buttonContent">
            <span className="ButtonIcon_root">
              <img alt={o.id} height="16" src={o.icon} width="16" />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[A-Za-z0-9_]+$/;

const rules = {
  identifier: (v) => (!v.trim() ? "Email or Username is required" : null),
  username: (v) =>
    !v.trim()
      ? "Username is required"
      : v.length < 3
        ? "Username must be at least 3 characters"
        : v.length > 16
          ? "Username must be at most 16 characters"
          : !USERNAME.test(v)
            ? "Username can only contain letters, numbers and underscores"
            : null,
  email: (v) => (!v.trim() ? "Email is required" : !EMAIL.test(v) ? "Please enter a valid email address" : null),
  // 10, not 8 — the backend's register schema is `min(10)` with no character-class
  // rule, and a floor of 8 here would only buy the user a 422 after submitting.
  password: (v) => (!v ? "Password is required" : v.length < 10 ? "Password must be at least 10 characters" : null),
  loginPassword: (v) => (!v ? "Password is required" : null),
  terms: (v) => (v ? null : "You must agree to the Terms of Service and Privacy Policy"),
};

/** Runs validators over a values object; returns {field: message} for failures only. */
const validate = (fields, values) =>
  Object.fromEntries(
    Object.entries(fields)
      .map(([k, rule]) => [k, rule(values[k])])
      .filter(([, msg]) => msg)
  );

/** Form state: validate on submit, then re-validate live while the user corrects fields (reference behaviour). */
function useForm(initial, fields) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const set = (k) => (v) => {
    const next = { ...values, [k]: v };
    setValues(next);
    if (submitted) setErrors(validate(fields, next));
  };

  const submit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(fields, values);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /**
   * Field errors the backend found that the client could not.
   *
   * A 422 carries `details.fields[]` with a dotted `field` naming the request
   * part — except the body, whose prefix is stripped because that is where a
   * form's own field names live. So a body error's `field` already matches the
   * key here. They are merged rather than replacing the client's, and the next
   * keystroke re-runs local validation and clears them.
   */
  const setFieldErrors = (serverErrors) => setErrors((prev) => ({ ...prev, ...serverErrors }));

  return { values, errors, set, submit, setFieldErrors };
}

/**
 * What to show above the form when a submit fails.
 *
 * Branches on `error.code`, never `error.message` — API-ROUTES §5 is explicit
 * that the message is written for a human and may be reworded, so matching on
 * it would break silently. Codes are stable and declared at the module.
 *
 * `AUTH_INVALID_CREDENTIALS` is deliberately given the reference's own wording:
 * it must not say whether the username or the password was the wrong half.
 */
function authMessage(error) {
  if (error instanceof NetworkError) return "Could not reach the server. Check your connection and try again.";
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";

  switch (error.code) {
    case "AUTH_INVALID_CREDENTIALS":
    case "UNAUTHORIZED":
      return "Invalid username or password";
    case "AUTH_ACCOUNT_LOCKED":
      return "This account is locked. Contact support.";
    case "AUTH_ACCOUNT_INACTIVE":
      return "This account is not active.";
    case "AUTH_TWO_FACTOR_REQUIRED":
      return "Enter the 6-digit code from your authenticator app.";
    case "CONFLICT":
      // The unique constraint names the column it tripped on.
      return error.details?.fields?.includes("email")
        ? "That email is already registered."
        : "That username is already taken.";
    case "TOO_MANY_REQUESTS":
      return `Too many attempts. Try again in ${Math.ceil((error.details?.retryAfter || 60) / 60)} minute(s).`;
    case "VALIDATION_ERROR":
      // The individual fields are marked inline; the banner would repeat them.
      return null;
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

function LoginForm({ onDone }) {
  const { login } = useSession();
  const form = useForm({ identifier: "", password: "" }, { identifier: rules.identifier, password: rules.loginPassword });
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  /**
   * Begin a password reset.
   *
   * The identifier field takes a username OR an email, but `forgot-password`
   * takes an address only — so an entry without an `@` is refused here rather
   * than sent to be rejected. The reply is deliberately identical whether or
   * not the address is registered (the service computes it before it branches,
   * so the two paths cost the same time), and this must not undo that by
   * saying anything more specific.
   */
  const onForgot = async () => {
    setStatus(null);
    setNotice(null);
    const email = form.values.identifier.trim();
    if (!EMAIL.test(email)) {
      setStatus("Enter the email address on your account, then choose Forgot Password.");
      return;
    }
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setNotice("If that address has an account, a reset link is on its way.");
    } catch (error) {
      setStatus(authMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e) => {
    if (!form.submit(e)) {
      setStatus(null);
      return;
    }
    setBusy(true);
    setStatus(null);
    setNotice(null);
    try {
      await login(form.values.identifier, form.values.password);
      // The modal closes on success; the header re-renders from the session.
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") form.setFieldErrors(error.fieldErrors());
      setStatus(authMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form id="login-form" className="Form_root" noValidate onSubmit={onSubmit}>
        {status && (
          <div className="ErrorMessage_root Register_errorMessage" role="alert">
            {status}
          </div>
        )}
        {notice && (
          <div className="ErrorMessage_root Register_errorMessage" style={{ color: "var(--color-success)" }} role="status">
            {notice}
          </div>
        )}
        <TextField
          label="Email or Username*"
          name="username"
          placeholder="Enter Email or Username"
          autoComplete="username"
          value={form.values.identifier}
          onChange={form.set("identifier")}
          error={form.errors.identifier}
        />
        <PasswordField forgot onForgot={onForgot} value={form.values.password} onChange={form.set("password")} error={form.errors.password} />
        <div className="Login_buttonGroup">
          <button type="submit" form="login-form" disabled={busy} className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary">
            <span className="ButtonVariants_buttonContent">{busy ? "Logging in…" : "Login"}</span>
          </button>
          <div className="Login_textNote">Or continue with</div>
        </div>
      </form>
      <OauthButtons />
    </div>
  );
}

function RegisterForm({ onDone }) {
  const { register } = useSession();
  const { registerBonus, registerBonusCurrency } = usePublicSiteConfig();
  const initialReferrer = readStoredReferral();
  const [referralOpen, setReferralOpen] = useState(() => Boolean(initialReferrer));
  const form = useForm(
    { username: "", email: "", password: "", referrerCode: initialReferrer, terms: false },
    { username: rules.username, email: rules.email, password: rules.password, terms: rules.terms }
  );
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    if (!form.submit(e)) {
      setStatus(null);
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      /**
       * `.strict()` on the register schema: an unexpected key is a 422, not a
       * silently dropped field. So `referredBy` is only sent when it has a
       * value, and `terms` — a client-side gate with no column behind it —
       * is not sent at all.
       */
      const referredBy = normalizeReferralInput(form.values.referrerCode.trim() || readStoredReferral());
      await register({
        username: form.values.username,
        email: form.values.email,
        password: form.values.password,
        ...(referredBy ? { referredBy } : {}),
      });
      // `register` signs in as its second step, so this closes onto a session.
      clearStoredReferral();
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") form.setFieldErrors(error.fieldErrors());
      setStatus(authMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="Flex_root Flex_column Flex_sm4">
      <form className="Register_form" id="register-form" noValidate onSubmit={onSubmit}>
        <div className="Register_formBody">
          {status && (
            <div className="ErrorMessage_root Register_errorMessage" role="alert">
              {status}
            </div>
          )}
          <TextField label="Username*" name="username" placeholder="Enter Username" autoComplete="username" value={form.values.username} onChange={form.set("username")} error={form.errors.username} />
          <TextField label="Email*" name="email" placeholder="Enter Email" inputMode="email" autoComplete="email" value={form.values.email} onChange={form.set("email")} error={form.errors.email} />
          <PasswordField value={form.values.password} onChange={form.set("password")} error={form.errors.password} autoComplete="new-password" />
        </div>
        <input type="hidden" name="cxd" value="" />
        {Number.parseFloat(registerBonus) > 0 && (
          <p className="TermAndPolicyRegister_root" style={{ marginBottom: "0.5rem" }}>
            New accounts receive a {registerBonus} {registerBonusCurrency} welcome bonus when registration completes.
          </p>
        )}
        <div className="Flex_root Flex_column Flex_sm4 Register_collapse">
          <button type="button" className="Register_collapseTitle" aria-expanded={referralOpen} onClick={() => setReferralOpen((o) => !o)}>
            <span>Referral code or username (optional)</span>
            <img alt="chevron" className={cx(referralOpen && "Register_up")} src="/icons/chevron.svg" />
          </button>
          <div className={cx("Register_collapseBody", referralOpen && "Register_isCollapseExpanded")}>
            <div className="TextInput_formControlWrapper">
              <div className="InputWrapper_root">
                <input className="Input_root" placeholder="Referral code or referrer username" name="referrerCode" aria-label="Referral code or username" value={form.values.referrerCode} onChange={(e) => form.set("referrerCode")(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="FormControlWrapper_root">
          <label className="Label_root Checkbox_root">
            <input className="Checkbox_checkboxInput" type="checkbox" name="isAgreeTnC" checked={form.values.terms} onChange={(e) => form.set("terms")(e.target.checked)} aria-invalid={!!form.errors.terms} />
            <span className="Checkbox_checkboxCheckMark" />
            <div className="Relative_root">
              <p className="TermAndPolicyRegister_root">
                I agree to Shuffle's{" "}
                <a target="_blank" className="TextLink_root" rel="noreferrer" href="/info/terms">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a target="_blank" className="TextLink_root" rel="noreferrer" href="/info/privacy">
                  Privacy Policy
                </a>
              </p>
            </div>
          </label>
          <ErrorMessage>{form.errors.terms}</ErrorMessage>
        </div>
        <div className="Register_buttonGroup">
          <button type="submit" form="register-form" disabled={busy} className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary">
            <span className="ButtonVariants_buttonContent">{busy ? "Creating account…" : "Register"}</span>
          </button>
          <div className="Register_continueWithLabel">Or continue with</div>
        </div>
      </form>
      <OauthButtons />
    </div>
  );
}

/** Mount only while open (the shell does this) so the enter animation restarts each time. */
export default function AuthModal({ open = true, tab = "login", onTabChange, onClose }) {
  /**
   * Signup off means the Register TAB goes too, not just the header button.
   *
   * The modal opens from seven places — the header, a game page, the VIP and
   * affiliate pages, the bet slip, the VIP rail and a favourite — and several
   * of them ask for `register` by name. Coercing the tab here is what makes
   * one policy hold for all of them; hiding the button in `TopBar` alone
   * would leave every other entry point opening a form the backend refuses.
   */
  const { canSignUp: signupAllowed } = useSiteFeatures();
  const canSignUp = signupAllowed();
  const active = canSignUp ? tab : "login";
  // The enter transition and the Escape key belong to `Modal` now; the page
  // behind still has to stop scrolling while the dialog is up.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <Modal onClose={onClose} label={active === "login" ? "Login" : "Register"} bodyClass="GlobalModal_authModalBody" contentClass="GlobalModal_authModalContent">
      <div style={{ height: 768 }}>
        <div>
          <div className="AuthModal_desktop">
            <div className="AuthModal_authModalLeft">
              <img className="AuthModal_backgroundImage" alt="auth-backdrop" src="/images/login-panel.png" />
              <img className="AuthModal_logo" alt="logo" src="/icons/logo.svg" />
              <p className="AuthModal_terms">
                By accessing the site, I attest that I am at least 18 years old and have read the&nbsp;
                <a target="_blank" href="/info/terms">
                  Terms and Conditions
                </a>
              </p>
            </div>
            <div className="AuthModal_authModalRight">
              <div className="LoginAndRegister_root">
                <div className="TabViewOutline_root">
                  <div className="TabViewOutline_tabOutlineWrapper">
                    {[
                      // Register is dropped entirely on a site that does not
                      // take public signups — not disabled, which would still
                      // advertise a door that does not open.
                      ...(canSignUp ? [["register", "Register"]] : []),
                      ["login", "Login"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={cx("TabViewOutline_tabOutline TabViewOutline_tabOutlineFullWidth TabViewOutline_tabOutlineSm", active === id && "TabViewOutline_tabOutlineActive")}
                        id={`auth-tab-${id}`}
                        data-text={label}
                        disabled={active === id}
                        onClick={() => onTabChange(id)}
                      >
                        <span className="TabViewOutline_tabName">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="LoginAndRegister_content">
                  {active === "login" ? <LoginForm onDone={onClose} /> : <RegisterForm onDone={onClose} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
