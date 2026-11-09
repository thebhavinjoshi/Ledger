/** The Google session is missing or no longer valid; the user must sign in again. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** A failed Google Sheets API call. `status` is 0 for network failures. */
export class SheetsError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SheetsError";
    this.status = status;
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong.";
}
