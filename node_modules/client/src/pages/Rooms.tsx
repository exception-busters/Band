import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ROOM_FILTERS, type RoomStatus } from '../data/rooms'

interface DbRoom {
  id: string
  title: string
  description: string | null
  host_id: string
  max_participants: number
  current_participants: number
  status: string
  genre: string | null
  tags: string[]
  created_at: string
}

interface Room {
  id: string
  title: string
  vibe: string
  genre: string
  musicians: number
  capacity: number
  status: RoomStatus
}

export function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const { user } = useAuth()
  const navigate = useNavigate()

  // 데이터베이스에서 방 목록 불러오기
  useEffect(() => {
    const fetchRooms = async () => {
      if (!supabase) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        // DB 데이터를 UI 형식으로 변환
        const formattedRooms: Room[] = (data as DbRoom[]).map((room) => ({
          id: room.id,
          title: room.title,
          vibe: room.description || '함께 음악을 만들어요',
          genre: room.genre || '기타',
          musicians: room.current_participants,
          capacity: room.max_participants,
          status: room.status as RoomStatus,
        }))

        setRooms(formattedRooms)
      } catch (err) {
        console.error('Failed to fetch rooms:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRooms()

    // 실시간 업데이트 구독
    if (!supabase) return

    const sb = supabase // 타입 narrowing을 위한 로컬 참조
    const channel = sb
      .channel('rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms()
      })
      .subscribe()

    return () => {
      sb.removeChannel(channel)
    }
  }, [])

  const filteredRooms = useMemo(() => {
    const filter = ROOM_FILTERS.find((item) => item.id === roomFilter)
    if (!filter || !filter.match) return rooms
    return rooms.filter((room) => Boolean(filter.match?.(room)))
  }, [rooms, roomFilter])

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
    navigate('/rooms/create')
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
        {loading ? (
          <div className="empty-state">방 목록을 불러오는 중...</div>
        ) : filteredRooms.length === 0 ? (
          <div className="empty-state">
            {rooms.length === 0
              ? '아직 생성된 합주실이 없습니다. 첫 번째 방을 만들어보세요!'
              : '해당 장르의 합주실이 없습니다.'}
          </div>
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
                  <span className="stat-label">인원</span>
                  <span className="stat-value">
                    {room.musicians}/{room.capacity}
                  </span>
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
