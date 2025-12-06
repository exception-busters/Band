import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// 사용 가능한 악기 목록
const INSTRUMENTS = [
  { id: 'all', name: '전체', icon: '🎵' },
  { id: 'vocal', name: '보컬', icon: '🎤' },
  { id: 'guitar', name: '기타', icon: '🎸' },
  { id: 'bass', name: '베이스', icon: '🎸' },
  { id: 'keyboard', name: '건반', icon: '🎹' },
  { id: 'drums', name: '드럼', icon: '🥁' },
  { id: 'other', name: '기타 악기', icon: '🎵' },
]

export type CommunityPost = {
  id: string
  author: string
  role: string
  title?: string // 제목 추가 (선택적)
  message: string
  tags: string[] // 태그를 배열로 변경
  instrument: string // 악기 카테고리 추가
  likes: number // 좋아요 수 추가
  likedBy: string[] // 좋아요 누른 사용자 목록 추가
  comments: Comment[] // 댓글 추가
  timestamp: string
  files?: { name: string; size: number; type: string; data?: string }[] // 파일 추가 (선택적, data는 base64)
}

type Comment = {
  id: string
  author: string
  message: string
  timestamp: string
}

const INITIAL_POSTS: CommunityPost[] = [
  {
    id: 'p1',
    author: 'JIHOON',
    role: 'Guitar · Producer',
    title: '네오소울 기타 스템 공유',
    message: '92bpm 네오소울 리듬 기타 스템 공유합니다. 드럼/보컬 구해요! 함께 작업하실 분 연락주세요.',
    tags: ['콜라보', '세션구함'],
    instrument: 'guitar',
    likes: 15,
    likedBy: [],
    comments: [],
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    files: [
      { name: 'neosoul_guitar_92bpm.mp3', size: 3584000, type: 'audio/mpeg' },
    ],
  },
  {
    id: 'p2',
    author: 'SORA',
    role: 'Vocal',
    title: 'Tokyo Sunset Funk 세션 피드백 요청',
    message: 'Tokyo Sunset Funk 룸에 참여 중입니다. 훅 아이디어 피드백 환영해요. 아래 데모 파일 들어보시고 의견 주시면 감사하겠습니다!',
    tags: ['세션', '피드백'],
    instrument: 'vocal',
    likes: 23,
    likedBy: [],
    comments: [],
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    files: [
      { name: 'vocal_demo.mp3', size: 2048000, type: 'audio/mpeg' },
      { name: 'session_cover.jpg', size: 512000, type: 'image/jpeg' },
    ],
  },
  {
    id: 'p3',
    author: 'Min Park',
    role: 'Keys',
    title: '데스크톱 앱 베타 테스터 모집',
    message: '데스크톱 앱 베타 합주 테스트할 분 2명 더 필요합니다. 관심 있으신 분들은 댓글로 연락주세요!',
    tags: ['베타'],
    instrument: 'keyboard',
    likes: 8,
    likedBy: [],
    comments: [],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: 'p4',
    author: 'DrumKing',
    role: 'Drums',
    title: '재즈 정기 세션 드러머 모집',
    message: '재즈 드러머 찾습니다! 매주 목요일 정기 세션 예정입니다. 중급 이상 실력이시면 환영합니다.',
    tags: ['세션', '정기모임'],
    instrument: 'drums',
    likes: 12,
    likedBy: [],
    comments: [],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'p5',
    author: 'BassPlayer',
    role: 'Bass',
    title: '펑크 베이스 라인 피드백 요청',
    message: '펑크 베이스 라인 피드백 부탁드립니다. 첨부한 파일 들어보시고 의견 남겨주세요!',
    tags: ['피드백', '콜라보'],
    instrument: 'bass',
    likes: 18,
    likedBy: [],
    comments: [],
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    files: [
      { name: 'funk_bassline.mp3', size: 1536000, type: 'audio/mpeg' },
    ],
  },
]

const UPCOMING_SESSIONS = [
  { id: 'up1', title: 'Neo Groove Night', time: '오늘 · 22:00', region: 'Seoul Edge', vibe: 'Neo Soul · 92 bpm' },
  { id: 'up2', title: 'Sunset Funk Bus', time: '내일 · 20:30', region: 'Tokyo Edge', vibe: 'City Funk · 108 bpm' },
  { id: 'up3', title: 'Nautica Lab', time: '토요일 · 18:00', region: 'LA Edge', vibe: 'Ambient · 76 bpm' },
]

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.round(diff / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.round(hours / 24)
  return `${days}일 전`
}

