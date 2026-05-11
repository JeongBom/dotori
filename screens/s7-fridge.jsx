// Screen: 음식 (Fridge) — 보관 중인 식품 관리
function ScreenFridge() {
  return (
    <Phone bg={DOTORI.cream}>
      {/* Header */}
      <div style={{ padding: '6px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 600 }}>우리 집 냉장고</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.4, marginTop: 1 }}>음식</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></IconBtn>
          <IconBtn><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M6 12h12M9 18h6"/></svg></IconBtn>
        </div>
      </div>

      {/* Summary strip: 3 stat cards */}
      <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8 }}>
        <StatBlock color={DOTORI.brown} primary="23" label="전체" sub="보관 중" />
        <StatBlock color={DOTORI.warn} primary="4" label="임박" sub="D-3 이내" />
        <StatBlock color={DOTORI.danger} primary="1" label="초과" sub="D-day 넘음" />
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, overflow: 'hidden' }}>
        {[['전체', true], ['냉장', false], ['냉동', false], ['실온', false], ['먹은 음식', false]].map(([f, active]) => (
          <div key={f} style={{
            padding: '5px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600, flexShrink: 0,
            background: active ? DOTORI.brown : DOTORI.ivory,
            color: active ? '#fff' : DOTORI.textMid,
            border: `1px solid ${active ? DOTORI.brown : DOTORI.edge}`,
          }}>{f}</div>
        ))}
      </div>

      {/* Sort bar */}
      <div style={{ padding: '0 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 500 }}>23개 · 임박순</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textMid} strokeWidth="2" strokeLinecap="round"><path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/></svg>
          <span style={{ fontSize: 11, color: DOTORI.textMid, fontWeight: 600 }}>유통기한순</span>
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ height: 432, overflow: 'hidden', padding: '4px 16px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Section label */}
          <SectionLabel label="기한 지남" count={1} color={DOTORI.danger}/>
          <FoodRow name="우유 1L" storage="냉장" date="4.18" dday="D+3" ddayColor={DOTORI.danger} qty={1} checked={false} />

          <SectionLabel label="임박" count={4} color={DOTORI.warn}/>
          <FoodRow name="두부" storage="냉장" date="4.20" dday="D-1" ddayColor={DOTORI.danger} qty={1} />
          <FoodRow name="애호박" storage="냉장" date="4.23" dday="D-2" ddayColor={DOTORI.warn} qty={2} />
          <FoodRow name="계란 10구" storage="냉장" date="4.24" dday="D-3" ddayColor={DOTORI.warn} qty={1} />

          <SectionLabel label="여유" count={18} color={DOTORI.brown}/>
          <FoodRow name="냉동 만두" storage="냉동" date="5.12" dday="D-21" ddayColor={DOTORI.textMid} qty={3} />
          <FoodRow name="김치" storage="냉장" date="5.30" dday="D-39" ddayColor={DOTORI.textMid} qty={1} />
          <FoodRow name="라면" storage="실온" date="8.15" dday="D-116" ddayColor={DOTORI.textMid} qty={5} />
        </div>
      </div>

      {/* FAB */}
      <div style={{
        position: 'absolute', bottom: 94, right: 20,
        width: 52, height: 52, borderRadius: 26, background: DOTORI.brown,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(139,94,60,0.4)', zIndex: 5,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </div>

      <DotoriTabBar active="음식" />
    </Phone>
  );
}

function StatBlock({ color, primary, label, sub }) {
  return (
    <div style={{ background: DOTORI.ivory, borderRadius: 14, padding: '10px 12px', boxShadow: '0 2px 6px rgba(139,94,60,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: -0.5, lineHeight: 1 }}>{primary}</div>
        <div style={{ fontSize: 10, color: DOTORI.textMid, fontWeight: 600 }}>{label}</div>
      </div>
      <div style={{ fontSize: 10, color: DOTORI.textLight, fontWeight: 500, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function SectionLabel({ label, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: -2 }}>
      <div style={{ width: 6, height: 6, borderRadius: 3, background: color }}/>
      <span style={{ fontSize: 10, fontWeight: 700, color: DOTORI.textDark, letterSpacing: 0.3 }}>{label}</span>
      <span style={{ fontSize: 10, color: DOTORI.textLight, fontWeight: 600 }}>{count}</span>
    </div>
  );
}

function FoodRow({ name, storage, date, dday, ddayColor, qty, checked }) {
  const storageBg = storage === '냉동' ? '#C8D8F0' : storage === '실온' ? '#F0E8D4' : '#EDD9C0';
  const storageFg = storage === '냉동' ? '#5A7EC9' : storage === '실온' ? '#A07840' : '#8B5E3C';
  return (
    <div style={{
      background: DOTORI.ivory, borderRadius: 14, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 1px 4px rgba(139,94,60,0.05)',
      opacity: checked ? 0.5 : 1,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11,
        border: `1.8px solid ${checked ? DOTORI.brown : DOTORI.edge}`,
        background: checked ? DOTORI.brown : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5 10-11"/></svg>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DOTORI.textDark, marginBottom: 3, textDecoration: checked ? 'line-through' : 'none' }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: storageBg, color: storageFg }}>{storage}</span>
          <span style={{ fontSize: 10, color: DOTORI.textLight }}>넣은날 {date}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: DOTORI.edge + '88', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: DOTORI.textDark, lineHeight: 1 }}>−</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: DOTORI.textDark, minWidth: 12, textAlign: 'center' }}>{qty}</span>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: DOTORI.edge + '88', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: DOTORI.textDark, lineHeight: 1 }}>+</div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: ddayColor, minWidth: 36, textAlign: 'right' }}>{dday}</div>
    </div>
  );
}

function IconBtn({ children }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 12, background: DOTORI.ivory,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${DOTORI.edge}66`,
    }}>{children}</div>
  );
}

window.ScreenFridge = ScreenFridge;
window.IconBtn = IconBtn;
window.StatBlock = StatBlock;
window.SectionLabel = SectionLabel;
