import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ArrowLeft, CheckCircle2, CircleUserRound, Clock3, Coins, Flame, Gem, History, Layers3, Package, RefreshCw, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react';

type Skin = { id: string; marketHashName: string; weapon: string; exterior?: string | null; rarity: string; imageUrl?: string | null; referencePrice: string | number };
type Instance = { id: string; status: string; catalog: Skin };
type CaseItem = { id: string; weight: number; catalog: Skin };
type CaseData = { id: string; name: string; description: string; price: string | number; items: CaseItem[] };
const API = (import.meta as any).env.VITE_API_URL || 'http://localhost:10000';
const fmt = (n: string | number) => '$' + Number(n).toFixed(2);
const chanceFor = (a: number, b: number) => Math.max(0.01, Math.min(50, Math.floor((a / b) * 75 * 100) / 100));
const colors: Record<string, string> = { Consumer: '#8c9aa8', Industrial: '#70a4ff', Classified: '#d46aff', Covert: '#ff5368', Extraordinary: '#ffc15c' };

export default function App() {
  const [tab, setTab] = useState<'cases' | 'upgrade' | 'inventory' | 'profile'>('upgrade');
  const [cases, setCases] = useState<CaseData[]>([]);
  const [catalog, setCatalog] = useState<Skin[]>([]);
  const [inventory, setInventory] = useState<Instance[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [selectedInput, setSelectedInput] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [animation, setAnimation] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [history, setHistory] = useState<any>({ openings: [], upgrades: [] });

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const tg = (window as any).Telegram?.WebApp;
    const res = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(tg?.initData ? { 'X-Telegram-Init-Data': tg.initData } : {}), ...(init?.headers || {}) } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
    return data;
  }, []);

  const load = useCallback(async () => {
    try {
      const [c, s, i, p, h] = await Promise.all([api('/api/v1/cases'), api('/api/v1/catalog/skins'), api('/api/v1/inventory'), api('/api/v1/me'), api('/api/v1/history')]);
      setCases(c); setCatalog(s); setInventory(i); setProfile(p); setHistory(h);
      if (!selectedInput && i.length) setSelectedInput(i[0].id);
      if (!selectedTarget && s.length) setSelectedTarget(s[s.length - 1].id);
    } catch (e: any) { setNotice(e.message + ' — проверь API и базу данных.'); }
  }, [api, selectedInput, selectedTarget]);
  useEffect(() => { void load(); }, [load]);

  const selectedInstance = inventory.find(i => i.id === selectedInput);
  const selectedSkin = catalog.find(s => s.id === selectedTarget);
  const upgradeChance = selectedInstance && selectedSkin ? chanceFor(Number(selectedInstance.catalog.referencePrice), Number(selectedSkin.referencePrice)) : 0;
  const targetOptions = useMemo(() => catalog.filter(s => !selectedInstance || Number(s.referencePrice) > Number(selectedInstance.catalog.referencePrice)), [catalog, selectedInstance]);

  async function openCase(c: CaseData) {
    setBusy(true); setNotice(''); setLastResult(null);
    try {
      const data = await api(`/api/v1/cases/${c.id}/open`, { method: 'POST', body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      setLastResult({ type: 'case', item: data.item, operation: data.operation });
      setNotice(`Выпал предмет: ${data.item?.catalog?.marketHashName || data.operation?.resultName || 'результат сохранён'}`);
      await load(); setTab('inventory');
    } catch (e: any) { setNotice(e.message); }
    finally { setBusy(false); }
  }

  async function runUpgrade() {
    if (!selectedInstance || !selectedSkin) return;
    setBusy(true); setAnimation(true); setNotice(''); setLastResult(null);
    try {
      // Let the animation start; the server remains the sole authority for the outcome.
      await new Promise(r => setTimeout(r, 1200));
      const data = await api('/api/v1/upgrades', { method: 'POST', body: JSON.stringify({ inputInstanceId: selectedInstance.id, targetCatalogId: selectedSkin.id, idempotencyKey: crypto.randomUUID() }) });
      setLastResult({ type: 'upgrade', ...data, target: selectedSkin, input: selectedInstance.catalog });
      setNotice(data.operation?.result === 'SUCCESS' ? 'Апгрейд успешен!' : 'Апгрейд не удался. Исходный предмет списан в демо-режиме.');
      await load();
    } catch (e: any) { setNotice(e.message); }
    finally { setAnimation(false); setBusy(false); }
  }

  const SkinArt = ({ skin, large = false }: { skin?: Skin; large?: boolean }) => <div className={`skin-art ${large ? 'large' : ''}`} style={{ '--rarity': colors[skin?.rarity || 'Classified'] } as React.CSSProperties}>{skin?.imageUrl ? <img src={skin.imageUrl} alt={skin.marketHashName} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <div className="weapon-symbol">{skin?.weapon?.includes('Knife') ? '🔪' : skin?.weapon === 'AWP' ? '🎯' : '⌁'}</div>}<span className="rarity-dot"/></div>;

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Zap size={19}/></div><div><strong>CS2 <span>UPGRADER</span></strong><small>MINI APP · DEMO</small></div></div><div className="balance"><Coins size={16}/><span>{fmt(profile?.balance ?? 1000)}</span></div></header>
    <section className="hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={12}/> SKIN LAB / 001</span><h1>Upgrade your<br/><em>arsenal.</em></h1><p>Открывай кейсы. Рискуй с умом. Собирай коллекцию.</p></div><div className="hero-gem"><Gem size={70} strokeWidth={1.1}/><div className="orbit orbit-one"/><div className="orbit orbit-two"/></div><div className="demo-pill"><ShieldCheck size={12}/> ТЕСТОВЫЙ РЕЖИМ</div></section>
    {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')}>×</button></div>}
    {tab === 'upgrade' && <section className="panel"><div className="section-head"><div><span className="eyebrow">01 / UPGRADE ENGINE</span><h2>Апгрейд скина</h2></div><span className="live-dot">DEMO</span></div>
      <div className={`upgrade-stage ${animation ? 'is-rolling' : ''}`}>
        <div className="item-slot"><span className="slot-label">ТВОЙ СКИН</span><SkinArt skin={selectedInstance?.catalog} large/><strong>{selectedInstance?.catalog.marketHashName || 'Выбери предмет'}</strong><b>{selectedInstance ? fmt(selectedInstance.catalog.referencePrice) : '—'}</b><select aria-label="Исходный скин" value={selectedInput} onChange={e => setSelectedInput(e.target.value)}><option value="">Выбрать из инвентаря</option>{inventory.map(i => <option key={i.id} value={i.id}>{i.catalog.marketHashName} · {fmt(i.catalog.referencePrice)}</option>)}</select></div>
        <div className="versus"><div className="versus-icon"><ArrowDownUp size={19}/></div><span>VS</span></div>
        <div className="item-slot target-slot"><span className="slot-label">ЦЕЛЕВОЙ СКИН</span><SkinArt skin={selectedSkin} large/><strong>{selectedSkin?.marketHashName || 'Выбери цель'}</strong><b>{selectedSkin ? fmt(selectedSkin.referencePrice) : '—'}</b><select aria-label="Целевой скин" value={selectedTarget} onChange={e => setSelectedTarget(e.target.value)}><option value="">Выбрать цель</option>{targetOptions.map(s => <option key={s.id} value={s.id}>{s.marketHashName} · {fmt(s.referencePrice)}</option>)}</select></div>
      </div>
      <div className="chance-card"><div className="chance-top"><div><span>ШАНС УСПЕХА</span><strong>{selectedInstance && selectedSkin ? `${upgradeChance.toFixed(2)}%` : '—'}</strong></div><div className="chance-badge"><Flame size={15}/> HIGH RISK</div></div><div className="chance-track"><div style={{ width: `${upgradeChance}%` }}/></div><div className="chance-foot"><span>0%</span><span>Шанс рассчитан сервером</span><span>100%</span></div></div>
      <button className="primary-btn" disabled={busy || !selectedInstance || !selectedSkin || !targetOptions.some(s => s.id === selectedTarget)} onClick={() => void runUpgrade()}>{animation ? <><RefreshCw className="spin" size={17}/> Розыгрыш...</> : <><Zap size={17}/> Запустить апгрейд</>}</button>
      <p className="fine-print">В демо-режиме предметы виртуальные и не имеют денежной стоимости. Не реальные CS2-предметы.</p>
      {lastResult?.type === 'upgrade' && <div className={`result-card ${lastResult.operation?.result === 'SUCCESS' ? 'win' : 'lose'}`}><div className="result-icon">{lastResult.operation?.result === 'SUCCESS' ? <CheckCircle2/> : <Package/>}</div><div><strong>{lastResult.operation?.result === 'SUCCESS' ? 'Апгрейд успешен!' : 'Неудача'}</strong><p>{lastResult.operation?.result === 'SUCCESS' ? `Получен ${lastResult.target?.marketHashName}` : 'Исходный предмет списан по правилам демо-режима.'}</p></div></div>}
    </section>}

    {tab === 'cases' && <section className="panel"><div className="section-head"><div><span className="eyebrow">02 / CASE OPENING</span><h2>Выбери кейс</h2></div><Layers3/></div><div className="case-grid">{cases.map((c, idx) => <article className="case-card" key={c.id}><div className={`case-visual case-${idx}`}><Package size={54}/><span className="case-glow"/></div><div className="case-info"><strong>{c.name}</strong><p>{c.description}</p><div className="case-bottom"><b>{fmt(c.price)}</b><button disabled={busy} onClick={() => void openCase(c)}>{busy ? '...' : 'Открыть'}</button></div></div><div className="case-rewards">{c.items.slice(0, 4).map(i => <div key={i.id} title={i.catalog.marketHashName}><SkinArt skin={i.catalog}/></div>)}</div></article>)}</div><p className="fine-print">Все кейсы работают только с тестовым балансом. Реальные платежи отключены.</p></section>}

    {tab === 'inventory' && <section className="panel"><div className="section-head"><div><span className="eyebrow">03 / YOUR COLLECTION</span><h2>Инвентарь <small>{inventory.length}</small></h2></div><Package/></div>{inventory.length ? <div className="inventory-grid">{inventory.map(i => <button className={`inventory-item ${selectedInput === i.id ? 'selected' : ''}`} key={i.id} onClick={() => { setSelectedInput(i.id); setTab('upgrade'); }}><SkinArt skin={i.catalog} large/><strong>{i.catalog.marketHashName}</strong><span>{fmt(i.catalog.referencePrice)}</span><small>Нажми для апгрейда</small></button>)}</div> : <div className="empty"><Package size={32}/><strong>Инвентарь пока пуст</strong><p>Открой тестовый кейс, чтобы получить предметы.</p><button className="secondary-btn" onClick={() => setTab('cases')}>К кейсам</button></div>}</section>}

    {tab === 'profile' && <section className="panel"><div className="section-head"><div><span className="eyebrow">04 / PLAYER PROFILE</span><h2>Профиль</h2></div><CircleUserRound/></div><div className="profile-card"><div className="avatar"><CircleUserRound size={30}/></div><div><strong>{profile?.firstName || 'Demo Player'}</strong><span>@{profile?.username || 'demo_player'}</span></div><span className="demo-tag">DEMO</span></div><div className="stats-grid"><div><span>Баланс</span><strong>{fmt(profile?.balance ?? 1000)}</strong></div><div><span>Предметы</span><strong>{profile?.stats?.itemsCount ?? inventory.length}</strong></div><div><span>Открытия</span><strong>{profile?.stats?.openingsCount ?? 0}</strong></div><div><span>Апгрейды</span><strong>{profile?.stats?.upgradesCount ?? 0}</strong></div></div><div className="section-head history-heading"><div><span className="eyebrow">ACTIVITY LOG</span><h2>История</h2></div><History/></div><div className="history-list">{[...(history.openings || []).map((x: any) => ({ ...x, kind: 'Кейс', label: x.resultName || x.case?.name })), ...(history.upgrades || []).map((x: any) => ({ ...x, kind: 'Апгрейд', label: x.result }))].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 12).map((x: any) => <div className="history-row" key={x.id}><div className="history-icon"><Clock3 size={16}/></div><div><strong>{x.kind}: {x.label || 'Операция'}</strong><span>{new Date(x.createdAt).toLocaleString()}</span></div><span className="status-ok">{x.status}</span></div>)}{!history.openings?.length && !history.upgrades?.length && <p className="muted">Операций пока нет.</p>}</div></section>}

    <nav className="bottom-nav">{([{ id: 'cases', label: 'Кейсы', icon: Package }, { id: 'upgrade', label: 'Апгрейд', icon: ArrowDownUp }, { id: 'inventory', label: 'Инвентарь', icon: Layers3 }, { id: 'profile', label: 'Профиль', icon: CircleUserRound }] as const).map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={19}/><span>{item.label}</span></button>; })}</nav>
    <footer><span>CS2 UPGRADER / BUILD 0.1</span><span>SIMULATION ONLY</span></footer>
  </main>;
}
