// Auth flow screens — based on actual dotori/src/screens/auth/*.tsx
// Screens: Login, Signup, EmailPending, ProfileSetup, FamilyCreate, FamilyJoin, InviteCode

// ── Shared sub-components ──────────────────────────────────────

function AuthPhone({ children, bg = DOTORI.cream }) {
  return (
    <div style={{
      width: 380, height: 780, borderRadius: 44, overflow: 'hidden',
      position: 'relative', background: bg,
      fontFamily: '"Pretendard", -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <Island />
      <DotoriStatus bg={bg} />
      {children}
      <HomeBar />
    </div>
  );
}

function AuthInput({ label, placeholder, value, type = 'text', hint }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: DOTORI.textMid, marginBottom: 7 }}>{label}</div>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '13px 14px',
        border: `1px solid ${value ? DOTORI.brown : DOTORI.edge}`,
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: value ? `0 0 0 3px ${DOTORI.brown}18` : 'none',
        transition: 'box-shadow 0.15s',
      }}>
        <span style={{ flex: 1, fontSize: 15, color: value ? DOTORI.textDark : DOTORI.edge, letterSpacing: type === 'code' ? 6 : 0, textAlign: type === 'code' ? 'center' : 'left', fontWeight: type === 'code' ? 800 : 500 }}>
          {value || <span style={{ color: DOTORI.edge }}>{placeholder}</span>}
        </span>
        {type === 'password' && value && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textLight} strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        )}
      </div>
      {hint && <div style={{ fontSize: 11, color: DOTORI.textLight, marginTop: 4, textAlign: 'right' }}>{hint}</div>}
    </div>
  );
}

function AuthBtn({ label, sub }) {
  return (
    <div style={{
      background: DOTORI.brown, borderRadius: 14, padding: '15px 0',
      textAlign: 'center', cursor: 'pointer',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function AuthTabBar({ active }) {
  return (
    <div style={{
      display: 'flex', background: '#EDD9C0', borderRadius: 16, padding: 4, marginBottom: 20,
    }}>
      {['로그인', '회원가입'].map(t => (
        <div key={t} style={{
          flex: 1, padding: '10px 0', borderRadius: 12, textAlign: 'center',
          background: t === active ? '#fff' : 'transparent',
          boxShadow: t === active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t === active ? DOTORI.textDark : DOTORI.textMid }}>{t}</span>
        </div>
      ))}
    </div>
  );
}

function LogoArea() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 36 }}>
      <AcornMark size={52} color={DOTORI.brown}/>
      <div style={{ fontSize: 30, fontWeight: 900, color: DOTORI.textDark, letterSpacing: -1, marginTop: 8 }}>도토리</div>
      <div style={{ fontSize: 13, color: DOTORI.textMid, fontWeight: 500, marginTop: 4 }}>가족이 함께 쓰는 홈 매니저</div>
    </div>
  );
}

// ── Screen 1: 로그인 ──────────────────────────
function ScreenLogin() {
  return (
    <AuthPhone>
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 34, overflowY: 'auto', padding: '28px 24px 24px' }}>
        <LogoArea/>
        <AuthTabBar active="로그인"/>
        <div style={{ background: DOTORI.ivory, borderRadius: 20, padding: 22, boxShadow: '0 2px 12px rgba(139,94,60,0.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AuthInput label="이메일" placeholder="example@email.com" value="minjae@email.com"/>
          <AuthInput label="비밀번호" placeholder="6자 이상" value="••••••••" type="password"/>
          <div style={{ marginTop: 6 }}>
            <AuthBtn label="로그인"/>
          </div>
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <span style={{ fontSize: 13, color: DOTORI.textMid, fontWeight: 600 }}>비밀번호를 잊으셨나요?</span>
          </div>
        </div>
      </div>
    </AuthPhone>
  );
}

// ── Screen 2: 회원가입 ────────────────────────
function ScreenSignup() {
  return (
    <AuthPhone>
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 34, overflowY: 'auto', padding: '28px 24px 24px' }}>
        <LogoArea/>
        <AuthTabBar active="회원가입"/>
        <div style={{ background: DOTORI.ivory, borderRadius: 20, padding: 22, boxShadow: '0 2px 12px rgba(139,94,60,0.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AuthInput label="이메일" placeholder="example@email.com" value="minjae@email.com"/>
          <AuthInput label="비밀번호" placeholder="6자 이상" value="••••••••" type="password"/>
          <AuthInput label="비밀번호 확인" placeholder="비밀번호를 다시 입력하세요" value="••••••••" type="password"/>
          <AuthInput label="닉네임" placeholder="예: 도토리, 아내, 남편 (10자 이내)" value="민재" hint="2 / 10자"/>
          <div style={{ marginTop: 4 }}>
            <AuthBtn label="회원가입"/>
          </div>
        </div>
      </div>
    </AuthPhone>
  );
}

