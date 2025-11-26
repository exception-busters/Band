import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

const GENRES = [
  '록', '재즈', '블루스', '클래식', '팝', '힙합',
  '일렉트로닉', '포크', '메탈', '펑크', '레게', '기타'
]

const COMMON_TAGS = [
  '초보환영', '경력자', '세션구함', '정기모임',
  '즉흥연주', '커버곡', '자작곡', '녹음가능'
]

export function CreateRoom() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('록')
  const [maxParticipants, setMaxParticipants] = useState(8)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 로그인 안 되어 있으면 로그인 페이지로
  if (!user) {
    navigate('/auth', { state: { from: '/rooms/create' } })
    return null
  }

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleAddCustomTag = () => {
    const tag = customTag.trim()
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag])
      setCustomTag('')
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('방 제목을 입력하세요.')
      return
    }

    if (!supabase) {
      setError('데이터베이스에 연결할 수 없습니다.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('rooms')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          host_id: user.id,
          max_participants: maxParticipants,
          genre: genre,
          tags: selectedTags,
          status: 'open'
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 방 생성 성공 -> 방 상세 페이지로 이동
      navigate(`/rooms/${data.id}`)
    } catch (err) {
      console.error('Room creation error:', err)
      setError(err instanceof Error ? err.message : '방 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-room-page">
      <div className="create-room-container">
        <div className="create-room-header">
          <h1>새 합주실 만들기</h1>
          <p>친구들과 함께 음악을 만들어보세요</p>
        </div>

        <form onSubmit={handleSubmit} className="create-room-form">
          <div className="form-group">
            <label htmlFor="title">방 제목 *</label>
            <input
              id="title"
              type="text"
              placeholder="예: 주말 재즈 세션"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">설명</label>
            <textarea
              id="description"
              placeholder="어떤 합주를 하고 싶으신가요? (선택사항)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="genre">장르</label>
              <select
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                {GENRES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="maxParticipants">최대 인원</label>
              <select
                id="maxParticipants"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
              >
                {[2, 4, 6, 8, 10, 12, 16, 20].map(n => (
                  <option key={n} value={n}>{n}명</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>태그</label>
            <div className="tags-container">
              {COMMON_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-btn ${selectedTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="custom-tag-input">
              <input
                type="text"
                placeholder="커스텀 태그 추가"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag())}
                maxLength={20}
              />
              <button type="button" onClick={handleAddCustomTag}>추가</button>
            </div>
            {selectedTags.length > 0 && (
              <div className="selected-tags">
                {selectedTags.map(tag => (
                  <span key={tag} className="selected-tag">
                    {tag}
                    <button type="button" onClick={() => handleTagToggle(tag)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/rooms')}
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? '생성 중...' : '합주실 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
