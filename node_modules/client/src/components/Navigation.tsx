import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Navigation() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
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
        <Link to="/community">커뮤니티</Link>
      </div>
      <div className="nav-actions">
        {user ? (
          <div className="user-menu">
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
  )
}