// ── Screen 3: 이메일 인증 대기 ────────────────
function ScreenEmailPending() {
  return (
    <AuthPhone>
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        {/* Envelope illustration */}
        <div style={{ marginBottom: 28 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect x="8" y="20" width="64" height="44" rx="6" fill={DOTORI.edge}/>
            <rect x="8" y="20" width="64" height="44" rx="6" stroke={DOTORI.brown} strokeWidth="2"/>
            <path d="M8 26 L40 48 L72 26" stroke={DOTORI.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Notification dot */}
            <circle cx="58" cy="22" r="10" fill={DOTORI.danger}/>
            <text x="58" y="27" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">!</text>
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: DOTORI.textDark, marginBottom: 14, textAlign: 'center' }}>이메일을 확인해주세요</div>
        <div style={{ fontSize: 14, color: DOTORI.textMid, textAlign: 'center', lineHeight: 1.7, marginBottom: 36 }}>
          <span style={{ fontWeight: 700 }}>minjae@email.com</span><br/>
          으로 인증 메일을 보냈어요.<br/><br/>
          <span style={{ color: DOTORI.textLight }}>1. 메일함에서 인증 링크를 클릭하세요<br/>2. 앱으로 돌아와 아래 버튼을 눌러주세요</span>
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AuthBtn label="인증 완료했어요"/>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <span style={{ fontSize: 13, color: DOTORI.textMid, fontWeight: 600 }}>로그인으로 돌아가기</span>
          </div>
        </div>
      </div>
    </AuthPhone>
  );
}

// ── Screen 4: 닉네임 설정 ─────────────────────
function ScreenProfileSetup() {
  return (
    <AuthPhone>
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 34, padding: '40px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 4, borderRadius: 2, flex: i === 0 ? 2 : 1, background: i === 0 ? DOTORI.brown : DOTORI.edge }}/>
          ))}
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: DOTORI.textDark, marginBottom: 6 }}>반가워요! 👋</div>
        <div style={{ fontSize: 14, color: DOTORI.textMid, marginBottom: 36, lineHeight: 1.5 }}>앱에서 사용할 닉네임을 설정해요</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <AuthInput label="닉네임" placeholder="예: 도토리, 아내, 남편" value="민재" hint="2 / 10자"/>
        </div>
        {/* Emoji avatar preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 36, background: DOTORI.cream,
            border: `2px solid ${DOTORI.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30,
          }}>🌰</div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: DOTORI.textMid, fontWeight: 700 }}>민재</div>
        <div style={{ flex: 1 }}/>
        <AuthBtn label="다음"/>
      </div>
    </AuthPhone>
  );
}

// ── Screen 5: 가족 이름 만들기 ───────────────
function ScreenFamilyCreate() {
  return (
    <AuthPhone>
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 34, padding: '40px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 4, borderRadius: 2, flex: i < 2 ? 2 : 1, background: i < 2 ? DOTORI.brown : DOTORI.edge }}/>
          ))}
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: DOTORI.textDark, marginBottom: 6 }}>가족 이름을 정해요 🏠</div>
        <div style={{ fontSize: 14, color: DOTORI.textMid, marginBottom: 36, lineHeight: 1.65 }}>혼자 시작해도 괜찮아요<br/>나중에 파트너를 초대할 수 있어요</div>

        <AuthInput label="가족 이름" placeholder="우리 가족" value="우리 가족"/>

        {/* Family acorn visual */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.7 }}>
          <svg width="90" height="70" viewBox="0 0 120 100" fill="none">
            {/* three small acorns */}
            <ellipse cx="30" cy="72" rx="16" ry="6" fill={DOTORI.edge} opacity="0.5"/>
            <rect x="20" y="44" width="20" height="28" rx="10" fill={DOTORI.warmOak} opacity="0.8"/>
            <rect x="18" y="36" width="24" height="12" rx="5" fill={DOTORI.brown}/>
            <ellipse cx="70" cy="68" rx="20" ry="7" fill={DOTORI.edge} opacity="0.5"/>
            <rect x="58" y="36" width="24" height="32" rx="12" fill={DOTORI.brown} opacity="0.85"/>
            <rect x="56" y="27" width="28" height="14" rx="6" fill={DOTORI.deepBrown}/>
            <ellipse cx="105" cy="72" rx="14" ry="5" fill={DOTORI.edge} opacity="0.4"/>
            <rect x="96" y="46" width="18" height="26" rx="9" fill={DOTORI.lightOak} opacity="0.9"/>
            <rect x="94" y="38" width="22" height="11" rx="5" fill={DOTORI.warmOak}/>
          </svg>
        </div>

        <AuthBtn label="시작하기"/>
        <div style={{ textAlign: 'center', padding: '14px 0 0' }}>
          <span style={{ fontSize: 13, color: DOTORI.textMid, fontWeight: 600 }}>이미 초대 코드가 있어요</span>
        </div>
      </div>
    </AuthPhone>
  );
}

