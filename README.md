# DeepMine — Telegram Mini App

Idle mining game with server-side PostgreSQL persistence and Telegram WebApp authentication.

## Local
1. `npm install`
2. Create `.env` with `DATABASE_URL` and optionally `BOT_TOKEN`.
3. `npm run dev`

## Render
Use the included `render.yaml` Blueprint. Set `BOT_TOKEN` to the token of the Telegram bot that owns the Mini App. `DATABASE_URL` is created automatically by Render PostgreSQL.

The server serves the Vite build and exposes `/api/health`, `/api/bootstrap`, `/api/state`.
