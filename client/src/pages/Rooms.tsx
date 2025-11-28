import { useEffect, useMemo, useState, useCallback } from 'react'
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

interface MyRoom extends DbRoom {
  // DbRoom과 동일하지만 명시적으로 구분
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
  const [showMyRooms, setShowMyRooms] = useState(false)
  const [myRooms, setMyRooms] = useState<MyRoom[]>([])
  const [myRoomsLoading, setMyRoomsLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  // 내가 만든 방 목록 불러오기
  const fetchMyRooms = useCallback(async () => {
    if (!supabase || !user) return

    setMyRoomsLoading(true)
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMyRooms(data as MyRoom[])
    } catch (err) {
      console.error('Failed to fetch my rooms:', err)
    } finally {
      setMyRoomsLoading(false)
    }
  }, [user])

  // 내 방 삭제
  const handleDeleteMyRoom = async (roomId: string) => {
    if (!supabase || !user) return

    const confirmed = window.confirm('정말로 이 합주실을 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)
        .eq('host_id', user.id)

      if (error) throw error

      // 목록에서 제거
      setMyRooms(prev => prev.filter(r => r.id !== roomId))
    } catch (err) {
      console.error('Failed to delete room:', err)
      alert('삭제에 실패했습니다.')
    }
  }

  // 내 방 모달 열기
  const handleOpenMyRooms = () => {
    if (!user) {
      navigate('/auth', { state: { from: '/rooms' } })
      return
    }
    setShowMyRooms(true)
    fetchMyRooms()
  }

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
      {/* 내가 만든 방 모달 */}
      {showMyRooms && (
        <div className="my-rooms-modal">
          <div className="modal-backdrop" onClick={() => setShowMyRooms(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h2>내가 만든 합주실</h2>
              <button onClick={() => setShowMyRooms(false)} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              {myRoomsLoading ? (
                <div className="my-rooms-loading">불러오는 중...</div>
              ) : myRooms.length === 0 ? (
                <div className="my-rooms-empty">
                  <p>아직 만든 합주실이 없습니다.</p>
                  <button onClick={() => { setShowMyRooms(false); handleCreateRoom(); }} className="create-room-btn-small">
                    + 새 합주실 만들기
                  </button>
                </div>
              ) : (
                <div className="my-rooms-list">
                  {myRooms.map(room => (
                    <div key={room.id} className="my-room-item">
                      <div className="my-room-info">
                        <h4>{room.title}</h4>
                        <p>{room.genre || '기타'} · {room.current_participants}/{room.max_participants}명</p>
                      </div>
                      <div className="my-room-actions">
                        <button
                          onClick={() => { setShowMyRooms(false); navigate(`/rooms/${room.id}`); }}
                          className="my-room-enter-btn"
                        >
                          입장
                        </button>
                        <button
                          onClick={() => handleDeleteMyRoom(room.id)}
                          className="my-room-delete-btn"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rooms-header">
        <div>
          <h1>합주실 찾기</h1>
          <p>전 세계 음악가들과 실시간으로 연주하세요</p>
        </div>
        <div className="rooms-header-buttons">
          <button onClick={handleOpenMyRooms} className="my-rooms-btn">
            📋 내 합주실
          </button>
          <button onClick={handleCreateRoom} className="create-room-btn">
            + 새 합주실 만들기
          </button>
        </div>
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
