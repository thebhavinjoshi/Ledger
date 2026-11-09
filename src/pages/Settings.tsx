import { useEffect, useState, type FormEvent } from "react";
import { Download, ExternalLink, FileSpreadsheet, KeyRound, LogOut, Monitor, Moon, RefreshCw, Sun } from "lucide-react";
import { Button, Card, Field, PageHeader, Segmented } from "../components/ui";
import { getUserEmail } from "../lib/auth";
import { CURRENCIES } from "../lib/constants";
import { downloadText, transactionsToCSV } from "../lib/csv";
import { todayISO } from "../lib/dates";
import { errorMessage } from "../lib/errors";
import type { ThemeMode } from "../lib/types";
import { getPlatform } from "../platform";
import { useLedger } from "../state/ledger";
import { usePrefs } from "../state/prefs";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";

export default function Settings() {
  const { prefs, update } = usePrefs();
  const { data, refresh, syncing } = useLedger();
  const session = useSession();
  const toast = useToast();

  useEffect(() => {
    let live = true;
    void getUserEmail().then((email) => {
      if (live && email) update({ email });
    });
    return () => {
      live = false;
    };
  }, [update]);

  const exportCsv = () => {
    downloadText(`ledger-transactions-${todayISO()}.csv`, transactionsToCSV(data.transactions));
    toast.show(`Exported ${data.transactions.length} transactions.`);
  };

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${prefs.spreadsheetId}`;

  return (
    <div className="page page-narrow">
      <PageHeader eyebrow="Preferences" title="Settings" subtitle="Appearance, account and data." />

      <Card title="Appearance">
        <div className="setting-row">
          <div>
            <p className="setting-name">Theme</p>
            <p className="setting-help">System follows your Windows setting and changes with it.</p>
          </div>
          <Segmented<ThemeMode>
            label="Theme"
            value={prefs.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "dark", label: "Dark", icon: <Moon size={15} /> },
              { value: "light", label: "Light", icon: <Sun size={15} /> },
              { value: "system", label: "System", icon: <Monitor size={15} /> },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <p className="setting-name">Currency</p>
            <p className="setting-help">Only changes how amounts are shown. Nothing is converted.</p>
          </div>
          <select className="input" aria-label="Currency" value={prefs.currency} onChange={(e) => update({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card title="Google Sheets">
        <div className="setting-row">
          <div className="setting-grow">
            <p className="setting-name">Account</p>
            <p className="setting-help ellipsis">{prefs.email || "Signed in"}</p>
          </div>
          <Button icon={<LogOut size={15} />} onClick={() => void session.signOut()}>
            Sign out
          </Button>
        </div>
        <div className="setting-row">
          <div className="setting-grow">
            <p className="setting-name">Spreadsheet</p>
            <p className="setting-help ellipsis">
              <FileSpreadsheet size={13} className="inline-icon" /> {prefs.spreadsheetTitle || "Spreadsheet"}
            </p>
          </div>
          <div className="btn-group">
            <Button icon={<ExternalLink size={15} />} onClick={() => void getPlatform().openUrl(sheetUrl)}>
              Open
            </Button>
            <Button onClick={session.changeSheet}>Change</Button>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <p className="setting-name">Sync</p>
            <p className="setting-help">Changes are saved to the sheet as you make them.</p>
          </div>
          <Button icon={<RefreshCw size={15} className={syncing ? "spin" : undefined} />} onClick={() => void refresh()} disabled={syncing}>
            Refresh now
          </Button>
        </div>
      </Card>

      <PasswordCard />

      <Card title="Data">
        <div className="setting-row">
          <div>
            <p className="setting-name">Export transactions</p>
            <p className="setting-help">Download everything as a CSV file you can open in Excel.</p>
          </div>
          <Button icon={<Download size={15} />} onClick={exportCsv} disabled={data.transactions.length === 0}>
            Export CSV
          </Button>
        </div>
      </Card>

      <p className="about">Ledger 1.0.0 · Your data lives in your own Google Sheet. The lock screen is local to this computer.</p>
    </div>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (next.length < 6) return setError("The new password needs at least 6 characters.");
    if (next !== confirm) return setError("The new passwords don’t match.");
    setBusy(true);
    try {
      await getPlatform().lock.change(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.show("Password changed.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Security">
      <form className="form" onSubmit={(e) => void submit(e)}>
        <p className="setting-help">Ledger asks for your password every time it opens.</p>
        <div className="row-3">
          <Field label="Current password">
            <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password">
            <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" icon={<KeyRound size={15} />} loading={busy} disabled={!current || !next || !confirm}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}
