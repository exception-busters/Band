import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePremium } from '../contexts/PremiumContext'
import { AudioSettings } from './AudioSettings'
import { PlanStatus } from './PlanStatus'

export function Navigation() {
  const { user, signOut } = useAuth()
  const { userPlan } = usePremium()
  const navigate = useNavigate()
  const [showAudioSettings, setShowAudioSettings] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <>
      {/* 오디오 설정 모달 - nav 바깥에 렌더링 */}
      {showAudioSettings && (
        <AudioSettings isModal onClose={() => setShowAudioSettings(false)} />
      )}

      <nav className="top-nav">
        <div className="brand">
        <Link to="/">
          <span>BandSpace</span>
          <small>Web Studio</small>
        </Link>
      </div>
      <div className="nav-links">
        <Link to="/">홈</Link>
        <Link to="/rooms">합주실</Link>
        <Link to="/recording">녹음</Link>
        <Link to="/mix">Mix Lab</Link>
        <Link to="/virtual-instruments">가상악기</Link>
        <Link to="/community">커뮤니티</Link>
        <Link to="/pricing">요금제</Link>
      </div>
      <div className="nav-actions">
        <button
          onClick={() => setShowAudioSettings(true)}
          className="nav-settings"
          title="오디오 설정"
        >
          🎛️
        </button>
        {user ? (
          <div className="user-menu">
            <PlanStatus compact />
            <span className="user-email">{user.email}</span>
            <button onClick={handleSignOut} className="nav-cta">
              로그아웃
            </button>
          </div>
        ) : (
          <Link to="/auth" className="nav-cta">
            로그인
          </Link>
        )}
        </div>
      </nav>
    </>
  )
}
