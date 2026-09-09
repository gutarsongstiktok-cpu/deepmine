import React,{useEffect,useMemo,useState} from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'

const fmt=n=>n>=1e9?(n/1e9).toFixed(1)+'B':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':Math.floor(n)
const layers=[
 {name:'Каменный пласт',depth:100,icon:'🪨',value:1},
 {name:'Угольные жилы',depth:300,icon:'⚫',value:3},
 {name:'Медные тоннели',depth:600,icon:'🟠',value:8},
 {name:'Золотой горизонт',depth:1000,icon:'🟡',value:25},
 {name:'Алмазная зона',depth:2000,icon:'💎',value:100},
 {name:'Магматическое ядро',depth:5000,icon:'🌋',value:500}
]
const upgrades=[
 {id:'pick',icon:'⛏️',name:'Стальная кирка',desc:'+1 добыча/сек',base:50},
 {id:'cart',icon:'🛒',name:'Вагонетка',desc:'+3 добыча/сек',base:180},
 {id:'drill',icon:'🔩',name:'Буровая установка',desc:'+10 добыча/сек',base:650},
 {id:'crew',icon:'👷',name:'Новый шахтёр',desc:'+25 добыча/сек',base:2200}
]
function initial(){return {coins:120,ore:0,rate:1,depth:0,level:0,up:{pick:0,cart:0,drill:0,crew:0},last:Date.now(),tab:'mine',claimed:false}}
function App(){
 const [s,setS]=useState(()=>{try{return {...initial(),...JSON.parse(localStorage.deepmine||'{}')}}catch{return initial()}})
 const [toast,setToast]=useState('')
 useEffect(()=>{localStorage.deepmine=JSON.stringify({...s,last:Date.now()})},[s])
 useEffect(()=>{const t=setInterval(()=>setS(x=>({...x,ore:x.ore+x.rate/2})),500);return()=>clearInterval(t)},[])
 const layer=layers[Math.min(s.level,layers.length-1)]
 const depthPct=Math.min(100,(s.depth/layer.depth)*100)
 const upgrade=id=>{
   const u=upgrades.find(x=>x.id===id), lvl=s.up[id]||0, cost=Math.floor(u.base*Math.pow(1.65,lvl))
   if(s.coins<cost){setToast('Не хватает монет');return}
   const bonus={pick:1,cart:3,drill:10,crew:25}[id]
   setS(x=>({...x,coins:x.coins-cost,rate:x.rate+bonus,up:{...x.up,[id]:lvl+1}}))
   setToast('Улучшение куплено!')
 }
 const sell=()=>{if(s.ore<1)return;setS(x=>({...x,coins:x.coins+x.ore*layer.value,ore:0}));setToast('Руда продана')}
 const descend=()=>{
   if(s.level>=layers.length-1){setToast('Вы достигли максимальной глубины MVP');return}
   const cost=Math.floor(500*Math.pow(3,s.level))
   if(s.coins<cost){setToast('Нужно '+fmt(cost)+' 🪙');return}
   setS(x=>({...x,coins:x.coins-cost,level:x.level+1,depth:0}))
 }
 const collect=()=>{if(s.claimed)return;setS(x=>({...x,coins:x.coins+500,claimed:true}));setToast('Ежедневная награда +500 🪙')}
 const tabs=[['mine','⛏️','Шахта'],['team','👷','Команда'],['up','⚙️','Улучшения'],['profile','🏆','Профиль']]
 return <div className="app">
  <header><div><div className="logo">DEEP<span>MINE</span></div><div className="sub">IDLE MINING COMPANY</div></div><div className="coins">🪙 {fmt(s.coins)}</div></header>
  {s.tab==='mine'&&<main>
    <section className="hero">
      <div className="depth">ГЛУБИНА <b>{Math.floor(s.depth)} м</b></div>
      <div className="mine-art"><div className="moon">◈</div><div className="shaft"><div className="miner">👷</div><div className="rock">⛏️</div></div></div>
      <div className="layer">{layer.icon} {layer.name}</div>
      <div className="progress"><i style={{width:depthPct+'%'}}/></div>
      <div className="stats"><span>⚡ {s.rate.toFixed(1)}/сек</span><span>📦 {fmt(s.ore)} руды</span></div>
      <div className="actions"><button onClick={sell}>💰 ПРОДАТЬ РУДУ</button><button className="secondary" onClick={descend}>⬇️ УГЛУБИТЬСЯ</button></div>
    </section>
    <section className="card"><div className="cardtitle">📋 МИССИИ</div><div className="mission"><div><b>Начать карьеру</b><small>Добудьте 1 000 руды</small></div><strong>+300 🪙</strong></div><div className="mission"><div><b>Первые шаги</b><small>Купите 3 улучшения</small></div><strong>+5 💎</strong></div></section>
    <section className="card daily"><div><div><b>🎁 Ежедневная награда</b><small>Возвращайтесь каждый день</small></div><button disabled={s.claimed} onClick={collect}>{s.claimed?'ПОЛУЧЕНО':'ЗАБРАТЬ 500 🪙'}</button></div></section>
  </main>}
  {s.tab==='up'&&<main><h2>⚙️ Улучшения</h2>{upgrades.map(u=>{let lvl=s.up[u.id]||0,cost=Math.floor(u.base*Math.pow(1.65,lvl));return <div className="upgrade card" key={u.id}><div className="uicon">{u.icon}</div><div className="udata"><b>{u.name}</b><small>{u.desc} · Уровень {lvl}</small><div className="cost">🪙 {fmt(cost)}</div></div><button onClick={()=>upgrade(u.id)}>УЛУЧШИТЬ</button></div>})}</main>}
  {s.tab==='team'&&<main><h2>👷 Команда</h2><div className="bigcard"><div className="worker">👷‍♂️</div><h3>Шахтёр-новичок</h3><p>Ваши шахтёры работают автоматически, пока вы офлайн.</p><div className="statline"><span>Производительность</span><b>{s.rate.toFixed(1)} руда/сек</b></div></div><div className="bigcard"><h3>🚧 Следующий сотрудник</h3><p>Покупайте улучшения, чтобы расширять команду.</p><button onClick={()=>setS(x=>({...x,tab:'up'}))}>ОТКРЫТЬ УЛУЧШЕНИЯ</button></div></main>}
  {s.tab==='profile'&&<main><h2>🏆 Профиль</h2><div className="profile card"><div className="avatar">⛏️</div><h3>Шахтёр #001</h3><div className="rank">НОВИЧОК</div><div className="statgrid"><span>Уровень шахты<b>{s.level+1}</b></span><span>Глубина<b>{Math.floor(s.depth)} м</b></span><span>Скорость<b>{s.rate.toFixed(1)}/сек</b></span><span>Улучшения<b>{Object.values(s.up).reduce((a,b)=>a+b,0)}</b></span></div></div><div className="card"><div className="cardtitle">🏅 ДОСТИЖЕНИЯ</div><div className="ach">⛏️ Первый миллион <small>Заработать 1 000 000 🪙</small></div><div className="ach">💎 Алмазный магнат <small>Найти 100 алмазов</small></div><div className="ach">🌋 Глубоководный <small>Достичь 5 000 м</small></div></div></main>}
  <nav>{tabs.map(([id,ic,name])=><button className={s.tab===id?'active':''} onClick={()=>setS(x=>({...x,tab:id}))} key={id}><span>{ic}</span>{name}</button>)}</nav>
  {toast&&<div className="toast" onAnimationEnd={()=>setToast('')}>{toast}</div>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>)
