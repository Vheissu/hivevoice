# Hivevoice

A self‑hosted invoicing system that writes invoices directly to the Hive blockchain and watches the chain for payments. The back‑end is a small Node service, the front‑end is an Aurelia 2 single‑page app.

## Why use Hive?

- Zero gas or miner fees. Hive is fee‑less for normal users.
- Immediate settlement. Hive has 3 second block times.
- Built‑in HBD stablecoin. Quote invoices in HIVE or HBD without extra rails.

## Key features

- On‑chain invoices. Invoices are stored in custom_json operations so anyone can verify them.
- Automatic payment tracking. Server listens to blocks and updates invoice status (pending, partial, paid).
- SQLite ledger. Lightweight local DB, no extra service required.
- Web UI. Create and share invoices, track who has paid and how much.
- Self‑hosted. Run it on a VPS, Raspberry Pi, or your laptop. No SaaS lock‑in.

## Repo layout

```
📦 root
 ├─ src/               # Node back‑end (TypeScript)
 ├─ ui/                # Aurelia 2 front‑end
 ├─ .env.example       # sample environment vars
 ├─ package.json       # scripts + deps for back‑end
 ├─ tsconfig.json       # typescript config for node.js backend
 └─ README.md
```

## Prerequisites
- Node 20 or later
- Yarn, npm, or pnpm
- A Hive account + posting key (only posting auth is required)
- SQLite 3 (usually pre‑installed on Linux/macOS)

## To implement TODO list

- When installing dependencies, always use `@latest` versions of packages by running `npm install` commands.
- Create Aurelia 2 application in `ui` directory using `npx makes aurelia` - ensure it's Typescript, Vite and CSS.
- The UI needs to be beautiful and allow for all things that standard invoice creation would have. Uses the `@aurelia/validation` library for validation, etc. 
- Server will poll the Hive blockchain, but also have a lightweight Hono API for the front-end.
- Allows visibility into invoices on chain
- Maybe it should support encrypting. Custom JSON operations don't allow for storing that much information, so maybe they're just identifiers on the blockchain and the invoice is stored in SQLite database.
- Comprehensive unit tests using Vitest.