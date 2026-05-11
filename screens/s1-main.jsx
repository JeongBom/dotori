// Screen 1: Main Dashboard (홈) — rich dashboard with asymmetric widgets
function Screen1Main() {
  return (
    <Phone bg={DOTORI.cream}>
      {/* Top bar: logo + family + date pill + avatar cluster */}
      <div style={{ padding: '6px 20px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <AcornMark size={24} />
          <span style={{ fontSize: 20, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.5 }}>도토리</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: DOTORI.textLight, background: DOTORI.ivory, padding: '2px 7px', borderRadius: 8, border: `1px solid ${DOTORI.edge}66` }}>김민수네</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textMid} strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="4"/></svg>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: DOTORI.brown, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>민</div>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: '#9478C9', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -10, border: '2px solid #fff' }}>지</div>
        </div>
      </div>

      {/* Greeting */}
      <div style={{ padding: '4px 20px 10px' }}>
        <div style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 600 }}>4월 21일 화요일 · 맑음 18°</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: DOTORI.textDark, marginTop: 2, letterSpacing: -0.4 }}>
          민수님, 오늘 살펴볼 게 <span style={{ color: DOTORI.brown }}>5개</span> 있어요
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ height: 562, overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Focus strip — horizontal pills of urgent items */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'hidden' }}>
            <FocusPill tone="danger" icon="warn" label="우유" sub="기한 초과" />
            <FocusPill tone="danger" icon="warn" label="섬유유연제" sub="재고 0" />
            <FocusPill tone="warn" icon="clock" label="두부" sub="D-1" />
            <FocusPill tone="brown" icon="calendar" label="분리수거" sub="오늘" />
          </div>

          {/* Hero: 자산 카드 (크게, primary) */}
          <div style={{
            background: `linear-gradient(135deg, ${DOTORI.brown} 0%, ${DOTORI.deepBrown} 100%)`,
            borderRadius: 18, padding: 14, color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 20px rgba(107,66,38,0.25)',
          }}>
            {/* subtle acorn bg */}
            <svg width="120" height="120" viewBox="0 0 28 28" style={{ position: 'absolute', right: -20, top: -10, opacity: 0.08 }}>
              <path d="M5 11c0-1 1-2 2-2h14c1 0 2 1 2 2 0 1-1 2-2 2H7c-1 0-2-1-2-2z" fill="#fff"/>
              <path d="M7 13h14c0 5-3 11-7 11s-7-6-7-11z" fill="#fff"/>
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>우리 집 총 자산</span>
              <div style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: 8 }}>+2.3% 이번달</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>1억 2,340만원</div>
            {/* mini sparkline */}
            <svg width="100%" height="28" viewBox="0 0 300 28" preserveAspectRatio="none" style={{ marginBottom: 8 }}>
              <path d="M0,20 L30,18 L60,22 L90,16 L120,17 L150,12 L180,14 L210,8 L240,10 L270,6 L300,4" stroke="rgba(255,255,255,0.9)" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <path d="M0,20 L30,18 L60,22 L90,16 L120,17 L150,12 L180,14 L210,8 L240,10 L270,6 L300,4 L300,28 L0,28 Z" fill="rgba(255,255,255,0.12)"/>
            </svg>
            <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
              <div><span style={{ color: 'rgba(255,255,255,0.65)' }}>수입 </span><span style={{ fontWeight: 700 }}>480만</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.65)' }}>지출 </span><span style={{ fontWeight: 700 }}>214만</span></div>
              <div style={{ marginLeft: 'auto', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>업데이트 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg></div>
            </div>
          </div>

          {/* 2-col widgets: 음식 + 일정 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* 음식 */}
            <MiniWidget color={DOTORI.brown} icon="fridge" title="음식" count="23">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                <MiniRow label="임박 D-3" value="4개" danger />
                <MiniRow label="기한 초과" value="1개" danger />
              </div>
            </MiniWidget>

            {/* 일정 */}
            <MiniWidget color={DOTORI.warmOak} icon="calendar" title="오늘 일정" count="3" variant="list">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <ChoreLine label="분리수거" owner="민" />
                <ChoreLine label="화분 물주기" owner="지" purple />
                <ChoreLine label="욕실 청소" owner="민" />
              </div>
            </MiniWidget>
          </div>

          {/* 2-col widgets: 생필품 + 메모 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MiniWidget color={DOTORI.deepBrown} icon="basket" title="생필품" count="3" countColor={DOTORI.danger}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                <StockRow label="섬유유연제" level={0} />
                <StockRow label="주방세제" level={0.15} />
                <StockRow label="휴지" level={0.3} />
              </div>
            </MiniWidget>

            <MiniWidget color="#A07A5C" icon="note" title="메모" count="12" variant="list">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <NoteLine emoji="🛒" label="장보기 · 주말" pinned />
                <NoteLine emoji="🔧" label="세탁기 A/S" />
                <NoteLine emoji="✈️" label="제주도 여행" />
              </div>
            </MiniWidget>
          </div>

          {/* Family activity feed */}
          <div style={{ background: DOTORI.ivory, borderRadius: 16, padding: 14, boxShadow: '0 2px 8px rgba(139,94,60,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textMid} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: DOTORI.textDark }}>가족 활동</span>
              </div>
              <span style={{ fontSize: 10, color: DOTORI.textLight, fontWeight: 600 }}>전체 보기</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <ActivityItem avatar="지" purple time="방금" text="청소기 필터" badge="생필품" action="다 씀으로 표시" />
              <ActivityItem avatar="민" time="1시간 전" text="이번달 월급" badge="자산" action="+300만원 기록" />
              <ActivityItem avatar="지" purple time="어제" text="제주도 여행 계획" badge="메모" action="작성" />
            </div>
          </div>

          {/* Insight card */}
          <div style={{
            background: '#F3E7D2', borderRadius: 14, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            border: `1px dashed ${DOTORI.edge}`,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: DOTORI.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AcornMark size={18} />
            </div>
            <div style={{ flex: 1, fontSize: 11, color: DOTORI.textDark, lineHeight: 1.4 }}>
              지난달보다 <b style={{ color: DOTORI.brown }}>식비 18% 감소</b>했어요.<br/>
              냉장고 정리를 꾸준히 한 덕분이에요 🎉
            </div>
          </div>

          <div style={{ height: 60 }}/>
        </div>
      </div>

      <DotoriTabBar active="음식" />
    </Phone>
  );
}

// ── subcomponents ──────────────────────────────
function FocusPill({ tone, icon, label, sub }) {
  const colors = {
    danger: { bg: '#FDECEA', fg: DOTORI.danger, iconBg: DOTORI.danger },
    warn:   { bg: '#FCF2E0', fg: '#B67628', iconBg: DOTORI.warn },
    brown:  { bg: '#F3E7D2', fg: DOTORI.deepBrown, iconBg: DOTORI.brown },
  }[tone];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      background: colors.bg, padding: '5px 10px 5px 5px', borderRadius: 20,
    }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, background: colors.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon === 'warn' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 7v6M12 17v.5"/></svg>}
        {icon === 'clock' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>}
        {icon === 'calendar' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M4 10h16"/></svg>}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.fg, lineHeight: 1.1 }}>{label}</div>
        <div style={{ fontSize: 9, color: colors.fg, opacity: 0.75, fontWeight: 500 }}>{sub}</div>
      </div>
    </div>
  );
}

function MiniWidget({ color, icon, title, count, countColor, children, variant }) {
  return (
    <div style={{ background: DOTORI.ivory, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 6px rgba(139,94,60,0.06)' }}>
      <div style={{ background: color, padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MiniIcon name={icon}/>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', flex: 1 }}>{title}</span>
        {variant !== 'list' && <span style={{ fontSize: 10, color: '#fff', opacity: 0.85, fontWeight: 700 }}>{count}개</span>}
      </div>
      <div style={{ padding: '8px 10px 10px', minHeight: 68 }}>
        {variant !== 'list' && (
          <div style={{ fontSize: 20, fontWeight: 800, color: countColor || DOTORI.textDark, lineHeight: 1 }}>{count}</div>
        )}
        {children}
      </div>
    </div>
  );
}

function MiniIcon({ name }) {
  const s = { width: 13, height: 13, stroke: '#fff', strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'fridge') return <svg {...s} viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12"/></svg>;
  if (name === 'basket') return <svg {...s} viewBox="0 0 24 24"><path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.7h-7a2 2 0 0 1-2-1.7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>;
  if (name === 'calendar') return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
  if (name === 'note') return <svg {...s} viewBox="0 0 24 24"><path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M15 4v5h5"/></svg>;
  return null;
}

function MiniRow({ label, value, danger }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
      <span style={{ color: DOTORI.textMid }}>{label}</span>
      <span style={{ color: danger ? DOTORI.danger : DOTORI.textDark, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function ChoreLine({ label, owner, purple }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${DOTORI.lightOak}`, flexShrink: 0 }}/>
      <span style={{ fontSize: 11, color: DOTORI.textDark, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ width: 14, height: 14, borderRadius: 7, background: purple ? '#9478C9' : DOTORI.brown, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{owner}</div>
    </div>
  );
}

function StockRow({ label, level }) {
  const critical = level < 0.2;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: DOTORI.textDark, fontWeight: 500 }}>{label}</span>
        <span style={{ color: critical ? DOTORI.danger : DOTORI.textMid, fontWeight: 700 }}>{level === 0 ? '0' : `${Math.round(level * 100)}%`}</span>
      </div>
      <div style={{ height: 3, background: DOTORI.edge + '88', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(level * 100, 4)}%`, height: '100%', background: critical ? DOTORI.danger : DOTORI.warn, borderRadius: 2 }}/>
      </div>
    </div>
  );
}

function NoteLine({ emoji, label, pinned }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 11 }}>{emoji}</span>
      <span style={{ fontSize: 11, color: DOTORI.textDark, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {pinned && <svg width="9" height="9" viewBox="0 0 24 24" fill={DOTORI.brown}><path d="M12 2l2 5 5 1-4 3 1 5-4-2.5L8 16l1-5-4-3 5-1z"/></svg>}
    </div>
  );
}

function ActivityItem({ avatar, purple, time, text, badge, action }) {
  const badgeColor = {
    '생필품': DOTORI.deepBrown,
    '자산': DOTORI.brown,
    '메모': '#A07A5C',
    '음식': DOTORI.brown,
    '일정': DOTORI.warmOak,
  }[badge] || DOTORI.brown;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <div style={{ width: 26, height: 26, borderRadius: 13, background: purple ? '#9478C9' : DOTORI.brown, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{avatar}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: badgeColor, padding: '1px 6px', borderRadius: 6 }}>{badge}</span>
          <span style={{ fontSize: 10, color: DOTORI.textLight }}>· {time}</span>
        </div>
        <div style={{ fontSize: 12, color: DOTORI.textDark, fontWeight: 500, lineHeight: 1.3 }}>
          <b>{text}</b> <span style={{ color: DOTORI.textMid, fontWeight: 400 }}>{action}</span>
        </div>
      </div>
    </div>
  );
}

window.Screen1Main = Screen1Main;
