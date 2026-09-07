import { useEffect, useState } from "react";
import { cx } from "../../lib/carousel";

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

function PasswordField({ forgot = false, value, onChange, error, autoComplete = "current-password" }) {
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
        <button className="PasswordInput_forgotPasswordText" type="button">
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
  password: (v) => (!v ? "Password is required" : v.length < 8 ? "Password must be at least 8 characters" : null),
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

  return { values, errors, set, submit };
}

function LoginForm() {
  const form = useForm({ identifier: "", password: "" }, { identifier: rules.identifier, password: rules.loginPassword });
  const [status, setStatus] = useState(null);

  const onSubmit = (e) => {
    if (!form.submit(e)) {
      setStatus(null);
      return;
    }
    // No backend is wired yet, so mirror the reference's failed-attempt message.
    setStatus("Invalid username or password");
  };

  return (
    <div>
      <form id="login-form" className="Form_root" noValidate onSubmit={onSubmit}>
        {status && (
          <div className="ErrorMessage_root Register_errorMessage" role="alert">
            {status}
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
        <PasswordField forgot value={form.values.password} onChange={form.set("password")} error={form.errors.password} />
        <div className="Login_buttonGroup">
          <button type="submit" form="login-form" className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary">
            <span className="ButtonVariants_buttonContent">Login</span>
          </button>
          <div className="Login_textNote">Or continue with</div>
        </div>
      </form>
      <OauthButtons />
    </div>
  );
}

function RegisterForm() {
  const [referralOpen, setReferralOpen] = useState(false);
  const form = useForm(
    { username: "", email: "", password: "", referrerCode: "", terms: false },
    { username: rules.username, email: rules.email, password: rules.password, terms: rules.terms }
  );
  const [done, setDone] = useState(false);

  const onSubmit = (e) => {
    setDone(form.submit(e));
  };

  return (
    <div className="Flex_root Flex_column Flex_sm4">
      <form className="Register_form" id="register-form" noValidate onSubmit={onSubmit}>
        <div className="Register_formBody">
          {done && (
            <div className="ErrorMessage_root Register_errorMessage" style={{ color: "var(--color-success)" }} role="status">
              All details look good. Account creation is not wired to a backend yet.
            </div>
          )}
          <TextField label="Username*" name="username" placeholder="Enter Username" autoComplete="username" value={form.values.username} onChange={form.set("username")} error={form.errors.username} />
          <TextField label="Email*" name="email" placeholder="Enter Email" inputMode="email" autoComplete="email" value={form.values.email} onChange={form.set("email")} error={form.errors.email} />
          <PasswordField value={form.values.password} onChange={form.set("password")} error={form.errors.password} autoComplete="new-password" />
        </div>
        <input type="hidden" name="cxd" value="" />
        <div className="Flex_root Flex_column Flex_sm4 Register_collapse">
          <button type="button" className="Register_collapseTitle" aria-expanded={referralOpen} onClick={() => setReferralOpen((o) => !o)}>
            <span>Referral Code (Optional)</span>
            <img alt="chevron" className={cx(referralOpen && "Register_up")} src="/icons/chevron.svg" />
          </button>
          <div className={cx("Register_collapseBody", referralOpen && "Register_isCollapseExpanded")}>
            <div className="TextInput_formControlWrapper">
              <div className="InputWrapper_root">
                <input className="Input_root" placeholder="Enter referral code" name="referrerCode" aria-label="Referral code" value={form.values.referrerCode} onChange={(e) => form.set("referrerCode")(e.target.value)} />
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
          <button type="submit" form="register-form" className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary">
            <span className="ButtonVariants_buttonContent">Register</span>
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
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setEntered(true), 20);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={cx("ModalContent_root defaultTheme", entered ? "ModalContent_show" : "ModalContent_hide")} role="dialog" aria-modal="true" aria-label={tab === "login" ? "Login" : "Register"}>
      <div className={cx("ModalContent_overlay", entered && "ModalContent_overlayShow ModalContent_showBgCover")} onClick={onClose} />
      <div>
        <div className={cx("ModalContent_modalBody ModalContent_hideModalBody GlobalModal_authModalBody", entered && "ModalContent_showModalBody ModalContent_animationCompleted")}>
          <div className="ModalClose_modalHeader">
            <button type="button" aria-label="Close modal" className="ModalClose_closeButton" id="close-modal" onClick={onClose}>
              <img alt="times" src="/icons/times.svg" />
            </button>
          </div>
          <div className="ModalContent_modalContent GlobalModal_authModalContent">
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
                            ["register", "Register"],
                            ["login", "Login"],
                          ].map(([id, label]) => (
                            <button
                              key={id}
                              type="button"
                              className={cx("TabViewOutline_tabOutline TabViewOutline_tabOutlineFullWidth TabViewOutline_tabOutlineSm", tab === id && "TabViewOutline_tabOutlineActive")}
                              id={`auth-tab-${id}`}
                              data-text={label}
                              disabled={tab === id}
                              onClick={() => onTabChange(id)}
                            >
                              <span className="TabViewOutline_tabName">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="LoginAndRegister_content">{tab === "login" ? <LoginForm /> : <RegisterForm />}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
