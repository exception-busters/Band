import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Auth() {
  const { user, loading, alert, setAlert, signUp, signIn, isSupabaseReady } = useAuth()
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: string })?.from || '/rooms'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password.trim()) {
      setAlert({ type: 'error', message: '이메일과 비밀번호를 모두 입력하세요.' })
      return
    }

    try {
      if (authMode === 'signup') {
        await signUp(email, password)
      } else {
        await signIn(email, password)
        // 로그인 성공 시 이전 페이지 또는 rooms로 리다이렉트
        navigate(from, { replace: true })
      }
    } catch (error) {
      // 에러는 AuthContext에서 처리됨
    }
  }

  // 이미 로그인된 경우 홈으로 리다이렉트
  if (user) {
    navigate('/')
    return null
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>BandSpace</h1>
          <p>음악가들을 위한 온라인 합주 플랫폼</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === 'signin' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signin')
                setAlert(null)
              }}
            >
              로그인
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signup')
                setAlert(null)
              }}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                placeholder="you@bandspace.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!isSupabaseReady}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                placeholder="8자 이상 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                disabled={!isSupabaseReady}
              />
            </div>

            {alert && <div className={`auth-alert ${alert.type}`}>{alert.message}</div>}

            {!isSupabaseReady && (
              <div className="auth-alert error">
                <p>Supabase 환경변수가 설정되지 않았습니다.</p>
                <small>
                  <code>VITE_SUPABASE_URL</code>과 <code>VITE_SUPABASE_ANON_KEY</code>를 설정하세요.
                </small>
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={loading || !isSupabaseReady}>
              {loading ? '처리 중...' : authMode === 'signup' ? '회원가입' : '로그인'}
            </button>
          </form>

          <div className="auth-info">
            {authMode === 'signup' ? (
              <p>
                회원가입 후 이메일 확인이 필요합니다.
                <br />
                <small>이미 계정이 있으신가요? 로그인 탭을 선택하세요.</small>
              </p>
            ) : (
              <p>
                <small>계정이 없으신가요? 회원가입 탭을 선택하세요.</small>
              </p>
            )}
          </div>
        </div>

        <div className="auth-features">
          <div className="feature-item">
            <h3>🎵 합주실 생성</h3>
            <p>로그인하여 자신만의 합주실을 만들고 친구들을 초대하세요.</p>
          </div>
          <div className="feature-item">
            <h3>🎙️ 실시간 협업</h3>
            <p>초저지연 오디오로 전 세계 음악가들과 함께 연주하세요.</p>
          </div>
          <div className="feature-item">
            <h3>💾 녹음 & 공유</h3>
            <p>세션을 녹음하고 커뮤니티와 공유하세요.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