export function Community() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    const saved = localStorage.getItem('community-posts')
    const version = localStorage.getItem('community-posts-version')

    // 버전이 없거나 구버전이면 새로운 더미 데이터로 초기화
    if (!version || version !== '2.0') {
      localStorage.setItem('community-posts-version', '2.0')
      localStorage.setItem('community-posts', JSON.stringify(INITIAL_POSTS))
      return INITIAL_POSTS
    }

    return saved ? JSON.parse(saved) : INITIAL_POSTS
  })
  const [selectedInstrument, setSelectedInstrument] = useState('all')
  const [selectedTag, setSelectedTag] = useState<string | null>(null) // 선택된 태그 필터
  const { user } = useAuth()

  // localStorage에 게시물 저장
  useEffect(() => {
    localStorage.setItem('community-posts', JSON.stringify(posts))
  }, [posts])

  const trendingTags = useMemo(() => {
    const counts = posts.reduce<Record<string, number>>((acc, post) => {
      post.tags.forEach(tag => {
        acc[tag] = (acc[tag] ?? 0) + 1
      })
      return acc
    }, {})
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [posts])

  // 인기 게시물 (좋아요 많은 순)
  const popularPosts = useMemo(() => {
    return [...posts].sort((a, b) => b.likes - a.likes).slice(0, 3)
  }, [posts])

  // 악기별 및 태그별 필터링된 게시물
  const filteredPosts = useMemo(() => {
    let filtered = posts

    // 악기 필터
    if (selectedInstrument !== 'all') {
      filtered = filtered.filter(post => post.instrument === selectedInstrument)
    }

    // 태그 필터
    if (selectedTag) {
      filtered = filtered.filter(post => post.tags.includes(selectedTag))
    }

    return filtered
  }, [posts, selectedInstrument, selectedTag])

  const handleLike = (postId: string, e?: React.MouseEvent) => {
    e?.stopPropagation() // 게시물 클릭 이벤트 전파 방지

    if (!user) {
      alert('좋아요를 누르려면 로그인이 필요합니다.')
      return
    }

    const userId = user.email || user.uid || 'anonymous'

    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const likedBy = post.likedBy || []
        const hasLiked = likedBy.includes(userId)

        if (hasLiked) {
          // 좋아요 취소
          return {
            ...post,
            likes: Math.max(0, post.likes - 1),
            likedBy: likedBy.filter(id => id !== userId)
          }
        } else {
          // 좋아요 추가
          return {
            ...post,
            likes: post.likes + 1,
            likedBy: [...likedBy, userId]
          }
        }
      }
      return post
    }))
  }

  const handlePostClick = (postId: string) => {
    navigate(`/community/${postId}`)
  }

  const handleTagClick = (tag: string) => {
    setSelectedTag(selectedTag === tag ? null : tag)
  }

  const cardStyle = {
    background: 'rgba(18, 22, 45, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>커뮤니티</h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '16px' }}>세션 파트너와 아이디어 공유</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        <div>
          {/* 인기 게시물 섹션 */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>🔥 인기 게시물</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {popularPosts.map((post) => (
                <article
                  key={post.id}
                  style={cardStyle}
                  onClick={() => handlePostClick(post.id)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(141, 123, 255, 0.4)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>
                        {INSTRUMENTS.find(i => i.id === post.instrument)?.icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        {post.title && (
                          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                            {post.title}
                          </div>
                        )}
                        <div style={{ fontSize: '14px', fontWeight: '400', marginBottom: '4px', color: 'rgba(255, 255, 255, 0.85)' }}>
                          {post.message.length > 60 ? `${post.message.slice(0, 60)}...` : post.message}
                        </div>
                        <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.7)' }}>{post.author}</span>
                          {' · '}
                          {formatRelativeTime(post.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {post.tags.length > 0 && post.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          onClick={() => handleTagClick(tag)}
                          style={{
                            display: 'inline-block',
                            background:
                              selectedTag === tag
                                ? 'rgba(141, 123, 255, 0.3)'
                                : 'rgba(141, 123, 255, 0.15)',
                            color: '#a89fff',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            border:
                              selectedTag === tag
                                ? '1px solid rgba(141, 123, 255, 0.6)'
                                : '1px solid rgba(141, 123, 255, 0.3)',
                            cursor: 'pointer',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                      <span
                        style={{
                          padding: '4px 12px',
                          background: 'rgba(255, 122, 184, 0.15)',
                          color: '#ff7ab8',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                        }}
                        onClick={(e) => handleLike(post.id, e)}
                      >
                        ❤️ {post.likes}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* 세션별 게시판 섹션 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>🎵 세션별 게시판</h2>
              <button
                onClick={() => navigate('/community/create')}
                style={{
                  background: 'linear-gradient(135deg, #8d7bff, #a89fff)',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(141, 123, 255, 0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                ✏️ 글 작성
              </button>
            </div>

            {/* 악기 탭 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {INSTRUMENTS.map((instrument) => (
                <button
                  key={instrument.id}
                  onClick={() => setSelectedInstrument(instrument.id)}
                  style={{
                    background: selectedInstrument === instrument.id
                      ? 'linear-gradient(135deg, #8d7bff, #a89fff)'
                      : 'rgba(18, 22, 45, 0.8)',
                    border: selectedInstrument === instrument.id
                      ? '1px solid rgba(141, 123, 255, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{instrument.icon}</span>
                  <span>{instrument.name}</span>
                </button>
              ))}
            </div>

            {/* 활성 필터 표시 */}
            {selectedTag && (
              <div
                style={{
                  background: 'rgba(141, 123, 255, 0.1)',
                  border: '1px solid rgba(141, 123, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '14px' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>필터:</span>{' '}
                  <span style={{ color: '#a89fff', fontWeight: '600' }}>#{selectedTag}</span>
                </span>
                <button
                  onClick={() => setSelectedTag(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.7)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '4px 8px',
                  }}
                >
                  ✕ 필터 해제
                </button>
              </div>
            )}

            {/* 필터링된 게시글 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredPosts.length === 0 ? (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  {selectedTag
                    ? `#${selectedTag} 태그가 포함된 게시물이 없습니다.`
                    : '아직 게시물이 없습니다. 첫 게시물을 작성해보세요!'}
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <article
                    key={post.id}
                    style={cardStyle}
                    onClick={() => handlePostClick(post.id)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(141, 123, 255, 0.4)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '18px' }}>
                            {INSTRUMENTS.find(i => i.id === post.instrument)?.icon}
                          </span>
                          <span style={{ fontWeight: '600', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                            {post.author}
                          </span>
                          <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)' }}>·</span>
                          <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)' }}>
                            {post.role}
                          </span>
                          <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)' }}>·</span>
                          <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)' }}>
                            {formatRelativeTime(post.timestamp)}
                          </span>
                        </div>
                        {post.title && (
                          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>
                            {post.title}
                          </div>
                        )}
                        <p style={{ fontSize: '14px', margin: '0 0 8px 0', lineHeight: '1.5', color: 'rgba(255, 255, 255, 0.85)' }}>
                          {post.message.length > 100 ? `${post.message.slice(0, 100)}...` : post.message}
                        </p>
                        {post.files && post.files.length > 0 && (
                          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '8px' }}>
                            📎 첨부파일 {post.files.length}개
                          </div>
                        )}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            style={{
                              padding: '4px 10px',
                              background: 'rgba(255, 122, 184, 0.15)',
                              color: '#ff7ab8',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => handleLike(post.id, e)}
                          >
                            ❤️ {post.likes}
                          </span>
                        </div>
                      </div>
                      {post.tags.length > 0 && (
                        <div
                          style={{ display: 'flex', gap: '6px', flexShrink: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {post.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              onClick={() => handleTagClick(tag)}
                              style={{
                                display: 'inline-block',
                                background:
                                  selectedTag === tag
                                    ? 'rgba(141, 123, 255, 0.3)'
                                    : 'rgba(141, 123, 255, 0.15)',
                                color: '#a89fff',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '500',
                                border:
                                  selectedTag === tag
                                    ? '1px solid rgba(141, 123, 255, 0.6)'
                                    : '1px solid rgba(141, 123, 255, 0.3)',
                                cursor: 'pointer',
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 사이드바 */}
        <div>
          {/* 트렌딩 태그 */}
          <div
            style={{
              background: 'rgba(18, 22, 45, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>트렌딩 태그</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {trendingTags.length === 0 ? (
                <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }}>첫 게시물을 남겨주세요.</p>
              ) : (
                trendingTags.map(([tag, count]) => (
                  <span
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    style={{
                      display: 'inline-block',
                      background:
                        selectedTag === tag
                          ? 'rgba(141, 123, 255, 0.3)'
                          : 'rgba(141, 123, 255, 0.15)',
                      color: '#a89fff',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      border:
                        selectedTag === tag
                          ? '1px solid rgba(141, 123, 255, 0.6)'
                          : '1px solid rgba(141, 123, 255, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (selectedTag !== tag) {
                        e.currentTarget.style.background = 'rgba(141, 123, 255, 0.25)'
                      }
                    }}
                    onMouseOut={(e) => {
                      if (selectedTag !== tag) {
                        e.currentTarget.style.background = 'rgba(141, 123, 255, 0.15)'
                      }
                    }}
                  >
                    #{tag} <small style={{ opacity: 0.7 }}>{count}</small>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 다가오는 세션 */}
          <div
            style={{
              background: 'rgba(18, 22, 45, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>다가오는 세션</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {UPCOMING_SESSIONS.map((session) => (
                <div
                  key={session.id}
                  onClick={() => navigate('/rooms')}
                  style={{
                    padding: '12px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                    e.currentTarget.style.borderColor = 'rgba(141, 123, 255, 0.3)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{session.title}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
                    {session.time}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {session.region} · {session.vibe}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
