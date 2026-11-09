/**
 * Everything that touches the operating system. The desktop build implements
 * this with Tauri commands; a mobile build can supply its own implementation
 * (secure storage, in-app browser, biometric lock) without touching the rest.
 */
export interface Platform {
  lock: {
    status(): Promise<{ configured: boolean; username?: string | null }>;
    setup(username: string, password: string): Promise<void>;
    verify(username: string, password: string): Promise<boolean>;
    change(current: string, next: string): Promise<void>;
  };
  /** Secure storage for the Google refresh token. */
  secrets: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  /** Loopback OAuth: reserve a port, then open the browser and wait for the code. */
  oauth: {
    begin(): Promise<number>;
    wait(authUrl: string, state: string): Promise<string>;
  };
  openUrl(url: string): Promise<void>;
  /** `null` follows the operating system. */
  setWindowTheme(theme: "light" | "dark" | null): Promise<void>;
  showWindow(): Promise<void>;
}
