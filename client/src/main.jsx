import React,{useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'

const tg=window.Telegram?.WebApp
const fmt=n=>{n=Number(n)||0;if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return Math.floor(n)}
const layers=[
{name:'Каменный пласт',depth:100,icon:'🪨',value:1,cost:0},
{name:'Угольные жилы',depth:300,icon:'⚫',value:3,cost:500},
{name:'Медные тоннели',depth:600,icon:'🟠',value:8,cost:1500},
{name:'Золотой горизонт',depth:1000,icon:'🟡',value:25,cost:5000},
{name:'Алмазная зона',depth:2000,icon:'💎',value:100,cost:18000},
{name:'Магматическое ядро',depth:5000,icon:'🌋',value:500,cost:75000}]
const upgrades=[
{id:'pick',icon:'⛏️',name:'Стальная кирка',desc:'+1 руда/сек',base:50,bonus:1},
{id:'cart',icon:'🛒',name:'Вагонетка',desc:'+3 руда/сек',base:180,bonus:3},
{id:'drill',icon:'🔩',name:'Буровая установка',desc:'+10 руда/сек',base:650,bonus:10},
{id:'crew',icon:'👷',name:'Шахтёр',desc:'+25 руда/сек',base:2200,bonus:25}]
const fresh=()=>({coins:120,ore:0,rate:1,depth:0,level:0,up:{pick:0,cart:0,drill:0,crew:0},claimed:false,missions:{mine:0,sell:0,upgrade:0},achievements:{firstSell:false,depth:false,rich:false},stats:{totalOre:0,totalCoins:120,totalUpgrades:0},lastServerAt:Date.now()})
function App(){
 const [s,setS]=useState(fresh),[tab,setTab]=useState('mine'),[toast,setToast]=useState(''),[loading,setLoading]=useState(true),[user,setUser]=useState(null)
 const stateRef=useRef(s); useEffect(()=>{stateRef.current=s},[s])
 const layer=layers[Math.min(s.level,layers.length-1)]
 const show=x=>{setToast(x);setTimeout(()=>setToast(''),1800)}
 const save=async(state)=>{try{await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':tg?.initData||''},body:JSON.stringify({state})})}catch{}}
 useEffect(()=>{tg?.ready();tg?.expand();(async()=>{try{const r=await fetch('/api/bootstrap',{method:'POST',headers:{'X-Telegram-Init-Data':tg?.initData||''}});const j=await r.json();if(j.ok){setUser(j.user);setS(j.state)}}finally{setLoading(false)}})()},[])
 useEffect(()=>{if(loading)return;const t=setInterval(()=>setS(x=>{const mined=x.rate/2;const currentLayer=layers[Math.min(x.level,layers.length-1)];return {...x,ore:x.ore+mined,depth:Math.min(currentLayer.depth,x.depth+mined),missions:{...x.missions,mine:x.missions.mine+mined},stats:{...x.stats,totalOre:x.stats.totalOre+mined}}}),500);return()=>clearInterval(t)},[loading,layer.depth])
 useEffect(()=>{if(loading)return;const t=setInterval(()=>save({...stateRef.current,lastServerAt:Date.now()}),15000);return()=>clearInterval(t)},[loading])
 const depthPct=Math.min(100,s.depth/layer.depth*100)
 const upgrade=id=>{const u=upgrades.find(x=>x.id===id),lvl=s.up[id]||0,cost=Math.floor(u.base*Math.pow(1.65,lvl));if(s.coins<cost)return show('Не хватает монет');const ns={...s,coins:s.coins-cost,rate:s.rate+u.bonus,up:{...s.up,[id]:lvl+1},missions:{...s.missions,upgrade:s.missions.upgrade+1},stats:{...s.stats,totalUpgrades:s.stats.totalUpgrades+1}};setS(ns);show('Улучшение куплено')}
 const sell=()=>{if(s.ore<1)return show('Пока нечего продавать');const earned=s.ore*layer.value;const ns={...s,coins:s.coins+earned,ore:0,missions:{...s.missions,sell:s.missions.sell+s.ore},stats:{...s.stats,totalCoins:s.stats.totalCoins+earned},achievements:{...s.achievements,firstSell:true}};setS(ns);show(`+${fmt(earned)} 🪙`);save(ns)}
 const descend=()=>{if(s.level>=layers.length-1)return show('Достигнута максимальная глубина');const next=layers[s.level+1];if(s.coins<next.cost)return show(`Нужно ${fmt(next.cost)} 🪙`);const ns={...s,coins:s.coins-next.cost,level:s.level+1,depth:0,achievements:{...s.achievements,depth:true}};setS(ns);show(`Открыт уровень: ${next.name}`);save(ns)}
 const claim=()=>{if(s.claimed)return show('Награда уже получена');const ns={...s,coins:s.coins+250,claimed:true,stats:{...s.stats,totalCoins:s.stats.totalCoins+250}};setS(ns);show('+250 🪙 за вход');save(ns)}
 const missionDone=s.missions.mine>=1000&&s.missions.sell>=500&&s.missions.upgrade>=5
 if(loading)return <div className="loading">⛏️<b>DeepMine</b><span>Загрузка шахты…</span></div>
 return <div className="app">
  <header><div><div className="logo">⛏️ DeepMine</div><small>{user?.first_name||'Шахтёр'} · {layer.name}</small></div><div className="coins">🪙 {fmt(s.coins)}</div></header>
  {tab==='mine'&&<main><section className="mine-card"><div className="depth">ГЛУБИНА <b>{Math.floor(s.depth)} м</b> / {layer.depth} м</div><div className="shaft"><div className="miner">👷</div><div className="rock">{layer.icon}</div><div className="progress"><i style={{width:`${depthPct}%`}}/></div></div><div className="rate">⚡ {s.rate.toFixed(1)} руда/сек</div><div className="ore">{layer.icon} {fmt(s.ore)} <span>руды</span></div><button className="primary" onClick={sell}>Продать руду · {fmt(s.ore*layer.value)} 🪙</button><button className="secondary" onClick={descend}>Открыть глубже · {s.level<layers.length-1?fmt(layers[s.level+1].cost):'MAX'} 🪙</button></section><section className="stats"><div><b>{fmt(s.stats.totalOre)}</b><span>добыто</span></div><div><b>{s.stats.totalUpgrades}</b><span>улучшений</span></div><div><b>{s.level+1}</b><span>слой</span></div></section></main>}
  {tab==='upgrade'&&<main><h2>Улучшения</h2><p className="muted">Увеличивай автоматическую добычу.</p>{upgrades.map(u=>{const lvl=s.up[u.id]||0,cost=Math.floor(u.base*Math.pow(1.65,lvl));return <div className="item" key={u.id}><div className="itemicon">{u.icon}</div><div className="grow"><b>{u.name}</b><span>{u.desc} · ур. {lvl}</span></div><button onClick={()=>upgrade(u.id)}>{fmt(cost)} 🪙</button></div>})}<div className="panel"><b>🎁 Ежедневная награда</b><span>+250 🪙 один раз за текущую сессию</span><button disabled={s.claimed} onClick={claim}>{s.claimed?'Получено':'Забрать'}</button></div></main>}
  {tab==='missions'&&<main><h2>Задания</h2><div className="mission"><b>⛏️ Добыть 1 000 руды</b><span>{fmt(Math.min(1000,s.missions.mine))}/1K</span><div className="bar"><i style={{width:`${Math.min(100,s.missions.mine/10)}%`}}/></div></div><div className="mission"><b>💰 Продать 500 руды</b><span>{fmt(Math.min(500,s.missions.sell))}/500</span><div className="bar"><i style={{width:`${Math.min(100,s.missions.sell/5)}%`}}/></div></div><div className="mission"><b>🔧 Купить 5 улучшений</b><span>{Math.min(5,s.missions.upgrade)}/5</span><div className="bar"><i style={{width:`${Math.min(100,s.missions.upgrade*20)}%`}}/></div></div><div className="panel">{missionDone?'🏆 Все задания выполнены!':'Продолжай добывать — прогресс сохраняется на сервере.'}</div></main>}
  {tab==='profile'&&<main><div className="profile"><div className="avatar">{(user?.first_name||'D')[0]}</div><h2>{user?.first_name||'DeepMiner'}</h2><span>@{user?.username||'miner'}</span></div><div className="stats big"><div><b>{fmt(s.stats.totalCoins)}</b><span>всего монет</span></div><div><b>{fmt(s.stats.totalOre)}</b><span>всего руды</span></div><div><b>{s.rate.toFixed(1)}</b><span>руды/сек</span></div></div><div className="panel"><b>☁️ Облачное сохранение</b><span>Игровой прогресс привязан к Telegram и хранится в PostgreSQL.</span></div></main>}
  {toast&&<div className="toast">{toast}</div>}
  <nav>{[['mine','⛏️','Шахта'],['upgrade','⚙️','Апгрейд'],['missions','🎯','Задания'],['profile','👤','Профиль']].map(([id,ic,n])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><span>{ic}</span>{n}</button>)}</nav>
 </div>}
createRoot(document.getElementById('root')).render(<App/>)
