# CS2 Upgrader MVP

Telegram Mini App starter: cases, simulated CS2 skin inventory, upgrade flow, profile and operation history. Real TON payments and Steam trades are deliberately disabled behind adapters.

## Stack
- Frontend: React + TypeScript + Vite
- API: Node.js + TypeScript + Fastify
- Database: PostgreSQL + Prisma
- Deployment: Render Blueprint (`render.yaml`)

## Local setup
Requirements: Node.js 20+ and PostgreSQL.

1. Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL` and a long `SESSION_SECRET`.
2. In `backend/`: `npm install`, `npx prisma generate`, `npx prisma migrate dev --name init`, `npm run seed`, `npm run dev`.
3. In `frontend/`: `npm install`, copy `.env.example` to `.env`, set `VITE_API_URL=http://localhost:10000`, then `npm run dev`.
4. Open the Vite URL. Outside Telegram the app uses a clearly marked local demo identity. For production, Telegram `initData` validation must be enabled.

## Render
1. Push this folder to a new GitHub repository.
2. In Render, create a Blueprint from the repository and review `render.yaml`.
3. Set `TELEGRAM_BOT_TOKEN` and `SESSION_SECRET` for the API service. `DEMO_MODE=true` intentionally keeps a shared demo identity and must not be treated as production authentication. Set `DEMO_MODE=false` only after BotFather token and Telegram Mini App launch flow are configured. Do not enable real payments/trades until their compliance and technical design has been reviewed.
4. Open the Render Shell for the API service and run `npm run seed` once to add demo catalog data.
5. Set the frontend `VITE_API_URL` to the deployed API URL and redeploy the frontend after changing it.
6. Set the Mini App URL in BotFather after the frontend is live.


## Important MVP boundaries
- Balances and skins are demo-only; no deposits, withdrawals, or real-money value.
- Case results and upgrade rolls are generated server-side using Node crypto. This is a prototype, not a certified provably-fair system.
- The Steam and TON adapters explicitly return `NOT_ENABLED`.
- Before production, add rate limiting, monitoring, formal security review, stronger admin controls, and a verified legal/payment model.
