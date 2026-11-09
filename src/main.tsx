import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/pages.css";
import App from "./App";
import { initPlatform } from "./platform";
import { PrefsProvider } from "./state/prefs";
import { ToastProvider } from "./state/toast";

const root = createRoot(document.getElementById("root")!);

initPlatform()
  .then(() =>
    root.render(
      <StrictMode>
        <PrefsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </PrefsProvider>
      </StrictMode>,
    ),
  )
  .catch((e: unknown) => {
    root.render(
      <div className="screen">
        <div className="screen-card">
          <h1 className="screen-title">Ledger can’t start here</h1>
          <p className="screen-text">{e instanceof Error ? e.message : String(e)}</p>
        </div>
      </div>,
    );
  });
