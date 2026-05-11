// Screen: 메모 (Notes) — 가족 공유 메모
function ScreenNotes() {
  return (
    <Phone bg={DOTORI.cream}>
      {/* Header */}
      <div style={{ padding: '6px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 600 }}>가족 공유</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.4, marginTop: 1 }}>메모</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></IconBtn>
          <IconBtn><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></IconBtn>
        </div>
      </div>

      {/* Category chips */}
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, overflow: 'hidden' }}>
        {[['전체', 12, true, DOTORI.brown], ['🛒 장보기', 3, false, '#5AAF6E'], ['✈️ 여행', 2, false, '#4A9EC9'], ['🔧 수리', 2, false, '#D4864A'], ['💡 아이디어', 5, false, '#D9629A']].map(([l, n, active, c]) => (
          <div key={l} style={{
            padding: '5px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 4,
            background: active ? c : DOTORI.ivory,
            color: active ? '#fff' : DOTORI.textMid,
            border: `1px solid ${active ? c : DOTORI.edge}`,
          }}>
            <span>{l}</span>
            <span style={{ fontSize: 9, opacity: 0.8 }}>{n}</span>
          </div>
        ))}
      </div>

      {/* Pinned section */}
      <div style={{ padding: '0 16px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill={DOTORI.textMid}><path d="M12 2l2 5 5 1-4 3 1 5-4-2.5L8 16l1-5-4-3 5-1z"/></svg>
        <span style={{ fontSize: 10, fontWeight: 700, color: DOTORI.textDark, letterSpacing: 0.3 }}>고정됨</span>
      </div>

      {/* Masonry-ish note grid */}
      <div style={{ height: 528, overflow: 'hidden', padding: '0 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start' }}>
          {/* Pinned large note */}
          <NoteCard
            bg="#FAEFD8"
            category="🛒 장보기"
            categoryColor="#5AAF6E"
            title="주말 장보기"
            body="• 애호박 2개\n• 두부 1모\n• 계란 10구\n• 우유 1L\n• 대파 1단"
            author="민"
            time="오늘"
            pinned
            checklist={{ done: 2, total: 5 }}
          />
          <NoteCard
            bg="#EBE5F4"
            category="🔧 수리"
            categoryColor="#D4864A"
            title="세탁기 A/S"
            body="LG 상담: 02-3777-1114\n모델: TR16BK"
            author="지"
            purple
            time="어제"
            pinned
          />

          {/* Separator */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, marginBottom: 2 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textMid} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: DOTORI.textDark, letterSpacing: 0.3 }}>최근</span>
          </div>

          <NoteCard
            bg={DOTORI.ivory}
            category="✈️ 여행"
            categoryColor="#4A9EC9"
            title="제주도 여행"
            body="5월 첫째주\n숙소: 서귀포 펜션"
            author="지"
            purple
            time="3일 전"
          />
          <NoteCard
            bg={DOTORI.ivory}
            category="💡 아이디어"
            categoryColor="#D9629A"
            title="베란다 화분"
            body="허브 기르기 도전\n바질, 로즈마리"
            author="지"
            purple
            time="5일 전"
          />
          <NoteCard
            bg="#FDF1E4"
            category="🔧 수리"
            categoryColor="#D4864A"
            title="현관 전구"
            body="LED로 교체"
            author="민"
            time="1주"
          />
          <NoteCard
            bg={DOTORI.ivory}
            category="💡 아이디어"
            categoryColor="#D9629A"
            title="결혼기념일 선물"
            body="?"
            author="민"
            time="1주"
          />
        </div>
      </div>

      {/* FAB */}
      <div style={{
        position: 'absolute', bottom: 94, right: 20,
        width: 52, height: 52, borderRadius: 26, background: '#A07A5C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(160,122,92,0.4)', zIndex: 5,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
      </div>

      <DotoriTabBar active="메모" />
    </Phone>
  );
}

function NoteCard({ bg, category, categoryColor, title, body, author, time, purple, pinned, checklist }) {
  return (
    <div style={{
      background: bg, borderRadius: 14, padding: '11px 12px',
      boxShadow: '0 1px 4px rgba(139,94,60,0.06)',
      position: 'relative',
      border: `1px solid ${DOTORI.edge}55`,
    }}>
      {pinned && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill={DOTORI.brown} style={{ position: 'absolute', top: 8, right: 8 }}>
          <path d="M12 2l2 5 5 1-4 3 1 5-4-2.5L8 16l1-5-4-3 5-1z"/>
        </svg>
      )}
      <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, color: categoryColor, background: '#fff', padding: '2px 6px', borderRadius: 6, marginBottom: 6 }}>{category}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.2, marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 11, color: DOTORI.textMid, lineHeight: 1.5, whiteSpace: 'pre-line', marginBottom: 8 }}>{body}</div>

      {checklist && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 3, background: DOTORI.edge, borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
            <div style={{ width: `${(checklist.done / checklist.total) * 100}%`, height: '100%', background: DOTORI.brown }}/>
          </div>
          <div style={{ fontSize: 9, color: DOTORI.textMid, fontWeight: 600 }}>{checklist.done}/{checklist.total} 완료</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: purple ? '#9478C9' : DOTORI.brown, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{author}</div>
        <span style={{ fontSize: 10, color: DOTORI.textLight, fontWeight: 500 }}>{time}</span>
      </div>
    </div>
  );
}

window.ScreenNotes = ScreenNotes;
