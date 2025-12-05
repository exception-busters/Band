import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { CommunityPost } from './Community'

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

// 임시로 localStorage에서 게시물 데이터 가져오기
const getPostById = (id: string): CommunityPost | null => {
  const postsData = localStorage.getItem('community-posts')
  if (!postsData) return null
  const posts: CommunityPost[] = JSON.parse(postsData)
  return posts.find(p => p.id === id) || null
}

const savePost = (post: CommunityPost) => {
  const postsData = localStorage.getItem('community-posts')
  if (!postsData) return
  const posts: CommunityPost[] = JSON.parse(postsData)
  const updatedPosts = posts.map(p => p.id === post.id ? post : p)
  localStorage.setItem('community-posts', JSON.stringify(updatedPosts))
}

export function PostDetail() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [newComment, setNewComment] = useState('')
  const [allPosts, setAllPosts] = useState<CommunityPost[]>([])

  useEffect(() => {
    if (!postId) return
    const foundPost = getPostById(postId)
    if (!foundPost) {
      navigate('/community')
      return
    }
    setPost(foundPost)

    // 모든 게시물도 가져오기 (트렌딩 태그 계산용)
    const postsData = localStorage.getItem('community-posts')
    if (postsData) {
      setAllPosts(JSON.parse(postsData))
    }
  }, [postId, navigate])

  // 트렌딩 태그 계산
  const trendingTags = useMemo(() => {
    const counts = allPosts.reduce<Record<string, number>>((acc, p) => {
      p.tags.forEach(tag => {
        acc[tag] = (acc[tag] ?? 0) + 1
      })
      return acc
    }, {})
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [allPosts])

  const handleLike = () => {
    if (!post || !user) {
      if (!user) alert('좋아요를 누르려면 로그인이 필요합니다.')
      return
    }

    const userId = user.email || user.uid || 'anonymous'
    const likedBy = post.likedBy || []
    const hasLiked = likedBy.includes(userId)

    const updatedPost = hasLiked
      ? {
          ...post,
          likes: Math.max(0, post.likes - 1),
          likedBy: likedBy.filter(id => id !== userId)
        }
      : {
          ...post,
          likes: post.likes + 1,
          likedBy: [...likedBy, userId]
        }

    setPost(updatedPost)
    savePost(updatedPost)
  }

  const handleAddComment = () => {
    if (!newComment.trim() || !user || !post) return

    const comment = {
      id: generateId(),
      author: user.email?.split('@')[0] ?? 'User',
      message: newComment.trim(),
      timestamp: new Date().toISOString(),
    }

    const updatedPost = {
      ...post,
      comments: [...post.comments, comment]
    }
    setPost(updatedPost)
    savePost(updatedPost)
    setNewComment('')
  }

  if (!post) {
    return <div className="post-detail-page">게시물을 불러오는 중...</div>
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => navigate('/community')}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: 'rgba(255, 255, 255, 0.7)',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '24px',
          fontSize: '14px',
        }}
      >
        ← 목록으로
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* 메인 콘텐츠 */}
        <div>
          {/* 메인 카드 */}
      <div
        style={{
          background: 'rgba(18, 22, 45, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* 헤더: 제목과 태그 */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, flex: 1, lineHeight: '1.3' }}>
              {post.title || post.message}
            </h1>
            {post.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {post.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-block',
                      background: 'rgba(141, 123, 255, 0.15)',
                      color: '#a89fff',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      border: '1px solid rgba(141, 123, 255, 0.3)',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 작성자 정보 */}
          <div style={{ marginTop: '12px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
            <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)' }}>{post.author}</span>
            <span style={{ margin: '0 6px' }}>·</span>
            <span>{post.role}</span>
            <span style={{ margin: '0 6px' }}>·</span>
            <span>{formatRelativeTime(post.timestamp)}</span>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: '28px', lineHeight: '1.7', fontSize: '16px' }}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{post.title ? post.message : post.message}</p>
        </div>

        {/* 첨부파일 */}
        {post.files && post.files.length > 0 && (
          <div
            style={{
              padding: '20px 28px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0, 0, 0, 0.15)',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
              📎 첨부파일 ({post.files.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {post.files.map((file, idx) => {
                const isImage = file.type.startsWith('image/')
                const isAudio = file.type.startsWith('audio/')

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '16px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {isImage ? (
                      <div>
                        <div style={{ marginBottom: '8px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          🖼️ {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                        {file.data ? (
                          <img
                            src={file.data}
                            alt={file.name}
                            style={{
                              width: '100%',
                              maxHeight: '500px',
                              objectFit: 'contain',
                              borderRadius: '6px',
                              background: 'rgba(0, 0, 0, 0.5)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              maxHeight: '400px',
                              background: 'rgba(0, 0, 0, 0.5)',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '20px',
                              color: 'rgba(255, 255, 255, 0.5)',
                            }}
                          >
                            [이미지를 불러올 수 없습니다]
                          </div>
                        )}
                      </div>
                    ) : isAudio ? (
                      <div>
                        <div style={{ marginBottom: '12px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          🎵 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                        {file.data ? (
                          <audio
                            controls
                            src={file.data}
                            style={{
                              width: '100%',
                              height: '40px',
                              outline: 'none',
                            }}
                          >
                            오디오 재생을 지원하지 않는 브라우저입니다.
                          </audio>
                        ) : (
                          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            오디오를 불러올 수 없습니다.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                        {file.data ? (
                          <a
                            href={file.data}
                            download={file.name}
                            style={{
                              background: 'rgba(141, 123, 255, 0.2)',
                              border: '1px solid rgba(141, 123, 255, 0.3)',
                              color: '#a89fff',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              textDecoration: 'none',
                            }}
                          >
                            다운로드
                          </a>
                        ) : (
                          <button
                            disabled
                            style={{
                              background: 'rgba(141, 123, 255, 0.1)',
                              border: '1px solid rgba(141, 123, 255, 0.2)',
                              color: 'rgba(168, 159, 255, 0.5)',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: 'not-allowed',
                              fontSize: '13px',
                              fontWeight: '600',
                            }}
                          >
                            파일 없음
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 좋아요 */}
        <div
          style={{
            padding: '20px 28px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            onClick={handleLike}
            style={{
              background: user && post.likedBy?.includes(user.email || user.uid || 'anonymous')
                ? 'linear-gradient(135deg, #ff7ab8 0%, #ff9dd6 100%)'
                : 'linear-gradient(135deg, #8d7bff 0%, #a89fff 100%)',
              border: 'none',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {user && post.likedBy?.includes(user.email || user.uid || 'anonymous') ? '💖' : '❤️'} 좋아요 {post.likes}
          </button>
        </div>

        {/* 댓글 입력 */}
        <div style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            댓글 {post.comments.length}개
          </h3>
          {user ? (
            <div>
              <textarea
                value={newComment}
                placeholder="댓글을 입력하세요..."
                onChange={(e) => setNewComment(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '14px',
                  resize: 'vertical',
                  marginBottom: '12px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                style={{
                  background: newComment.trim() ? '#8d7bff' : 'rgba(141, 123, 255, 0.3)',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                댓글 작성
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: '16px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.5)',
              }}
            >
              댓글을 작성하려면 로그인이 필요합니다.
            </div>
          )}
        </div>

        {/* 댓글 목록 */}
        {post.comments.length > 0 && (
          <div style={{ padding: '0 28px 28px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {post.comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    padding: '16px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ marginBottom: '10px', fontSize: '14px' }}>
                    <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {comment.author}
                    </span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px', marginLeft: '8px' }}>
                      {formatRelativeTime(comment.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: 0, lineHeight: '1.6', fontSize: '15px', color: 'rgba(255, 255, 255, 0.85)' }}>
                    {comment.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
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
                    onClick={() => navigate('/community')}
                    style={{
                      display: 'inline-block',
                      background: 'rgba(141, 123, 255, 0.15)',
                      color: '#a89fff',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      border: '1px solid rgba(141, 123, 255, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(141, 123, 255, 0.25)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(141, 123, 255, 0.15)'
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
