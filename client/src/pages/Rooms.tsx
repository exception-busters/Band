import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { INITIAL_ROOMS, ROOM_FILTERS, type Room, type RoomStatus } from '../data/rooms'

export function Rooms() {
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS)
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const { user } = useAuth()
  const navigate = useNavigate()

  const filteredRooms = useMemo(() => {
    const filter = ROOM_FILTERS.find((item) => item.id === roomFilter)
    if (!filter || !filter.match) return rooms
    return rooms.filter((room) => Boolean(filter.match?.(room)))
  }, [rooms, roomFilter])

  // 룸 상태 실시간 업데이트 (시뮬레이션)
  useEffect(() => {
    const ticker = setInterval(() => {
      setRooms((prev) =>
        prev.map((room) => {
          const jitter = Math.round(room.latencyMs + (Math.random() - 0.5) * 6)
          const latencyMs = Math.min(42, Math.max(12, jitter))
          const movement = Math.random() > 0.65 ? (Math.random() > 0.5 ? 1 : -1) : 0
          const musicians = Math.min(room.capacity, Math.max(1, room.musicians + movement))
          let status: RoomStatus = room.status
          if (status === 'recording' && Math.random() > 0.6) status = 'open'
          if (status === 'open' && Math.random() > 0.92) status = 'recording'
          return { ...room, latencyMs, musicians, status }
        }),
      )
    }, 4500)
    return () => clearInterval(ticker)
  }, [])

  const handleRoomClick = (roomId: string, roomStatus: RoomStatus) => {
    if (roomStatus === 'locked' && !user) {
      // 잠긴 방은 로그인 필요
      navigate('/auth', { state: { from: `/rooms/${roomId}` } })
      return
    }
    navigate(`/rooms/${roomId}`)
  }

  const handleCreateRoom = () => {
    if (!user) {
      navigate('/auth', { state: { from: '/rooms/create' } })
      return
    }
    // TODO: 방 생성 페이지로 이동
    alert('방 생성 기능은 곧 추가됩니다!')
  }

  return (
    <div className="rooms-page">
      <div className="rooms-header">
        <div>
          <h1>합주실 찾기</h1>
          <p>전 세계 음악가들과 실시간으로 연주하세요</p>
        </div>
        <button onClick={handleCreateRoom} className="create-room-btn">
          + 새 합주실 만들기
        </button>
      </div>

      <div className="room-filters">
        {ROOM_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`filter-chip ${roomFilter === filter.id ? 'active' : ''}`}
            onClick={() => setRoomFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="rooms-grid">
        {filteredRooms.length === 0 ? (
          <div className="empty-state">해당 장르의 합주실이 곧 열립니다.</div>
        ) : (
          filteredRooms.map((room) => (
            <article
              key={room.id}
              className={`room-card ${room.status}`}
              onClick={() => handleRoomClick(room.id, room.status)}
            >
              <div className="room-card-header">
                <div className="room-info">
                  <h3>{room.title}</h3>
                  <span className="room-genre">{room.genre}</span>
                </div>
                <span className={`status-badge ${room.status}`}>
                  {room.status === 'open' ? '입장 가능' : room.status === 'recording' ? '녹음 중' : '잠김'}
                </span>
              </div>

              <p className="room-vibe">{room.vibe}</p>

              <div className="room-stats">
                <div className="stat">
                  <span className="stat-label">BPM</span>
                  <span className="stat-value">{room.bpm}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">인원</span>
                  <span className="stat-value">
                    {room.musicians}/{room.capacity}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">지연</span>
                  <span className="stat-value">{room.latencyMs}ms</span>
                </div>
                <div className="stat">
                  <span className="stat-label">지역</span>
                  <span className="stat-value">{room.region}</span>
                </div>
              </div>

              <div className="room-card-footer">
                <button className="room-enter-btn">
                  {room.status === 'locked' ? '🔒 초대 필요' : '입장하기 →'}
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {!user && (
        <div className="login-prompt">
          <p>
            합주실을 만들거나 잠긴 방에 입장하려면 <Link to="/auth">로그인</Link>이 필요합니다.
          </p>
        </div>
      )}
    </div>
  )
}
