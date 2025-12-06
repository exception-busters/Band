import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import '../styles/profile.css'

type ProfileTab = 'info' | 'follow' | 'theme' | 'support'

export function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<ProfileTab>('info')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isHoveringPhoto, setIsHoveringPhoto] = useState(false)

  // 프로필 정보 상태
  const [nickname, setNickname] = useState(user?.user_metadata?.nickname || '')
  const [bio, setBio] = useState(user?.user_metadata?.bio || '')
  const [snsLinks, setSnsLinks] = useState({
    instagram: user?.user_metadata?.instagram || '',
    youtube: user?.user_metadata?.youtube || '',
    twitter: user?.user_metadata?.twitter || '',
  })
  const [profilePhoto, setProfilePhoto] = useState(user?.user_metadata?.profile_photo || '')

  if (!user) {
    navigate('/auth')
    return null
  }

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 이미지를 base64로 변환
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string
      setProfilePhoto(base64Image)

      // Supabase에 저장
      if (supabase) {
        try {
          const { error } = await supabase.auth.updateUser({
            data: { profile_photo: base64Image }
          })
          if (error) throw error
        } catch (err) {
          console.error('Failed to update profile photo:', err)
          alert('프로필 사진 업데이트에 실패했습니다.')
        }
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!supabase) {
      alert('데이터베이스에 연결할 수 없습니다.')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          nickname,
          bio,
          instagram: snsLinks.instagram,
          youtube: snsLinks.youtube,
          twitter: snsLinks.twitter,
        }
      })

      if (error) throw error

      setIsEditing(false)
      alert('프로필이 업데이트되었습니다.')
    } catch (err) {
      console.error('Failed to update profile:', err)
      alert('프로필 업데이트에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setNickname(user?.user_metadata?.nickname || '')
    setBio(user?.user_metadata?.bio || '')
    setSnsLinks({
      instagram: user?.user_metadata?.instagram || '',
      youtube: user?.user_metadata?.youtube || '',
      twitter: user?.user_metadata?.twitter || '',
    })
    setIsEditing(false)
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* 좌측 사이드바 */}
        <aside className="profile-sidebar">
          <h2>프로필 설정</h2>
          <nav className="profile-nav">
            <button
              className={`profile-nav-item ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <span className="nav-icon">👤</span>
              내 정보
            </button>
            <button
              className={`profile-nav-item ${activeTab === 'follow' ? 'active' : ''}`}
              onClick={() => setActiveTab('follow')}
            >
              <span className="nav-icon">👥</span>
              팔로우/팔로워
              <span className="coming-soon">준비중</span>
            </button>
            <button
              className={`profile-nav-item ${activeTab === 'theme' ? 'active' : ''}`}
              onClick={() => setActiveTab('theme')}
            >
              <span className="nav-icon">🎨</span>
              테마 변경
              <span className="coming-soon">준비중</span>
            </button>
            <button
              className={`profile-nav-item ${activeTab === 'support' ? 'active' : ''}`}
              onClick={() => setActiveTab('support')}
            >
              <span className="nav-icon">💬</span>
              문의하기/고객센터
              <span className="coming-soon">준비중</span>
            </button>
          </nav>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="profile-main">
          {activeTab === 'info' && (
            <div className="profile-info-section">
              <div className="profile-header">
                <div
                  className="profile-photo-wrapper"
                  onMouseEnter={() => setIsHoveringPhoto(true)}
                  onMouseLeave={() => setIsHoveringPhoto(false)}
                  onClick={handlePhotoClick}
                >
                  <div className="profile-photo">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" />
                    ) : (
                      <div className="default-avatar">
                        <span>👤</span>
                      </div>
                    )}
                  </div>
                  {isHoveringPhoto && (
                    <div className="photo-edit-overlay">
                      <span className="edit-icon">✏️</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="profile-header-info">
                  <h1>{nickname || user.email}</h1>
                  <p className="profile-email">{user.email}</p>
                </div>
              </div>

              <div className="profile-details">
                <div className="detail-section">
                  <h3>기본 정보</h3>

                  <div className="detail-item">
                    <label>이메일 (아이디)</label>
                    <input type="text" value={user.email || ''} disabled />
                  </div>

                  <div className="detail-item">
                    <label>닉네임</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      disabled={!isEditing}
                      placeholder="닉네임을 입력하세요"
                    />
                  </div>

                  <div className="detail-item">
                    <label>자기소개</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      disabled={!isEditing}
                      placeholder="자신을 소개해주세요"
                      rows={4}
                      maxLength={200}
                    />
                    {isEditing && (
                      <small className="char-count">{bio.length}/200</small>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <h3>SNS 연동</h3>

                  <div className="detail-item">
                    <label>
                      <span className="sns-icon">📷</span> Instagram
                    </label>
                    <input
                      type="text"
                      value={snsLinks.instagram}
                      onChange={(e) => setSnsLinks(prev => ({ ...prev, instagram: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Instagram 사용자명"
                    />
                  </div>

                  <div className="detail-item">
                    <label>
                      <span className="sns-icon">▶️</span> YouTube
                    </label>
                    <input
                      type="text"
                      value={snsLinks.youtube}
                      onChange={(e) => setSnsLinks(prev => ({ ...prev, youtube: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="YouTube 채널 URL"
                    />
                  </div>

                  <div className="detail-item">
                    <label>
                      <span className="sns-icon">🐦</span> Twitter
                    </label>
                    <input
                      type="text"
                      value={snsLinks.twitter}
                      onChange={(e) => setSnsLinks(prev => ({ ...prev, twitter: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Twitter 사용자명"
                    />
                  </div>
                </div>

                <div className="detail-actions">
                  {!isEditing ? (
                    <button className="btn-primary" onClick={() => setIsEditing(true)}>
                      수정하기
                    </button>
                  ) : (
                    <>
                      <button className="btn-secondary" onClick={handleCancel} disabled={isSaving}>
                        취소
                      </button>
                      <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? '저장 중...' : '저장'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'follow' && (
            <div className="coming-soon-section">
              <div className="coming-soon-icon">👥</div>
              <h2>팔로우/팔로워</h2>
              <p>팔로우 기능은 곧 출시될 예정입니다.</p>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="coming-soon-section">
              <div className="coming-soon-icon">🎨</div>
              <h2>테마 변경</h2>
              <p>다양한 테마 기능이 준비 중입니다.</p>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="coming-soon-section">
              <div className="coming-soon-icon">💬</div>
              <h2>문의하기/고객센터</h2>
              <p>고객 지원 기능이 준비 중입니다.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
