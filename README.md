# DeepMine — Telegram Mini App

Production-ready MVP for Render: React/Vite frontend, Express API and PostgreSQL persistence.

## Local
- `npm install`
- `npm run dev`
- `npm run build`
- `npm start`

## Render
- Runtime: Node
- Build: `npm install && npm run build`
- Start: `npm start`
- Add `BOT_TOKEN` as a secret environment variable.
- PostgreSQL is declared in `render.yaml` and exposed as `DATABASE_URL`.

## Telegram
After deployment, set the deployed HTTPS URL as the bot's Mini App URL / menu button using BotFather. The backend validates Telegram WebApp `initData` using `BOT_TOKEN`.

Never commit `BOT_TOKEN` to GitHub.
