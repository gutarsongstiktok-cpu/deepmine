import express from 'express'
import crypto from 'crypto'
import pg from 'pg'
import path from 'path'
import {fileURLToPath} from 'url'

const {Pool}=pg
const __dirname=path.dirname(fileURLToPath(import.meta.url))
const app=express(); app.use(express.json({limit:'256kb'}))
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}}):null

const defaultState=()=>({coins:120,ore:0,rate:1,depth:0,level:0,up:{pick:0,cart:0,drill:0,crew:0},claimed:false,missions:{mine:0,sell:0,upgrade:0},achievements:{firstSell:false,depth:false,rich:false},stats:{totalOre:0,totalCoins:120,totalUpgrades:0},lastServerAt:Date.now()})

async function initDb(){if(!pool)return;await pool.query(`CREATE TABLE IF NOT EXISTS players(telegram_id BIGINT PRIMARY KEY, username TEXT, first_name TEXT, last_name TEXT, state JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)}
function validateTelegramInitData(initData){
  if(!process.env.BOT_TOKEN) return null
  const params=new URLSearchParams(initData||''); const hash=params.get('hash'); if(!hash)throw new Error('Telegram initData hash missing')
  const authDate=Number(params.get('auth_date')); if(!authDate||Date.now()/1000-authDate>86400)throw new Error('Telegram initData expired')
  const data=[]; for(const [k,v] of params.entries())if(k!=='hash')data.push(`${k}=${v}`); data.sort()
  const secret=crypto.createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest()
  const calc=crypto.createHmac('sha256',secret).update(data.join('\n')).digest('hex')
  if(!crypto.timingSafeEqual(Buffer.from(calc),Buffer.from(hash)))throw new Error('Invalid Telegram initData')
  const user=JSON.parse(params.get('user')||'{}'); if(!user.id)throw new Error('Telegram user missing'); return user
}
function devUser(){return {id:1,username:'dev_miner',first_name:'DeepMiner',last_name:''}}
function applyOffline(state){const now=Date.now();const last=Number(state.lastServerAt)||now;const elapsed=Math.max(0,Math.min(86400,(now-last)/1000));state.ore=Number(state.ore||0)+elapsed*Number(state.rate||1);state.lastServerAt=now;return state}
async function upsert(user,state){if(!pool)return;await pool.query(`INSERT INTO players(telegram_id,username,first_name,last_name,state) VALUES($1,$2,$3,$4,$5) ON CONFLICT(telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,state=EXCLUDED.state,updated_at=NOW()`,[user.id,user.username||null,user.first_name||null,user.last_name||null,state])}
async function getPlayer(user){if(!pool)return null;const r=await pool.query('SELECT state FROM players WHERE telegram_id=$1',[user.id]);return r.rows[0]?.state||null}
async function auth(req,res,next){try{req.tg=validateTelegramInitData(req.headers['x-telegram-init-data'])||devUser();next()}catch(e){res.status(401).json({ok:false,error:e.message})}}

app.get('/api/health',async(req,res)=>{try{if(pool)await pool.query('SELECT 1');res.json({ok:true,game:'DeepMine',database:!!pool})}catch(e){res.status(500).json({ok:false,error:e.message})}})
app.post('/api/bootstrap',auth,async(req,res)=>{try{let state=await getPlayer(req.tg);if(!state)state=defaultState();state=applyOffline({...defaultState(),...state,up:{...defaultState().up,...(state.up||{})}});await upsert(req.tg,state);res.json({ok:true,user:req.tg,state})}catch(e){res.status(500).json({ok:false,error:e.message})}})
app.put('/api/state',auth,async(req,res)=>{try{let state={...defaultState(),...(req.body?.state||{})};state=applyOffline(state);await upsert(req.tg,state);res.json({ok:true,state})}catch(e){res.status(400).json({ok:false,error:e.message})}})

app.use(express.static(path.join(__dirname,'../dist')))
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../dist/index.html')))
const port=process.env.PORT||3000
initDb().then(()=>app.listen(port,()=>console.log(`DeepMine running on ${port}`))).catch(e=>{console.error(e);process.exit(1)})
