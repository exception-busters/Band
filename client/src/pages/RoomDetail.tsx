import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useRoom } from '../contexts/RoomContext'
import { supabase } from '../lib/supabaseClient'

interface Room {
  id: string
  title: string
  description: string | null
  host_id: string
  max_participants: number
  current_participants: number
  status: string
  genre: string | null
  tags: string[]
}

const RTC_STATUS_TEXT = {
  idle: '대기',
  connecting: '연결 중',
  live: 'Live',
  error: '에러',
}

export function RoomDetail() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    signalStatus,
    clientId,
    peers,
    joinRoom,
    joinFeedback,
    rtcStatus,
    rtcError,
    localStream,
    remoteAudioMap,
    startLocalMic,
    stopLocalMic,
    currentRoomId,
    leaveRoom,
  } = useRoom()

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasJoined, setHasJoined] = useState(false)
  const [viewerMode, setViewerMode] = useState(false)
  const localPreviewRef = useRef<HTMLAudioElement | null>(null)

  // DB에서 방 정보 가져오기
  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId || !supabase) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single()

        if (error) throw error
        setRoom(data)
      } catch (err) {
        console.error('Failed to fetch room:', err)
        navigate('/rooms')
      } finally {
        setLoading(false)
      }
    }

    fetchRoom()
  }, [roomId, navigate])


  useEffect(() => {
    if (localPreviewRef.current) {
      localPreviewRef.current.srcObject = localStream
    }
  }, [localStream])

  const handleJoinAsParticipant = async () => {
    if (!user) {
      navigate('/auth', { state: { from: `/rooms/${roomId}` } })
      return
    }

    if (room?.status === 'locked') {
      alert('이 방은 잠겨있습니다. 초대가 필요합니다.')
      return
    }

    if (!roomId) return

    joinRoom(roomId)
    setHasJoined(true)
    setViewerMode(false)

    // 자동으로 마이크 시작
    try {
      await startLocalMic()
    } catch (error) {
      console.error('Failed to start mic:', error)
    }
  }

  const handleJoinAsViewer = () => {
    if (!roomId) return
    joinRoom(roomId)
    setHasJoined(true)
    setViewerMode(true)
  }

  const handleLeave = () => {
    leaveRoom()
    setHasJoined(false)
    setViewerMode(false)
    navigate('/rooms')
  }

  const remoteAudioEntries = Object.entries(remoteAudioMap)

  if (loading) {
    return <div className="loading-state">합주실 정보를 불러오는 중...</div>
  }

  if (!room) {
    return null
  }

  // 입장 전 화면
  if (!hasJoined) {
    return (
      <div className="room-entrance">
        <div className="entrance-backdrop" />
        <div className="entrance-content">
          <div className="entrance-info">
            <div className="breadcrumb">
              <Link to="/rooms">← 합주실 목록</Link>
            </div>
            <h1 className="entrance-title">{room.title}</h1>
            <p className="entrance-genre">{room.genre || '기타'}</p>
            <p className="entrance-vibe">{room.description || '함께 음악을 만들어요'}</p>

            <div className="entrance-stats">
              <div className="entrance-stat">
                <span className="stat-icon">👥</span>
                <div>
                  <div className="stat-value">
                    {room.current_participants}/{room.max_participants}
                  </div>
                  <div className="stat-label">참여 중</div>
                </div>
              </div>
              <div className="entrance-stat">
                <span className="stat-icon">📌</span>
                <div>
                  <div className="stat-value">
                    {room.status === 'open' ? '입장 가능' : room.status === 'recording' ? '녹음 중' : '잠김'}
                  </div>
                  <div className="stat-label">상태</div>
                </div>
              </div>
            </div>

            {room.tags && room.tags.length > 0 && (
              <div className="entrance-tags">
                <h3>태그</h3>
                <div className="tag-list">
                  {room.tags.map((tag) => (
                    <span key={tag} className="tag-item">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="entrance-actions">
            <div className="entrance-card">
              <h2>입장 방법 선택</h2>

              <button onClick={handleJoinAsParticipant} className="join-btn participant" disabled={room.status === 'locked' && !user}>
                <div className="join-btn-content">
                  <span className="join-icon">🎤</span>
                  <div className="join-text">
                    <strong>참여자로 입장</strong>
                    <small>마이크를 공유하고 함께 연주합니다</small>
                  </div>
                </div>
                {!user && <span className="join-badge">로그인 필요</span>}
              </button>

              <button onClick={handleJoinAsViewer} className="join-btn viewer">
                <div className="join-btn-content">
                  <span className="join-icon">👀</span>
                  <div className="join-text">
                    <strong>관람자로 입장</strong>
                    <small>다른 사람들의 세션을 듣기만 합니다</small>
                  </div>
                </div>
              </button>

              {signalStatus === 'error' && (
                <div className="entrance-error">시그널링 서버 연결에 실패했습니다. 잠시 후 다시 시도하세요.</div>
              )}

              {signalStatus === 'connecting' && (
                <div className="entrance-loading">서버에 연결 중...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 입장 후 화면 - 실제 합주실
  return (
    <div className="room-session">
      <div className="session-header">
        <div className="session-info">
          <h1>{room.title}</h1>
          <span className={`session-status ${rtcStatus}`}>{RTC_STATUS_TEXT[rtcStatus]}</span>
        </div>
        <button onClick={handleLeave} className="leave-btn">
          퇴장하기
        </button>
      </div>

      <div className="session-content">
        <div className="session-main">
          {/* 로컬 오디오 */}
          <div className="audio-section local-section">
            <div className="section-header">
              <h2>내 오디오</h2>
              <span className="connection-info">
                Client ID: {clientId?.slice(0, 8)}...
              </span>
            </div>

            {viewerMode ? (
              <div className="viewer-notice">
                <p>👀 관람 모드로 입장하셨습니다</p>
                <small>마이크를 공유하지 않고 다른 사람들의 연주를 들을 수 있습니다</small>
              </div>
            ) : (
              <div className="local-controls">
                <div className="audio-controls">
                  <button onClick={localStream ? stopLocalMic : startLocalMic} className={localStream ? 'active' : ''}>
                    {localStream ? '🎤 마이크 중지' : '🎤 마이크 시작'}
                  </button>
                  <audio ref={localPreviewRef} autoPlay muted playsInline controls={Boolean(localStream)} />
                </div>
                {rtcError && <div className="error-message">{rtcError}</div>}
                {!localStream && (
                  <div className="mic-hint">
                    마이크 버튼을 눌러 다른 참여자들과 오디오를 공유하세요
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 리모트 오디오 */}
          <div className="audio-section remote-section">
            <div className="section-header">
              <h2>참여자 오디오</h2>
              <span className="participant-count">{peers.length + 1}명 접속 중</span>
            </div>

            <div className="participants-grid">
              {remoteAudioEntries.length === 0 ? (
                <div className="empty-participants">
                  <p>아직 수신 중인 오디오가 없습니다</p>
                  <small>다른 참여자가 마이크를 켜면 여기에 표시됩니다</small>
                </div>
              ) : (
                remoteAudioEntries.map(([peerId, stream]) => (
                  <div key={peerId} className="participant-card">
                    <div className="participant-avatar">
                      <span>🎵</span>
                    </div>
                    <div className="participant-info">
                      <strong>Peer {peerId.slice(0, 6)}</strong>
                      <small>참여 중</small>
                    </div>
                    <audio
                      autoPlay
                      playsInline
                      controls
                      ref={(node) => {
                        if (node && stream) {
                          node.srcObject = stream
                        }
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="session-sidebar">
          <div className="room-details-card">
            <h3>룸 정보</h3>
            <div className="detail-item">
              <span>장르</span>
              <strong>{room.genre || '기타'}</strong>
            </div>
            <div className="detail-item">
              <span>상태</span>
              <strong>{room.status === 'open' ? '입장 가능' : room.status === 'recording' ? '녹음 중' : '잠김'}</strong>
            </div>
            <div className="detail-item">
              <span>수용 인원</span>
              <strong>
                {room.current_participants}/{room.max_participants}
              </strong>
            </div>
          </div>

          {joinFeedback && (
            <div className="feedback-card">
              <p>{joinFeedback}</p>
            </div>
          )}

          <div className="peers-card">
            <h3>접속 중인 피어</h3>
            {peers.length === 0 ? (
              <p className="empty-peers">현재 접속한 피어가 없습니다</p>
            ) : (
              <div className="peers-list">
                {peers.map((peer) => (
                  <div key={peer} className="peer-item">
                    <span className="peer-dot" />
                    <span>Peer {peer.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
