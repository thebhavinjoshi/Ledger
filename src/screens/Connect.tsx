import { useState } from "react";
import { CircleAlert, Sheet } from "lucide-react";
import { Button } from "../components/ui";
import { authConfigured, signIn } from "../lib/auth";
import { errorMessage } from "../lib/errors";

export default function Connect({ onDone, notice }: { onDone(): void; notice?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice ?? "");
  const configured = authConfigured();

  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await signIn();
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <div className="screen-card">
        <div className="brand brand-center">
          <span className="brand-mark brand-mark-lg" aria-hidden>
            <Sheet size={22} />
          </span>
        </div>
        <h1 className="screen-title">Connect Google Sheets</h1>
        <p className="screen-text">
          Ledger keeps your transactions, budgets and goals in a Google Sheet that you own. Sign in to let it read and write that sheet.
        </p>

        {!configured && (
          <p className="form-error" role="alert">
            <CircleAlert size={15} /> Google sign-in isn’t configured in this build. Set <code>VITE_GOOGLE_CLIENT_ID</code> (see the README) and rebuild.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            <CircleAlert size={15} /> {error}
          </p>
        )}

        <Button variant="primary" className="btn-block" loading={busy} disabled={!configured} onClick={() => void go()}>
          {busy ? "Finish signing in in your browser…" : "Continue with Google"}
        </Button>
        <p className="screen-fine">Your browser opens for sign-in. Ledger only asks for access to Google Sheets.</p>
      </div>
    </div>
  );
}
