import { useEffect, useRef, useState } from "react";
import api, { messageFrom } from "../api/client";
import "./Login.css";

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function Login({ onAuthenticated }) {
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const googleButton = useRef(null);

  useEffect(() => {
    if (!googleClientId) {
      setError("Google sign-in is not configured yet. Please contact the site administrator.");
      return undefined;
    }
    const render = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setSigningIn(true);
          setError("");
          try {
            const { data } = await api.post("/auth/google", { credential });
            sessionStorage.setItem("casemate_token", data.token);
            onAuthenticated(data.user);
          } catch (err) {
            setError(messageFrom(err));
          } finally {
            setSigningIn(false);
          }
        },
      });
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, { theme: "outline", size: "large", text: "continue_with", width: 350 });
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
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, [onAuthenticated]);

  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <h1 id="login-title">CaseMate</h1>
    <p>Sign in with your Google Account to access your legal workspace.</p>
    <div className="google-signin" ref={googleButton} aria-busy={signingIn} />
    {signingIn && <p>Signing you in…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section></main>;
}
