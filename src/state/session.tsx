import { createContext, useContext } from "react";

/** Actions that leave the main app and return to an earlier screen. */
export interface SessionActions {
  lock(): void;
  signOut(): Promise<void>;
  changeSheet(): void;
}

export const SessionContext = createContext<SessionActions | null>(null);

export function useSession(): SessionActions {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside the session provider");
  return ctx;
}