// ── Screen 6: 코드로 참여하기 ─────────────────
function ScreenFamilyJoin() {
  return (
    <AuthPhone>
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 34, padding: '40px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 4, borderRadius: 2, flex: i < 2 ? 2 : 1, background: i < 2 ? DOTORI.brown : DOTORI.edge }}/>
          ))}
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: DOTORI.textDark, marginBottom: 6 }}>코드로 참여하기 🤝</div>
        <div style={{ fontSize: 14, color: DOTORI.textMid, marginBottom: 36 }}>파트너에게 받은 6자리 코드를 입력해요</div>

        {/* Big code input */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DOTORI.textMid, marginBottom: 10 }}>초대 코드</div>
          <div style={{
            background: DOTORI.ivory, borderRadius: 14, padding: '18px 14px',
            border: `2px solid ${DOTORI.brown}`,
            boxShadow: `0 0 0 4px ${DOTORI.brown}18`,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
          }}>
            {'A1B2C3'.split('').map((c, i) => (
              <div key={i} style={{
                width: 34, height: 44, borderRadius: 8,
                background: i < 4 ? DOTORI.brown : DOTORI.edge,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 900, color: i < 4 ? '#fff' : DOTORI.textMid,
              }}>{c}</div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: DOTORI.textLight, textAlign: 'center', marginBottom: 8 }}>대소문자 구분 없이 입력하세요</div>

        <div style={{ flex: 1 }}/>
        <AuthBtn label="참여하기"/>
        <div style={{ textAlign: 'center', padding: '14px 0 0' }}>
          <span style={{ fontSize: 13, color: DOTORI.textMid, fontWeight: 600 }}>← 가족 새로 만들기</span>
        </div>
      </div>
    </AuthPhone>
  );
}

// ── Screen 7: 초대 코드 표시 ─────────────────
function ScreenInviteCode() {
  return (
    <AuthPhone>
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 34, padding: '40px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* Progress complete */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 4, borderRadius: 2, flex: 1, background: DOTORI.brown }}/>
          ))}
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: DOTORI.textDark, marginBottom: 6 }}>시작할 준비가 됐어요! 🎉</div>
        <div style={{ fontSize: 14, color: DOTORI.textMid, marginBottom: 28, lineHeight: 1.65 }}>
          혼자 써도 되고, 파트너에게 코드를 공유하면<br/>함께 사용할 수 있어요
        </div>

        {/* Invite code card */}
        <div style={{
          background: DOTORI.brown, borderRadius: 20, padding: '28px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>초대 코드</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 10 }}>A1B2C3</div>
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 10,
            padding: '8px 20px', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>코드 공유하기 ↗</span>
          </div>
        </div>

        <div style={{ fontSize: 12, color: DOTORI.textMid, textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
          코드는 설정 화면에서도 언제든 확인할 수 있어요
        </div>

        <div style={{ flex: 1 }}/>
        <AuthBtn label="시작하기"/>
      </div>
    </AuthPhone>
  );
}

window.ScreenLogin = ScreenLogin;
window.ScreenSignup = ScreenSignup;
window.ScreenEmailPending = ScreenEmailPending;
window.ScreenProfileSetup = ScreenProfileSetup;
window.ScreenFamilyCreate = ScreenFamilyCreate;
window.ScreenFamilyJoin = ScreenFamilyJoin;
window.ScreenInviteCode = ScreenInviteCode;
