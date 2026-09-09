import express from 'express'
import crypto from 'crypto'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '256kb' }))

const dbUrl = process.env.DATABASE_URL
const pool = dbUrl
  ? new Pool({ connectionString: dbUrl, ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false } })
  : null

const defaultState = () => ({
  coins: 120, ore: 0, rate: 1, depth: 0, level: 0,
  up: { pick: 0, cart: 0, drill: 0, crew: 0 },
  claimed: false,
  missions: { mine: 0, sell: 0, upgrade: 0 },
  achievements: { firstSell: false, depth: false, rich: false },
  stats: { totalOre: 0, totalCoins: 120, totalUpgrades: 0 },
  lastServerAt: Date.now(),
})

async function initDb() {
  if (!pool) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      state JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS players_updated_at_idx ON players(updated_at)')
}

function validateTelegramInitData(initData) {
  if (!process.env.BOT_TOKEN) return null
  const params = new URLSearchParams(initData || '')
  const hash = params.get('hash')
  if (!hash) throw new Error('Telegram initData hash missing')
  const authDate = Number(params.get('auth_date'))
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > 86400) throw new Error('Telegram initData expired')
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest()
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  const a = Buffer.from(calculated, 'utf8')
  const b = Buffer.from(hash, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid Telegram initData')
  const user = JSON.parse(params.get('user') || '{}')
  if (!user.id) throw new Error('Telegram user missing')
  return user
}

function devUser() {
  return { id: 1, username: 'dev_miner', first_name: 'DeepMiner', last_name: '' }
}

function sanitizeState(input) {
  const d = defaultState()
  const src = input && typeof input === 'object' ? input : {}
  const num = (v, fallback = 0, max = 1e12) => Math.max(0, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : fallback))
  return {
    coins: num(src.coins, d.coins), ore: num(src.ore), rate: num(src.rate, d.rate, 1e6),
    depth: num(src.depth), level: Math.floor(num(src.level)),
    up: { pick: Math.floor(num(src.up?.pick)), cart: Math.floor(num(src.up?.cart)), drill: Math.floor(num(src.up?.drill)), crew: Math.floor(num(src.up?.crew)) },
    claimed: !!src.claimed,
    missions: { mine: num(src.missions?.mine), sell: num(src.missions?.sell), upgrade: Math.floor(num(src.missions?.upgrade)) },
    achievements: { firstSell: !!src.achievements?.firstSell, depth: !!src.achievements?.depth, rich: !!src.achievements?.rich },
    stats: { totalOre: num(src.stats?.totalOre), totalCoins: num(src.stats?.totalCoins, d.stats.totalCoins), totalUpgrades: Math.floor(num(src.stats?.totalUpgrades)) },
    lastServerAt: Number(src.lastServerAt) || Date.now(),
  }
}

function applyOffline(state) {
  const now = Date.now()
  const last = Number(state.lastServerAt) || now
  const elapsed = Math.max(0, Math.min(86400, (now - last) / 1000))
  const mined = elapsed * Number(state.rate || 1)
  state.ore += mined
  state.missions.mine += mined
  state.stats.totalOre += mined
  state.lastServerAt = now
  return state
}

async function getPlayer(user) {
  if (!pool) return null
  const r = await pool.query('SELECT state FROM players WHERE telegram_id=$1', [user.id])
  return r.rows[0]?.state || null
}

async function savePlayer(user, state) {
  if (!pool) return
  await pool.query(`
    INSERT INTO players(telegram_id,username,first_name,last_name,state)
    VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username=EXCLUDED.username, first_name=EXCLUDED.first_name,
      last_name=EXCLUDED.last_name, state=EXCLUDED.state, updated_at=NOW()
  `, [user.id, user.username || null, user.first_name || null, user.last_name || null, state])
}

async function auth(req, res, next) {
  try {
    req.tg = validateTelegramInitData(req.headers['x-telegram-init-data']) || devUser()
    next()
  } catch (e) {
    res.status(401).json({ ok: false, error: e.message })
  }
}

app.get('/api/health', async (req, res) => {
  try {
    if (pool) await pool.query('SELECT 1')
    res.json({ ok: true, game: 'DeepMine', database: !!pool })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.post('/api/bootstrap', auth, async (req, res) => {
  try {
    let state = await getPlayer(req.tg)
    state = sanitizeState(state || defaultState())
    state = applyOffline(state)
    await savePlayer(req.tg, state)
    res.json({ ok: true, user: req.tg, state })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.put('/api/state', auth, async (req, res) => {
  try {
    let state = sanitizeState(req.body?.state)
    state = applyOffline(state)
    await savePlayer(req.tg, state)
    res.json({ ok: true, state })
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

app.use(express.static(path.join(__dirname, '../dist'), { maxAge: '1h' }))
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')))

const port = process.env.PORT || 3000
initDb()
  .then(() => app.listen(port, () => console.log(`DeepMine running on ${port}`)))
  .catch((e) => { console.error(e); process.exit(1) })
