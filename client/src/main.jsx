import React,{useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'

const tg=window.Telegram?.WebApp
const fmt=n=>{n=Number(n)||0;if(n>=1e12)return(n/1e12).toFixed(1)+'T';if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return Math.floor(n)}
const layers=[
 {name:'Каменная шахта',short:'Камень',depth:100,value:1,color:'stone',cost:0,ore:'🪨'},
 {name:'Угольная шахта',short:'Уголь',depth:300,value:3,color:'coal',cost:500,ore:'⚫'},
 {name:'Медная шахта',short:'Медь',depth:600,value:8,color:'copper',cost:1500,ore:'🟠'},
 {name:'Золотая шахта',short:'Золото',depth:1000,value:25,color:'gold',cost:5000,ore:'🟡'},
 {name:'Алмазная шахта',short:'Алмаз',depth:2000,value:100,color:'diamond',cost:18000,ore:'💎'},
]
const upgrades=[
 {id:'pick',icon:'⛏️',name:'Кирка',desc:'Скорость добычи',base:50,bonus:1},
 {id:'cart',icon:'🛒',name:'Вагонетка',desc:'Больше руды за рейс',base:180,bonus:3},
 {id:'drill',icon:'🔩',name:'Бур',desc:'Мощная автоматизация',base:650,bonus:10},
 {id:'crew',icon:'👷',name:'Бригада',desc:'Новые рабочие',base:2200,bonus:25}
]
const fresh=()=>({coins:120,ore:0,rate:1,depth:0,level:0,up:{pick:0,cart:0,drill:0,crew:0},claimed:false,missions:{mine:0,sell:0,upgrade:0},achievements:{firstSell:false,depth:false,rich:false},stats:{totalOre:0,totalCoins:120,totalUpgrades:0},lastServerAt:Date.now()})
function App(){
 const [s,setS]=useState(fresh),[tab,setTab]=useState('mine'),[toast,setToast]=useState(''),[loading,setLoading]=useState(true),[user,setUser]=useState(null),[auto,setAuto]=useState(true)
 const stateRef=useRef(s);useEffect(()=>{stateRef.current=s},[s])
 const layer=layers[Math.min(s.level,layers.length-1)]
 const next=layers[s.level+1]
 const show=x=>{setToast(x);window.clearTimeout(show.t);show.t=window.setTimeout(()=>setToast(''),1800)}
 const save=async(state)=>{try{await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':tg?.initData||''},body:JSON.stringify({state})})}catch{}}
 useEffect(()=>{tg?.ready();tg?.expand();(async()=>{try{const r=await fetch('/api/bootstrap',{method:'POST',headers:{'X-Telegram-Init-Data':tg?.initData||''}});const j=await r.json();if(j.ok){setUser(j.user);setS(j.state)}}catch{}finally{setLoading(false)}})()},[])
 useEffect(()=>{if(loading||!auto)return;const t=setInterval(()=>setS(x=>{const mined=x.rate/2;const d=Math.min(layer.depth,x.depth+mined);return {...x,ore:x.ore+mined,depth:d,missions:{...x.missions,mine:x.missions.mine+mined},stats:{...x.stats,totalOre:x.stats.totalOre+mined}}}),500);return()=>clearInterval(t)},[loading,auto,layer.depth])
 useEffect(()=>{if(loading)return;const t=setInterval(()=>save({...stateRef.current,lastServerAt:Date.now()}),12000);return()=>clearInterval(t)},[loading])
 const depthPct=Math.min(100,s.depth/layer.depth*100)
 const totalWorkers=1+Object.values(s.up).reduce((a,b)=>a+b,0)
 const upgrade=id=>{const u=upgrades.find(x=>x.id===id),lvl=s.up[id]||0,cost=Math.floor(u.base*Math.pow(1.65,lvl));if(s.coins<cost)return show('Не хватает монет');const ns={...s,coins:s.coins-cost,rate:s.rate+u.bonus,up:{...s.up,[id]:lvl+1},missions:{...s.missions,upgrade:s.missions.upgrade+1},stats:{...s.stats,totalUpgrades:s.stats.totalUpgrades+1}};setS(ns);show('Улучшение куплено');save(ns)}
 const sell=()=>{if(s.ore<1)return show('Вагонетка пока пуста');const earned=s.ore*layer.value;const ns={...s,coins:s.coins+earned,ore:0,missions:{...s.missions,sell:s.missions.sell+s.ore},stats:{...s.stats,totalCoins:s.stats.totalCoins+earned},achievements:{...s.achievements,firstSell:true}};setS(ns);show(`+${fmt(earned)} монет`);save(ns)}
 const descend=()=>{if(!next)return show('Все доступные горизонты открыты');if(s.coins<next.cost)return show(`Нужно ${fmt(next.cost)} монет`);const ns={...s,coins:s.coins-next.cost,level:s.level+1,depth:0,achievements:{...s.achievements,depth:true}};setS(ns);show(`Открыта ${next.name}`);save(ns)}
 const claim=()=>{if(s.claimed)return show('Награда уже получена');const ns={...s,coins:s.coins+250,claimed:true,stats:{...s.stats,totalCoins:s.stats.totalCoins+250}};setS(ns);show('+250 за ежедневный вход');save(ns)}
 if(loading)return <div className="loading"><div className="loadingPick">⛏</div><b>DEEPMINE</b><span>Загрузка шахты…</span></div>
 return <div className="game">
  <header className="topbar"><div className="brand"><span className="brandPick">⛏</span><div><strong>DEEPMINE</strong><small>{user?.first_name||'Шахтёр'}</small></div></div><div className="wallet"><span>🪙</span><b>{fmt(s.coins)}</b><button onClick={()=>show('Монеты добываются автоматически')}>+</button></div></header>
  {tab==='mine'&&<main className="minePage">
   <section className="world">
    <div className="sky"><div className="mountain m1"/><div className="mountain m2"/><div className="mountain m3"/><div className="sun"/><div className="cloud c1"/><div className="cloud c2"/><div className="tree t1"/><div className="tree t2"/><div className="tree t3"/></div>
    <div className="surface"><div className="grass"/><div className="worker surfaceWorker"><i>👷</i><span>+</span></div><div className="office"><div>🏠</div><small>Штаб</small></div><div className="moneyFloat">🪙 {fmt(s.coins/4)}</div></div>
    <div className="ground">
      <div className="rockLayer topRocks"><i/><i/><i/><i/><i/></div>
      <div className="tunnel tunnel1"><div className="lamp">💡</div><div className="cart">🛒</div><div className="orePile">{layer.ore}</div><div className="worker miner1">👷</div><div className="coinLabel">🪙 {fmt(s.ore*layer.value)}</div></div>
      <div className="tunnel tunnel2"><div className="lamp">💡</div><div className="worker miner2">👷</div><div className="worker miner3">👷</div><div className="rockFace">⛏️</div><div className="coinLabel">🪙 {fmt(s.rate*100)}</div></div>
      <div className="tunnel tunnel3"><div className="lamp">💡</div><div className="worker miner4">👷</div><div className="rockFace dark">⛏️</div></div>
      <div className="fossil">🦴</div><div className="pebbles">•　•　•　•　•</div>
      <div className="depthBadge"><small>ГЛУБИНА</small><b>{Math.floor(s.depth)} м</b><span>{layer.short}</span></div>
    </div>
   </section>
   <section className="controlPanel">
    <div className="statsRow"><div><small>ДОБЫЧА</small><b>⚡ {s.rate.toFixed(1)}/с</b></div><div><small>РАБОЧИЕ</small><b>👷 {totalWorkers}</b></div><div><small>СЛОЙ</small><b>{s.level+1}/{layers.length}</b></div></div>
    <div className="oreBox"><div className="oreIcon">{layer.ore}</div><div><small>{layer.name}</small><strong>{fmt(s.ore)} <em>руды</em></strong></div><button onClick={sell}>ПРОДАТЬ<br/><span>🪙 {fmt(s.ore*layer.value)}</span></button></div>
    <div className="depthProgress"><div><span>До следующего уровня</span><b>{next?`${Math.floor(s.depth)}/${next.depth} м`:'MAX'}</b></div><div className="bar"><i style={{width:`${depthPct}%`}}/></div></div>
    <div className="actionRow"><button className="bigAction" onClick={()=>setAuto(v=>!v)}><span>{auto?'⛏️':'⏸️'}</span>{auto?'АВТОДОБЫЧА':'ПАУЗА'}</button><button className="bigAction gold" onClick={descend} disabled={!next}>{next?`НОВЫЙ СТВОЛ · 🪙 ${fmt(next.cost)}`:'МАКС. ГЛУБИНА'}</button></div>
   </section>
  </main>}
  {tab==='upgrade'&&<main className="panelPage"><div className="pageTitle"><h1>Улучшения</h1><p>Развивай шахту и увеличивай прибыль.</p></div>{upgrades.map(u=>{const lvl=s.up[u.id]||0,cost=Math.floor(u.base*Math.pow(1.65,lvl));return <div className="upgradeCard" key={u.id}><div className="upgradeIcon">{u.icon}</div><div className="grow"><b>{u.name} <small>ур. {lvl}</small></b><span>{u.desc} +{u.bonus}/с</span></div><button onClick={()=>upgrade(u.id)}>🪙 {fmt(cost)}</button></div>})}<div className="daily"><div>🎁</div><div className="grow"><b>Ежедневная награда</b><span>Бонус за возвращение в шахту</span></div><button disabled={s.claimed} onClick={claim}>{s.claimed?'✓':'ЗАБРАТЬ'}</button></div></main>}
  {tab==='workers'&&<main className="panelPage"><div className="pageTitle"><h1>Бригада</h1><p>Каждый рабочий помогает шахте работать без тебя.</p></div><div className="crewCard"><div className="bigWorker">👷</div><div><small>ВСЕГО РАБОЧИХ</small><strong>{totalWorkers}</strong></div><div><small>СКОРОСТЬ</small><strong>{s.rate.toFixed(1)}/с</strong></div></div>{upgrades.slice(0,3).map((u,i)=><div className="workerRow" key={u.id}><span className="avatar">{['👷','🧑‍🔧','🧑‍🏭'][i]}</span><div className="grow"><b>{['Шахтёр','Механик','Бурильщик'][i]}</b><small>уровень {s.up[u.id]||0}</small></div><span>+{u.bonus}/с</span></div>)}</main>}
  {tab==='missions'&&<main className="panelPage"><div className="pageTitle"><h1>Задания</h1><p>Выполняй задачи и развивай шахту.</p></div>{[['mine','⛏️','Добыть 1 000 руды',1000],['sell','💰','Продать 500 руды',500],['upgrade','🔧','Купить 5 улучшений',5]].map(([id,ic,name,target])=>{const val=s.missions[id];const pct=Math.min(100,val/target*100);return <div className="missionCard" key={id}><div className="missionIcon">{ic}</div><div className="grow"><b>{name}</b><div className="missionBar"><i style={{width:`${pct}%`}}/></div><small>{fmt(Math.min(target,val))} / {fmt(target)}</small></div><strong>{Math.floor(pct)}%</strong></div>})}<div className="achievement"><span>🏆</span><div><b>Первый заработок</b><small>{s.achievements.firstSell?'Выполнено':'Продай первую руду'}</small></div><strong>{s.achievements.firstSell?'✓':'○'}</strong></div></main>}
  {toast&&<div className="toast">{toast}</div>}
  <nav className="bottomNav">{[['mine','⛏️','Шахта'],['upgrade','🔧','Апгрейд'],['workers','👷','Рабочие'],['missions','🏆','Задания']].map(([id,ic,n])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><span>{ic}</span>{n}</button>)}</nav>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>)
