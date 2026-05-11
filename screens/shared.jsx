// Shared Dotori design tokens + helpers
const DOTORI = {
  brown: '#8B5E3C',
  warmOak: '#A87850',
  lightOak: '#C49A6C',
  ivory: '#FFF8F0',
  cream: '#FDF6EC',
  edge: '#DEC8A8',
  textDark: '#5C3D1E',
  textMid: '#8B5E3C',
  textLight: '#A87850',
  deepBrown: '#6B4226',
  // category accents (from FinanceScreen CAT_CONFIG)
  depositBlue: '#4A9EC9',
  savingsGreen: '#5AAF6E',
  stockPink: '#D9629A',
  realtyOrange: '#D4864A',
  otherGray: '#9EA8B0',
  danger: '#D95F4B',
  warn: '#E09B4B',
  success: '#5AAF6E',
};

function formatAmount(n) {
  if (n === 0) return '0원';
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const won = n % 10_000;
  const parts = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man.toLocaleString()}만`);
  if (won > 0 && eok === 0) parts.push(`${won.toLocaleString()}`);
  return parts.join(' ') + '원';
}

// Bottom tab bar matching Dotori's 5 features (Fridge/Supplies/Finance/Chores/Notes)
// 홈/설정은 상단 헤더로 이동 — 탭바는 핵심 기능 5개에 집중
function DotoriTabBar({ active = '자산' }) {
  const tabs = [
    { k: '음식', icon: 'fridge' },
    { k: '생필품', icon: 'basket' },
    { k: '자산', icon: 'wallet' },
    { k: '일정', icon: 'calendar' },
    { k: '메모', icon: 'note' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingBottom: 34, paddingTop: 10,
      background: '#FFFFFFEE',
      backdropFilter: 'blur(12px)',
      borderTop: `1px solid ${DOTORI.edge}55`,
      display: 'flex', justifyContent: 'space-around',
      zIndex: 10,
    }}>
      {tabs.map(t => (
        <div key={t.k} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          color: t.k === active ? DOTORI.brown : DOTORI.lightOak,
          fontSize: 10, fontWeight: t.k === active ? 700 : 500,
        }}>
          <TabIcon name={t.icon} color={t.k === active ? DOTORI.brown : DOTORI.lightOak} />
          <span>{t.k}</span>
        </div>
      ))}
    </div>
  );
}

function TabIcon({ name, color }) {
  const s = { width: 22, height: 22, stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'home') return <svg {...s} viewBox="0 0 24 24"><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>;
  if (name === 'fridge') return <svg {...s} viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12M9 7v1M9 14v2"/></svg>;
  if (name === 'basket') return <svg {...s} viewBox="0 0 24 24"><path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.7h-7a2 2 0 0 1-2-1.7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9 12v5M15 12v5"/></svg>;
  if (name === 'wallet') return <svg {...s} viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h14v4H5a2 2 0 0 0-2 2z"/><path d="M3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9H5"/><circle cx="16" cy="14" r="1.3" fill={color} stroke="none"/></svg>;
  if (name === 'calendar') return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
  if (name === 'note') return <svg {...s} viewBox="0 0 24 24"><path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M15 4v5h5"/><path d="M8 13h8M8 17h5"/></svg>;
  if (name === 'settings') return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
  return null;
}

// Dotori status bar (cream/brown variant)
function DotoriStatus({ bg = DOTORI.cream }) {
  return (
    <div style={{
      height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '21px 28px 0', background: bg, position: 'relative', zIndex: 5,
    }}>
      <span style={{ fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 16, color: DOTORI.textDark }}>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="0.5" fill={DOTORI.textDark}/><rect x="5" y="5" width="3" height="6" rx="0.5" fill={DOTORI.textDark}/><rect x="10" y="2" width="3" height="9" rx="0.5" fill={DOTORI.textDark}/><rect x="15" y="0" width="3" height="11" rx="0.5" fill={DOTORI.textDark}/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={DOTORI.textDark} strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="18" height="8" rx="1.5" fill={DOTORI.textDark}/></svg>
      </div>
    </div>
  );
}

// Dynamic island
function Island() {
  return (
    <div style={{
      position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
      width: 110, height: 32, borderRadius: 20, background: '#000', zIndex: 100,
    }}/>
  );
}

// Home indicator
function HomeBar({ dark = false }) {
  return (
    <div style={{
      position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
      width: 120, height: 4, borderRadius: 2, background: dark ? 'rgba(255,255,255,0.8)' : 'rgba(92,61,30,0.3)',
      zIndex: 200,
    }}/>
  );
}

// Phone frame shell — 380x780
function Phone({ children, bg = DOTORI.cream, dark = false }) {
  return (
    <div style={{
      width: 380, height: 780, borderRadius: 44, overflow: 'hidden',
      position: 'relative', background: bg,
      fontFamily: '"Pretendard", -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      boxShadow: '0 1px 0 rgba(0,0,0,0.04) inset',
    }}>
      <Island />
      <DotoriStatus bg={bg} />
      {children}
      <HomeBar dark={dark} />
    </div>
  );
}

// Acorn logo (simple, original — two lobes)
function AcornMark({ size = 26, color = DOTORI.brown }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 11c0-1 1-2 2-2h14c1 0 2 1 2 2 0 1-1 2-2 2H7c-1 0-2-1-2-2z" fill={color}/>
      <path d="M7 13h14c0 5-3 11-7 11s-7-6-7-11z" fill={color} opacity="0.55"/>
      <path d="M14 4v5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

// Back chevron
function BackIcon({ color = DOTORI.textDark }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>;
}

Object.assign(window, { DOTORI, formatAmount, DotoriTabBar, DotoriStatus, Island, HomeBar, Phone, AcornMark, BackIcon, TabIcon });
