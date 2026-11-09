import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "./components/Shell";
import { getAccessToken, hasSession, signOut } from "./lib/auth";
import { clearCache } from "./lib/prefs";
import type { DataSource } from "./lib/data";
import { createSource, getPlatform } from "./platform";
import { LedgerProvider } from "./state/ledger";
import { usePrefs } from "./state/prefs";
import { SessionContext, type SessionActions } from "./state/session";
import Connect from "./screens/Connect";
import Lock from "./screens/Lock";
import SheetSetup from "./screens/SheetSetup";

type Stage = "boot" | "lock" | "connect" | "sheet" | "app";

export default function App() {
  const { prefs, update } = usePrefs();
  const [stage, setStage] = useState<Stage>("boot");
  const [lockMode, setLockMode] = useState<"setup" | "unlock">("unlock");
  const [lockUser, setLockUser] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    void getPlatform()
      .lock.status()
      .then((s) => {
        if (!live) return;
        setLockMode(s.configured ? "unlock" : "setup");
        setLockUser(s.username ?? null);
        setStage("lock");
      });
    return () => {
      live = false;
    };
  }, []);

  // Reveal the window after the first real paint (it starts hidden to avoid a white flash).
  useEffect(() => {
    if (stage === "boot") return;
    const id = requestAnimationFrame(() => void getPlatform().showWindow().catch(() => undefined));
    return () => cancelAnimationFrame(id);
  }, [stage]);

  const afterUnlock = useCallback(async () => {
    if (!(await hasSession())) return setStage("connect");
    setStage(prefs.spreadsheetId ? "app" : "sheet");
  }, [prefs.spreadsheetId]);

  const onAuthLost = useCallback(() => {
    setNotice("Your Google session expired. Please sign in again.");
    setStage("connect");
  }, []);

  const session = useMemo<SessionActions>(
    () => ({
      lock: () => {
        setLockMode("unlock");
        setStage("lock");
      },
      signOut: async () => {
        await signOut();
        setNotice("");
        setStage("connect");
      },
      changeSheet: () => {
        if (prefs.spreadsheetId) clearCache(prefs.spreadsheetId);
        update({ spreadsheetId: "", spreadsheetTitle: "" });
        setStage("sheet");
      },
    }),
    [prefs.spreadsheetId, update],
  );

  if (stage === "boot") return null;
  if (stage === "lock") return <Lock mode={lockMode} username={lockUser} onDone={() => void afterUnlock()} />;
  if (stage === "connect")
    return (
      <Connect
        notice={notice}
        onDone={() => {
          setNotice("");
          setStage(prefs.spreadsheetId ? "app" : "sheet");
        }}
      />
    );
  if (stage === "sheet")
    return (
      <SheetSetup
        onAuthLost={onAuthLost}
        onDone={({ id, title }) => {
          update({ spreadsheetId: id, spreadsheetTitle: title });
          setStage("app");
        }}
      />
    );

  return (
    <SessionContext.Provider value={session}>
      <Workspace spreadsheetId={prefs.spreadsheetId} onAuthLost={onAuthLost} />
    </SessionContext.Provider>
  );
}

function Workspace({ spreadsheetId, onAuthLost }: { spreadsheetId: string; onAuthLost(): void }) {
  const [source, setSource] = useState<DataSource | null>(null);

  useEffect(() => {
    let live = true;
    void createSource(spreadsheetId, getAccessToken).then((s) => live && setSource(s));
    return () => {
      live = false;
    };
  }, [spreadsheetId]);

  if (!source) return null;
  return (
    <LedgerProvider source={source} spreadsheetId={spreadsheetId} onAuthLost={onAuthLost}>
      <Shell />
    </LedgerProvider>
  );
}
