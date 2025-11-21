import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'

type CommunityPost = {
  id: string
  author: string
  role: string
  message: string
  tag: string
  timestamp: string
}

const INITIAL_POSTS: CommunityPost[] = [
  {
    id: 'p1',
    author: 'JIHOON',
    role: 'Guitar · Producer',
    message: '92bpm 네오소울 리듬 기타 스템 공유합니다. 드럼/보컬 구해요!',
    tag: '콜라보',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'p2',
    author: 'SORA',
    role: 'Vocal',
    message: 'Tokyo Sunset Funk 룸에 참여 중입니다. 훅 아이디어 피드백 환영해요.',
    tag: '세션',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'p3',
    author: 'Min Park',
    role: 'Keys',
    message: '데스크톱 앱 베타 합주 테스트할 분 2명 더 필요합니다.',
    tag: '베타',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
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
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_POSTS)
  const [newPost, setNewPost] = useState('')
  const [newTag, setNewTag] = useState('세션')
  const { user } = useAuth()

  const trendingTags = useMemo(() => {
    const counts = posts.reduce<Record<string, number>>((acc, post) => {
      acc[post.tag] = (acc[post.tag] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [posts])

  const createPost = () => {
    if (!newPost.trim()) return
    if (!user) {
      alert('게시글을 작성하려면 로그인이 필요합니다.')
      return
    }

    const post: CommunityPost = {
      id: generateId(),
      author: user.email?.split('@')[0] ?? 'User',
      role: 'Session Member',
      message: newPost.trim(),
      tag: newTag,
      timestamp: new Date().toISOString(),
    }
    setPosts((prev) => [post, ...prev])
    setNewPost('')
  }

  return (
    <div className="community-page">
      <div className="community-header">
        <div>
          <h1>커뮤니티</h1>
          <p>세션 파트너와 아이디어 공유</p>
        </div>
      </div>

      <div className="community-layout">
        <div className="community-main">
          <div className="community-form-card">
            <h3>새로운 업데이트</h3>
            {user ? (
              <>
                <textarea
                  value={newPost}
                  placeholder="세션 계획, 믹스 노트, 협업 요청 등을 남겨보세요."
                  onChange={(e) => setNewPost(e.target.value)}
                  rows={4}
                />
                <div className="form-row">
                  <select value={newTag} onChange={(e) => setNewTag(e.target.value)}>
                    <option value="세션">세션</option>
                    <option value="콜라보">콜라보</option>
                    <option value="베타">베타</option>
                    <option value="피드백">피드백</option>
                  </select>
                  <button onClick={createPost} disabled={!newPost.trim()}>
                    게시
                  </button>
                </div>
              </>
            ) : (
              <div className="login-required">
                <p>게시글을 작성하려면 로그인이 필요합니다.</p>
              </div>
            )}
          </div>

          <div className="community-feed">
            {posts.map((post) => (
              <article key={post.id} className="post-card">
                <header className="post-header">
                  <div className="post-author">
                    <strong>{post.author}</strong>
                    <span>{post.role}</span>
                  </div>
                  <span className="post-tag">{post.tag}</span>
                </header>
                <p className="post-message">{post.message}</p>
                <footer className="post-footer">{formatRelativeTime(post.timestamp)}</footer>
              </article>
            ))}
          </div>
        </div>

        <div className="community-sidebar">
          <div className="tag-cloud-card">
            <h3>트렌딩 태그</h3>
            <div className="tag-cloud">
              {trendingTags.length === 0 ? (
                <p className="empty-state">첫 게시물을 남겨주세요.</p>
              ) : (
                trendingTags.map(([tag, count]) => (
                  <span key={tag} className="tag-pill">
                    #{tag} <small>{count}</small>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="upcoming-card">
            <h3>다가오는 세션</h3>
            <ul className="upcoming-list">
              {UPCOMING_SESSIONS.map((session) => (
                <li key={session.id} className="upcoming-item">
                  <strong>{session.title}</strong>
                  <span className="session-time">{session.time}</span>
                  <small className="session-details">
                    {session.region} · {session.vibe}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
