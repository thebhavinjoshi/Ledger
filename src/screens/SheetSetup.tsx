import { useState, type FormEvent } from "react";
import { CircleAlert, FilePlus2, Link2 } from "lucide-react";
import { Button, Field } from "../components/ui";
import { AuthError, errorMessage } from "../lib/errors";
import { getAccessToken } from "../lib/auth";
import { createSheetsSource, createSpreadsheet, getSpreadsheetInfo, parseSpreadsheetId, type SpreadsheetInfo } from "../lib/sheets";

interface Props {
  onDone(info: { id: string; title: string }): void;
  onAuthLost(): void;
}

export default function SheetSetup({ onDone, onAuthLost }: Props) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<"new" | "existing" | null>(null);
  const [error, setError] = useState("");

  const guard = async (kind: "new" | "existing", job: () => Promise<SpreadsheetInfo>) => {
    setBusy(kind);
    setError("");
    try {
      const info = await job();
      onDone({ id: info.id, title: info.title });
    } catch (e) {
      if (e instanceof AuthError) return onAuthLost();
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const createNew = () =>
    guard("new", async () => {
      const info = await createSpreadsheet(getAccessToken);
      await createSheetsSource(info.id, getAccessToken).init();
      return info;
    });

  const useExisting = (e: FormEvent) => {
    e.preventDefault();
    const id = parseSpreadsheetId(link);
    if (!id) return setError("That doesn’t look like a Google Sheets link. Paste the full URL from your browser.");
    void guard("existing", async () => {
      const info = await getSpreadsheetInfo(getAccessToken, id);
      await createSheetsSource(id, getAccessToken).init();
      return info;
    });
  };

  return (
    <div className="screen">
      <div className="screen-card screen-wide">
        <h1 className="screen-title">Choose your spreadsheet</h1>
        <p className="screen-text">Ledger stores everything in three tabs: Transactions, Budget and Goals.</p>

        <div className="choice">
          <div className="choice-head">
            <FilePlus2 size={18} />
            <h2>Start fresh</h2>
          </div>
          <p>Create a new spreadsheet named “Ledger” in your Google Drive.</p>
          <Button variant="primary" loading={busy === "new"} disabled={busy !== null} onClick={() => void createNew()}>
            Create new spreadsheet
          </Button>
        </div>

        <form className="choice" onSubmit={useExisting}>
          <div className="choice-head">
            <Link2 size={18} />
            <h2>Use an existing one</h2>
          </div>
          <p>Paste the link of a sheet you already use with Ledger. Missing tabs and columns are added for you.</p>
          <Field label="Spreadsheet link">
            <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" spellCheck={false} />
          </Field>
          <Button type="submit" loading={busy === "existing"} disabled={busy !== null || !link.trim()}>
            Use this spreadsheet
          </Button>
        </form>

        {error && (
          <p className="form-error" role="alert">
            <CircleAlert size={15} /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
