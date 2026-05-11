// Screen: 생필품 (Supplies) — 재고 관리
function ScreenSupplies() {
  return (
    <Phone bg={DOTORI.cream}>
      {/* Header */}
      <div style={{ padding: '6px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 600 }}>우리 집 재고</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.4, marginTop: 1 }}>생필품</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></IconBtn>
          <IconBtn><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 14h6"/></svg></IconBtn>
        </div>
      </div>

      {/* Alert banner for critical */}
      <div style={{
        margin: '0 16px 14px', padding: '10px 12px',
        background: '#FDECEA', borderRadius: 14, border: `1px solid ${DOTORI.danger}33`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 30, height: 30, borderRadius: 10, background: DOTORI.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 7v6M12 17v.5"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DOTORI.danger }}>재고 부족 3개</div>
          <div style={{ fontSize: 10, color: DOTORI.textMid, marginTop: 1 }}>장보기 전에 확인하세요</div>
        </div>
        <div style={{ padding: '5px 10px', background: DOTORI.danger, borderRadius: 10, fontSize: 10, fontWeight: 700, color: '#fff' }}>장보기 추가</div>
      </div>

      {/* Category chips */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflow: 'hidden' }}>
        {[['전체', 24, true], ['주방', 8], ['욕실', 6], ['청소', 5], ['기타', 5]].map(([label, n, active]) => (
          <div key={label} style={{
            padding: '5px 11px', borderRadius: 14, fontSize: 11, fontWeight: 600, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 4,
            background: active ? DOTORI.brown : DOTORI.ivory,
            color: active ? '#fff' : DOTORI.textMid,
            border: `1px solid ${active ? DOTORI.brown : DOTORI.edge}`,
          }}>
            <span>{label}</span>
            <span style={{ fontSize: 9, opacity: 0.75 }}>{n}</span>
          </div>
        ))}
      </div>

      {/* Scroll body */}
      <div style={{ height: 452, overflow: 'hidden', padding: '0 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 재고 부족 section */}
          <SectionLabel label="부족" count={3} color={DOTORI.danger}/>
          <SupplyRow emoji="🧺" name="섬유유연제" category="세탁" qty={0} threshold={2} level={0} location="베란다" />
          <SupplyRow emoji="🧴" name="주방세제" category="주방" qty={1} threshold={2} level={0.15} location="싱크대 하부" />
          <SupplyRow emoji="🧻" name="휴지" category="욕실" qty={3} threshold={6} level={0.3} location="창고" />

          <SectionLabel label="충분" count={21} color={DOTORI.success}/>
          <SupplyRow emoji="🧂" name="소금" category="주방" qty={2} threshold={1} level={0.85} location="찬장" />
          <SupplyRow emoji="🧼" name="비누" category="욕실" qty={6} threshold={3} level={0.9} location="욕실장" />
          <SupplyRow emoji="🦷" name="치약" category="욕실" qty={4} threshold={2} level={0.75} location="욕실장" />
          <SupplyRow emoji="🧽" name="수세미" category="주방" qty={8} threshold={3} level={1} location="싱크대" />
        </div>
      </div>

      {/* FAB */}
      <div style={{
        position: 'absolute', bottom: 94, right: 20,
        width: 52, height: 52, borderRadius: 26, background: DOTORI.deepBrown,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(107,66,38,0.4)', zIndex: 5,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </div>

      <DotoriTabBar active="생필품" />
    </Phone>
  );
}

function SupplyRow({ emoji, name, category, qty, threshold, level, location }) {
  const low = level < 0.35;
  return (
    <div style={{
      background: DOTORI.ivory, borderRadius: 14, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 1px 4px rgba(139,94,60,0.05)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: DOTORI.cream,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>{emoji}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: DOTORI.textDark }}>{name}</span>
          <span style={{ fontSize: 9, fontWeight: 600, color: DOTORI.textLight, background: DOTORI.cream, padding: '1px 5px', borderRadius: 4 }}>{category}</span>
        </div>
        {/* progress bar */}
        <div style={{ height: 4, background: DOTORI.edge + '66', borderRadius: 2, marginBottom: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(level * 100, 3)}%`, height: '100%', background: low ? DOTORI.danger : level > 0.8 ? DOTORI.success : DOTORI.warn, borderRadius: 2 }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
          <span style={{ color: DOTORI.textLight }}>📍 {location}</span>
          <span style={{ color: low ? DOTORI.danger : DOTORI.textMid, fontWeight: 600 }}>최소 {threshold}개</span>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: DOTORI.edge, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DOTORI.textDark, fontWeight: 700, fontSize: 13, lineHeight: 1 }}>−</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: low ? DOTORI.danger : DOTORI.textDark, minWidth: 16, textAlign: 'center' }}>{qty}</span>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: DOTORI.brown, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>+</div>
        </div>
      </div>
    </div>
  );
}

window.ScreenSupplies = ScreenSupplies;
