import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import {
  ArrowLeftRight,
  ChartPie,
  CircleAlert,
  LayoutDashboard,
  Lock,
  Monitor,
  Moon,
  PiggyBank,
  Settings as SettingsIcon,
  Sun,
  Target,
} from "lucide-react";
import { cx } from "../lib/cx";
import type { PageId, ThemeMode, Transaction } from "../lib/types";
import Dashboard from "../pages/Dashboard";
import { useLedger } from "../state/ledger";
import { usePrefs } from "../state/prefs";
import { useSession } from "../state/session";
import { TransactionModal } from "./TransactionModal";
import { Button, EmptyState, Segmented, Skeleton } from "./ui";

const Transactions = lazy(() => import("../pages/Transactions"));
const Budgets = lazy(() => import("../pages/Budgets"));
const Analytics = lazy(() => import("../pages/Analytics"));
const Goals = lazy(() => import("../pages/Goals"));
const Settings = lazy(() => import("../pages/Settings"));

const NAV: { id: PageId; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "budgets", label: "Budgets", icon: PiggyBank },
  { id: "analytics", label: "Analytics", icon: ChartPie },
  { id: "goals", label: "Goals", icon: Target },
];

export interface PageProps {
  onAdd(): void;
  onOpen(t: Transaction): void;
  onNavigate(p: PageId): void;
}

export function Shell() {
  const { status, error, syncing, refresh } = useLedger();
  const { prefs, update } = usePrefs();
  const session = useSession();
  const [page, setPage] = useState<PageId>("dashboard");
  const [modal, setModal] = useState<{ open: boolean; editing: Transaction | null }>({ open: false, editing: null });
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [page]);

  // Ctrl/Cmd+N opens "Add transaction" from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setModal((m) => (m.open ? m : { open: true, editing: null }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pageProps: PageProps = {
    onAdd: () => setModal({ open: true, editing: null }),
    onOpen: (t) => setModal({ open: true, editing: t }),
    onNavigate: setPage,
  };

  const syncState = error ? "error" : syncing ? "syncing" : "ok";
  const syncText = error ? "Offline" : syncing ? "Syncing…" : "Synced";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            L
          </span>
          <span className="brand-name">Ledger</span>
        </div>

        <nav className="nav" aria-label="Main">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={cx("nav-item", page === id && "active")}
              aria-current={page === id ? "page" : undefined}
              title={label}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            type="button"
            className={cx("nav-item", page === "settings" && "active")}
            aria-current={page === "settings" ? "page" : undefined}
            title="Settings"
            onClick={() => setPage("settings")}
          >
            <SettingsIcon size={18} />
            <span className="nav-label">Settings</span>
          </button>

          <Segmented<ThemeMode>
            label="Theme"
            className="theme-seg"
            value={prefs.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "dark", label: "Dark", icon: <Moon size={15} /> },
              { value: "light", label: "Light", icon: <Sun size={15} /> },
              { value: "system", label: "System", icon: <Monitor size={15} /> },
            ]}
          />

          <button type="button" className="sync-chip" onClick={() => void refresh()} title="Sync with Google Sheets now">
            <span className={cx("sync-dot", syncState)} aria-hidden />
            <span className="sync-text">
              <strong>Google Sheets</strong>
              <small>{syncText}</small>
            </span>
          </button>

          <button type="button" className="nav-item" title="Lock Ledger" onClick={session.lock}>
            <Lock size={18} />
            <span className="nav-label">Lock</span>
          </button>
        </div>
      </aside>

      <main className="main" ref={mainRef} id="main">
        {error && status === "ready" && (
          <div className="banner" role="alert">
            <CircleAlert size={16} />
            <span>Couldn’t reach Google Sheets, so you’re seeing saved data. {error}</span>
            <Button size="sm" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        )}
        <Suspense fallback={<PageSkeleton />}>
          {status === "loading" ? (
            <PageSkeleton />
          ) : status === "error" ? (
            <EmptyState
              icon={<CircleAlert size={22} />}
              title="Couldn’t load your data"
              text={error ?? undefined}
              action={
                <Button variant="primary" onClick={() => void refresh()}>
                  Try again
                </Button>
              }
            />
          ) : page === "dashboard" ? (
            <Dashboard {...pageProps} />
          ) : page === "transactions" ? (
            <Transactions {...pageProps} />
          ) : page === "budgets" ? (
            <Budgets />
          ) : page === "analytics" ? (
            <Analytics {...pageProps} />
          ) : page === "goals" ? (
            <Goals />
          ) : (
            <Settings />
          )}
        </Suspense>
      </main>

      {modal.open && <TransactionModal editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <Skeleton height={14} width={90} />
      <Skeleton height={36} width={260} />
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={120} />
        ))}
      </div>
      <Skeleton height={280} />
    </div>
  );
}
