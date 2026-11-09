# Ledger

A personal finance tracker for the desktop. Income, expenses, transfers between your own accounts, budgets and savings goals, all stored in a Google Sheet that you own.

Built with React, Vite and Tauri v2. Windows is the supported target for now; the code is laid out so mobile can be added later.

## Features

- **Dashboard** with balance, monthly income and spending, savings rate, a six-month cash-flow chart, top budgets, recent transactions and per-account balances
- **Transactions** with expense, income and **transfer** types, payment methods (UPI, Cash, Card, Netbanking, Bank, Other with free text), search, sorting, and filters by type, category, method, month or date range
- **Budgets** with monthly limits per category and over-budget warnings
- **Goals** with targets, deadlines and add-funds
- **Analytics** with category donut, income vs expenses, spending by method and largest expenses
- **Dark, Light and System themes**, with the native title bar following along
- **Lock screen** with a username and Argon2id-hashed password, asked on every launch
- **CSV export**, Ctrl+N to add a transaction, and a layout that never scrolls sideways

Transfers move money between accounts without counting as income or spending.

## How your data is stored

Everything lives in three tabs of your Google Sheet:

| Tab | Columns |
| --- | --- |
| Transactions | `id, type, amount, category, note, description, date, method, from, to` |
| Budget | `category, limit` |
| Goals | `id, name, target, saved, color, deadline` |

Existing sheets with the older seven-column layout still work. Missing tabs and columns are added, and blank `id` cells are filled in. The Google refresh token is kept in the OS credential store (Windows Credential Manager). The lock-screen hash is stored locally in the app data folder. Nothing is sent anywhere except Google.

## Google setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Sheets API**.
2. Configure the OAuth consent screen (External, add yourself as a test user).
3. Create an **OAuth client ID** of type **Desktop app**.
4. Copy `.env.example` to `.env.local` and fill in `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_SECRET`.

Ledger requests the `spreadsheets` scope plus `openid email` (to show which account is connected).

## Development

```bash
npm install
npm run tauri dev      # the desktop app with hot reload (needs Rust, see https://tauri.app/start/prerequisites/)
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Rust tests: `cd src-tauri && cargo test --lib`.

## Building without a local toolchain

Push to GitHub and add two repository secrets, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Then push a tag (`git tag v1.0.0 && git push --tags`) or run the **Release** workflow by hand. It builds the Windows installer and attaches it to a draft release. The **CI** workflow runs lint, type-check, tests and both builds on every push.

## Project layout

```
src/
  components/   Shell, charts, modal, shared UI
  pages/        Dashboard, Transactions, Budgets, Analytics, Goals, Settings
  screens/      Lock, Connect, SheetSetup
  lib/          types, calculations, Google Sheets client, formatting, CSV
  platform/     Tauri bridge (the `Platform` interface)
  state/        preferences, ledger data, toasts
  styles/       tokens (themes), base, components, pages
src-tauri/      Rust: lock screen, OAuth loopback, credential store
```

The Sheets logic in `src/lib` has no Tauri calls, and everything platform-specific sits behind the `Platform` interface in `src/platform/types.ts`. A mobile build only needs a new implementation of that interface.

## Licence

MIT
