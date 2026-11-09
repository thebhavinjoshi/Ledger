import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button, Field } from "../components/ui";
import { errorMessage } from "../lib/errors";
import { getPlatform } from "../platform";

interface Props {
  mode: "setup" | "unlock";
  /** Remembered username, shown pre-filled on unlock. */
  username?: string | null;
  onDone(): void;
}

export default function Lock({ mode, username: remembered, onDone }: Props) {
  const setup = mode === "setup";
  const [username, setUsername] = useState(remembered ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) return setError("Enter your username.");
    if (setup) {
      if (password.length < 6) return setError("Use at least 6 characters for the password.");
      if (password !== confirm) return setError("The passwords don’t match.");
    }
    setBusy(true);
    try {
      const { lock } = getPlatform();
      if (setup) {
        await lock.setup(username, password);
        onDone();
      } else if (await lock.verify(username, password)) {
        onDone();
      } else {
        setError("Wrong username or password.");
        setPassword("");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <form className="screen-card" onSubmit={(e) => void submit(e)}>
        <div className="brand brand-center">
          <span className="brand-mark brand-mark-lg" aria-hidden>
            L
          </span>
        </div>
        <h1 className="screen-title">{setup ? "Create your login" : "Welcome back"}</h1>
        <p className="screen-text">
          {setup ? "Ledger will ask for this every time it opens. It stays on this computer." : "Enter your password to open Ledger."}
        </p>

        <div className="form">
          <Field label="Username">
            <input
              className="input"
              autoComplete="username"
              autoFocus={!remembered}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <Field label="Password">
            <span className="input-wrap">
              <input
                className="input"
                type={show ? "text" : "password"}
                autoComplete={setup ? "new-password" : "current-password"}
                autoFocus={Boolean(remembered)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="input-eye" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </Field>
          {setup && (
            <Field label="Confirm password">
              <input className="input" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="btn-block" loading={busy} icon={busy ? undefined : <LockKeyhole size={16} />}>
            {setup ? "Create login" : "Unlock"}
          </Button>
        </div>
      </form>
    </div>
  );
}
