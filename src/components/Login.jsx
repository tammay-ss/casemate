import { useCallback, useEffect, useRef, useState } from "react";
import api, { checkHealth, messageFrom } from "../api/client";
import { TOKEN_KEY } from "../App";
import { useTheme } from "../ThemeContext";
import "./Login.css";

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function Login({ onAuthenticated }) {
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [lastCredential, setLastCredential] = useState(null);
  const [serverStatus, setServerStatus] = useState("checking"); // checking, ready, warming, error
  const googleButton = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  // Check backend health and warm up Render free-tier container
  const pingServer = useCallback(async () => {
    setServerStatus("checking");
    const result = await checkHealth(15000);
    if (result.ok) {
      setServerStatus("ready");
    } else {
      setServerStatus("warming");
    }
  }, []);

  useEffect(() => {
    pingServer();
  }, [pingServer]);

  const submitCredential = useCallback(
    async (credential) => {
      setSigningIn(true);
      setError("");
      setLastCredential(credential);
      try {
        const { data } = await api.post("/auth/google", { credential });
        localStorage.setItem(TOKEN_KEY, data.token);
        onAuthenticated(data.user);
      } catch (err) {
        setError(messageFrom(err));
        setServerStatus("warming");
      } finally {
        setSigningIn(false);
      }
    },
    [onAuthenticated]
  );

  useEffect(() => {
    if (!googleClientId) {
      setError(
        "Google sign-in is not configured. Please contact the site administrator."
      );
      return undefined;
    }

    const render = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => submitCredential(credential),
      });
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, {
        theme: isDark ? "filled_black" : "outline",
        size: "large",
        text: "continue_with",
        width: 320,
      });
    };

    const existingScript = document.getElementById("google-identity-services");
    if (existingScript) {
      if (window.google) render();
      else existingScript.addEventListener("load", render, { once: true });
      return () => existingScript.removeEventListener("load", render);
    }
    const script = document.createElement("script");
    script.id = "google-identity-services";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => {
      setError(
        "Could not load Google Sign-In. Please check your internet connection or disable ad-blockers, then refresh."
      );
    };
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [submitCredential, isDark]);

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">⚖</span>
          <h1 id="login-title" className="login-title">CaseMate</h1>
        </div>
        <p className="login-subtitle">
          Your legal case and document workspace.
          <br />
          Sign in with your Google Account to continue.
        </p>

        {serverStatus === "warming" && (
          <p className="login-server-warming" role="status">
            <span className="login-spinner" aria-hidden="true" />
            Connecting to server (Render free-tier backend is waking up)…{" "}
            <button
              type="button"
              className="login-check-server-btn"
              onClick={pingServer}
            >
              Check connection
            </button>
          </p>
        )}

        <div
          className="google-signin"
          ref={googleButton}
          aria-busy={signingIn}
        />

        {signingIn && (
          <p className="login-status" aria-live="polite">
            <span className="login-spinner" aria-hidden="true" />
            Signing you in…
          </p>
        )}

        {error && (
          <div className="login-error-container">
            <p className="login-error" role="alert">
              {error}
            </p>
            {lastCredential && !signingIn && (
              <button
                type="button"
                className="login-retry-btn"
                onClick={() => submitCredential(lastCredential)}
              >
                Retry Sign-In
              </button>
            )}
          </div>
        )}

        <p className="login-note">
          Having trouble? The server may be waking up — please wait a moment and try again.
        </p>
      </section>

      {/* Theme toggle on login page */}
      <button
        type="button"
        className="login-theme-btn"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? "☀ Light" : "🌙 Dark"}
      </button>
    </main>
  );
}
