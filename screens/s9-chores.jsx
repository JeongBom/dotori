// Screen: 일정 (Chores) — 집안일 + 루틴 관리
function ScreenChores() {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const dates = [20, 21, 22, 23, 24, 25, 26];
  const today = 21;
  return (
    <Phone bg={DOTORI.cream}>
      {/* Header */}
      <div style={{ padding: '6px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 600 }}>4월 3주차</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.4, marginTop: 1 }}>일정</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg></IconBtn>
          <IconBtn><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><path d="M12 7v6M12 17v.5"/><circle cx="12" cy="12" r="9"/></svg></IconBtn>
        </div>
      </div>

      {/* Mode tabs: 오늘 / 이번주 / 이번달 */}
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6 }}>
        {[['오늘', true], ['이번주'], ['이번달']].map(([m, active]) => (
          <div key={m} style={{
            flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 12,
            fontSize: 12, fontWeight: 700,
            background: active ? DOTORI.ivory : 'transparent',
            color: active ? DOTORI.textDark : DOTORI.textLight,
            boxShadow: active ? '0 2px 8px rgba(139,94,60,0.1)' : 'none',
            border: active ? `1px solid ${DOTORI.edge}` : `1px solid transparent`,
          }}>{m}</div>
        ))}
      </div>

      {/* Week strip */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ background: DOTORI.ivory, borderRadius: 16, padding: '12px 10px', display: 'flex', justifyContent: 'space-between', boxShadow: '0 2px 6px rgba(139,94,60,0.06)' }}>
          {days.map((d, i) => {
            const isToday = dates[i] === today;
            const hasItems = [3, 1, 2, 0, 4, 1, 2][i];
            return (
              <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{ fontSize: 10, color: DOTORI.textLight, fontWeight: 600 }}>{d}</div>
                <div style={{
                  width: 30, height: 30, borderRadius: 15,
                  background: isToday ? DOTORI.brown : 'transparent',
                  color: isToday ? '#fff' : DOTORI.textDark,
                  fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{dates[i]}</div>
                <div style={{ display: 'flex', gap: 2, height: 4 }}>
                  {Array.from({ length: Math.min(hasItems, 3) }).map((_, j) => (
                    <div key={j} style={{ width: 3, height: 3, borderRadius: 2, background: isToday ? DOTORI.deepBrown : DOTORI.lightOak }}/>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress ring + today summary */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${DOTORI.brown} 0%, ${DOTORI.warmOak} 100%)`,
          borderRadius: 16, padding: 14, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 6px 16px rgba(139,94,60,0.2)',
        }}>
          {/* Progress ring */}
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.25)" strokeWidth="5" fill="none"/>
              <circle cx="28" cy="28" r="24" stroke="#fff" strokeWidth="5" fill="none"
                strokeDasharray={`${2*Math.PI*24}`} strokeDashoffset={`${2*Math.PI*24*(1 - 0.33)}`}
                strokeLinecap="round" transform="rotate(-90 28 28)"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>1/3</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>오늘의 집안일</div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, marginTop: 2 }}>2개 남았어요</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ padding: '5px 9px', background: 'rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>민 1</div>
            <div style={{ padding: '5px 9px', background: 'rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>지 2</div>
          </div>
        </div>
      </div>

      {/* Chore list */}
      <div style={{ height: 286, overflow: 'hidden', padding: '0 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ChoreItem checked={true} title="쓰레기 배출" time="아침" repeat="매일" owner="민" />
          <ChoreItem title="분리수거" time="저녁 · 20:00" repeat="화요일마다" owner="민" overdue={false}/>
          <ChoreItem title="화분 물주기 (5개)" time="오후" repeat="주 2회" owner="지" purple />
          <ChoreItem title="욕실 청소" time="자유" repeat="주말마다" owner="지" purple />
          <ChoreItem title="신발장 정리" time="" repeat="월 1회" owner="민" faded />
        </div>
      </div>

      {/* FAB */}
      <div style={{
        position: 'absolute', bottom: 94, right: 20,
        width: 52, height: 52, borderRadius: 26, background: DOTORI.warmOak,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(168,120,80,0.4)', zIndex: 5,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </div>

      <DotoriTabBar active="일정" />
    </Phone>
  );
}

function ChoreItem({ checked, title, time, repeat, owner, purple, overdue, faded }) {
  return (
    <div style={{
      background: DOTORI.ivory, borderRadius: 14, padding: '11px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 1px 4px rgba(139,94,60,0.05)',
      opacity: faded ? 0.55 : 1,
      borderLeft: overdue ? `3px solid ${DOTORI.danger}` : 'none',
      paddingLeft: overdue ? 9 : 12,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11,
        border: `2px solid ${checked ? DOTORI.brown : DOTORI.edge}`,
        background: checked ? DOTORI.brown : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round"><path d="M5 12l5 5 10-11"/></svg>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: checked ? DOTORI.textLight : DOTORI.textDark,
          textDecoration: checked ? 'line-through' : 'none',
          marginBottom: 3,
        }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {time && <span style={{ fontSize: 10, color: DOTORI.textMid, fontWeight: 600 }}>⏰ {time}</span>}
          <span style={{ fontSize: 10, color: DOTORI.textLight, fontWeight: 500, background: DOTORI.cream, padding: '1px 6px', borderRadius: 4 }}>🔁 {repeat}</span>
        </div>
      </div>

      <div style={{
        width: 26, height: 26, borderRadius: 13,
        background: purple ? '#9478C9' : DOTORI.brown,
        color: '#fff', fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{owner}</div>
    </div>
  );
}

window.ScreenChores = ScreenChores;
