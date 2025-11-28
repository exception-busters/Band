import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useRoom } from '../contexts/RoomContext'
import { useAudioSettings } from '../contexts/AudioSettingsContext'
import { AudioSettings } from '../components/AudioSettings'
import { supabase } from '../lib/supabaseClient'

// 악기 슬롯 타입
interface InstrumentSlot {
  instrument: string
  count: number
}

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
  free_join: boolean
  instrument_slots: InstrumentSlot[]
}

// 악기 정보 (아이콘, 이름)
const INSTRUMENT_INFO: Record<string, { icon: string; name: string }> = {
  vocal: { icon: '🎤', name: '보컬' },
  guitar: { icon: '🎸', name: '기타' },
  bass: { icon: '🎸', name: '베이스' },
  keyboard: { icon: '🎹', name: '건반' },
  drums: { icon: '🥁', name: '드럼' },
  other: { icon: '🎵', name: '기타 악기' },
}

const RTC_STATUS_TEXT: Record<string, string> = {
  idle: '대기',
  connecting: '연결 중',
  live: 'LIVE',
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
    rtcStatus,
    rtcError,
    localStream,
    remoteAudioMap,
    startLocalMic,
    stopLocalMic,
    leaveRoom,
    actualStreamSettings,
    // 믹서
    mixSettingsMap,
    setMixVolume,
    setMixPan,
    setMixMuted,
    masterVolume,
    setMasterVolume,
    // 채팅
    chatMessages,
    sendChatMessage,
    nickname,
    setNickname,
    // 악기
    peerInstruments,
    myInstrument,
    setMyInstrument,
    // 네트워크 상태
    peerNetworkStats,
  } = useRoom()

  const { settings: audioSettings, inputDevices } = useAudioSettings()

  // 네트워크 품질 아이콘
  const QUALITY_ICONS: Record<string, { icon: string; color: string; label: string }> = {
    excellent: { icon: '🟢', color: '#4ade80', label: '최상' },
    good: { icon: '🟢', color: '#4ade80', label: '양호' },
    fair: { icon: '🟡', color: '#facc15', label: '보통' },
    poor: { icon: '🔴', color: '#f87171', label: '불량' },
    unknown: { icon: '⚪', color: '#9ca3af', label: '측정 중' },
  }

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPerformer, setIsPerformer] = useState(false)
  const [pendingRequest, setPendingRequest] = useState(false)
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const [showRoomInfo, setShowRoomInfo] = useState(false)
  const [showInstrumentSelect, setShowInstrumentSelect] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const localPreviewRef = useRef<HTMLAudioElement | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  // 현재 선택된 입력 장치 이름
  const currentInputDevice = inputDevices.find(d => d.deviceId === audioSettings.inputDeviceId)?.label || '기본 장치'

  // 방장 여부
  const isHost = user && room?.host_id === user.id

  // 각 악기별 사용 중인 슬롯 수 계산
  const getInstrumentUsage = (instrumentId: string) => {
    return Object.values(peerInstruments).filter(p => p.instrument === instrumentId).length
  }

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
        // 기본 악기 슬롯 설정
        const defaultSlots: InstrumentSlot[] = [
          { instrument: 'vocal', count: 1 },
          { instrument: 'guitar', count: 1 },
          { instrument: 'bass', count: 1 },
          { instrument: 'keyboard', count: 1 },
          { instrument: 'drums', count: 1 },
        ]
        setRoom({
          ...data,
          free_join: data.free_join ?? true,
          instrument_slots: data.instrument_slots ?? defaultSlots
        })
      } catch (err) {
        console.error('Failed to fetch room:', err)
        navigate('/rooms')
      } finally {
        setLoading(false)
      }
    }

    fetchRoom()
  }, [roomId, navigate])

  // 방 입장 시 자동으로 joinRoom 호출 + DB 참여자 수 증가
  useEffect(() => {
    if (room && roomId && signalStatus === 'connected') {
      joinRoom(roomId)

      // DB 참여자 수 증가
      const incrementParticipants = async () => {
        if (!supabase) return
        await supabase.rpc('increment_participants', { room_id: roomId })
      }
      incrementParticipants()
    }
  }, [room, roomId, signalStatus])

  // 페이지 떠날 때 DB 참여자 수 감소
  useEffect(() => {
    if (!roomId || !supabase) return

    const decrementParticipants = async () => {
      await supabase.rpc('decrement_participants', { room_id: roomId })
    }

    // 브라우저 닫기/새로고침 시
    const handleBeforeUnload = () => {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/decrement_participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ room_id: roomId }),
        keepalive: true
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      decrementParticipants()
    }
  }, [roomId])

  useEffect(() => {
    if (localPreviewRef.current) {
      localPreviewRef.current.srcObject = localStream
    }
  }, [localStream])

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  // 연주자로 전환 요청 (악기 선택 모달 열기)
  const handleBecomePerformer = () => {
    if (!user) {
      navigate('/auth', { state: { from: `/rooms/${roomId}` } })
      return
    }

    if (room?.free_join || isHost) {
      // 악기 선택 모달 열기
      setShowInstrumentSelect(true)
    } else {
      setPendingRequest(true)
      alert('방장에게 연주 참여 요청을 보냈습니다. 승인을 기다려주세요.')
    }
  }

  // 악기 선택 후 연주 시작
  const handleSelectInstrument = async (instrumentId: string) => {
    setShowInstrumentSelect(false)
    setMyInstrument(instrumentId)
    setIsPerformer(true)

    try {
      await startLocalMic()
    } catch (error) {
      console.error('Failed to start mic:', error)
    }
  }

  // 관람자로 전환
  const handleBecomeViewer = () => {
    stopLocalMic()
    setIsPerformer(false)
    setPendingRequest(false)
  }

  // 퇴장
  const handleLeave = () => {
    leaveRoom()
    navigate('/rooms')
  }

  // 채팅 전송
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (chatInput.trim()) {
      sendChatMessage(chatInput)
      setChatInput('')
    }
  }

  // 현재 연주 중인 사람들
  const remoteAudioEntries = Object.entries(remoteAudioMap)
  const performerCount = (localStream ? 1 : 0) + remoteAudioEntries.length

  if (loading) {
    return <div className="loading-state">합주실 정보를 불러오는 중...</div>
  }

  if (!room) {
    return null
  }

  if (signalStatus === 'connecting') {
    return (
      <div className="loading-state">
        <div className="connecting-spinner" />
        서버에 연결 중...
      </div>
    )
  }

  if (signalStatus === 'error') {
    return (
      <div className="error-state">
        <p>시그널링 서버 연결에 실패했습니다.</p>
        <button onClick={() => window.location.reload()}>다시 시도</button>
      </div>
    )
  }

  return (
    <div className="live-room">
      {/* 오디오 설정 모달 */}
      {showAudioSettings && (
        <AudioSettings isModal onClose={() => setShowAudioSettings(false)} />
      )}

      {/* 방 정보 모달 */}
      {showRoomInfo && (
        <div className="room-info-modal">
          <div className="modal-backdrop" onClick={() => setShowRoomInfo(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h2>방 정보</h2>
              <button onClick={() => setShowRoomInfo(false)} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="info-row"><span>방장</span><strong>{isHost ? '나' : `User ${room.host_id.slice(0, 6)}`}</strong></div>
              <div className="info-row"><span>장르</span><strong>{room.genre || '기타'}</strong></div>
              <div className="info-row"><span>참여 방식</span><strong>{room.free_join ? '자유 참여' : '승인 필요'}</strong></div>
              <div className="info-row"><span>수용 인원</span><strong>{room.current_participants}/{room.max_participants}</strong></div>
              {room.description && <p className="room-description">{room.description}</p>}
              {room.tags && room.tags.length > 0 && (
                <div className="tags-list">
                  {room.tags.map((tag) => <span key={tag} className="tag">#{tag}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 악기 선택 모달 */}
      {showInstrumentSelect && (
        <div className="instrument-select-modal">
          <div className="modal-backdrop" onClick={() => setShowInstrumentSelect(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h2>악기 선택</h2>
              <button onClick={() => setShowInstrumentSelect(false)} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">연주할 악기를 선택하세요</p>
              <div className="instrument-grid">
                {room?.instrument_slots?.map(slot => {
                  const info = INSTRUMENT_INFO[slot.instrument] || { icon: '🎵', name: slot.instrument }
                  const used = getInstrumentUsage(slot.instrument)
                  const available = slot.count - used
                  const isAvailable = available > 0

                  return (
                    <button
                      key={slot.instrument}
                      className={`instrument-option ${!isAvailable ? 'disabled' : ''}`}
                      onClick={() => isAvailable && handleSelectInstrument(slot.instrument)}
                      disabled={!isAvailable}
                    >
                      <span className="inst-icon">{info.icon}</span>
                      <span className="inst-name">{info.name}</span>
                      <span className={`inst-slots ${available === 0 ? 'full' : ''}`}>
                        {available}/{slot.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <header className="live-header">
        <div className="live-header-left">
          <Link to="/rooms" className="back-link">←</Link>
          <div className="live-title-area">
            <h1>{room.title}</h1>
            <div className="live-meta">
              <span className={`live-badge ${rtcStatus}`}>
                {rtcStatus === 'live' ? '● LIVE' : RTC_STATUS_TEXT[rtcStatus]}
              </span>
              <span className="genre-badge">{room.genre || '기타'}</span>
              <span className="viewer-count">👁 {peers.length + 1}명</span>
            </div>
          </div>
        </div>
        <div className="live-header-right">
          <button onClick={() => setShowRoomInfo(true)} className="header-btn">
            ℹ️ 정보
          </button>
          <button onClick={() => setShowAudioSettings(true)} className="header-btn">
            🎛️ 설정
          </button>
          <button onClick={handleLeave} className="header-btn leave">
            나가기
          </button>
        </div>
      </header>

      <div className="live-body">
        {/* 왼쪽: 연주자 패널 */}
        <aside className="performers-panel">
          <div className="panel-header">
            <h2>🎸 연주자</h2>
            <span className="performer-count">{performerCount}명</span>
          </div>

          <div className="performers-list">
            {/* 내 오디오 (연주자일 경우) */}
            {isPerformer && myInstrument && (
              <div className={`performer-item me ${localStream ? 'active' : 'muted'}`}>
                <div className="performer-avatar">
                  {isHost && <span className="host-crown">👑</span>}
                  <div className="avatar-circle">
                    <span>{INSTRUMENT_INFO[myInstrument]?.icon || '🎵'}</span>
                  </div>
                  {localStream && <span className="live-indicator" />}
                </div>
                <div className="performer-info">
                  <span className="performer-name">{nickname} {isHost && '(방장)'}</span>
                  <span className="performer-instrument">{INSTRUMENT_INFO[myInstrument]?.name || myInstrument}</span>
                </div>
                <button
                  onClick={localStream ? stopLocalMic : startLocalMic}
                  className={`mic-toggle ${localStream ? 'on' : 'off'}`}
                >
                  {localStream ? '🎤' : '🔇'}
                </button>
                <audio ref={localPreviewRef} autoPlay muted playsInline />
              </div>
            )}

            {/* 다른 연주자들 */}
            {remoteAudioEntries.map(([oderId, stream]) => {
              const peerInfo = peerInstruments[oderId]
              const instInfo = peerInfo ? INSTRUMENT_INFO[peerInfo.instrument] : null
              const netStats = peerNetworkStats[oderId]
              const qualityInfo = QUALITY_ICONS[netStats?.quality || 'unknown']

              return (
                <div key={oderId} className="performer-item active">
                  <div className="performer-avatar">
                    <div className="avatar-circle">
                      <span>{instInfo?.icon || '🎵'}</span>
                    </div>
                    <span className="live-indicator" />
                  </div>
                  <div className="performer-info">
                    <span className="performer-name">{peerInfo?.nickname || `연주자 ${oderId.slice(0, 4)}`}</span>
                    <span className="performer-instrument">{instInfo?.name || '연주 중'}</span>
                  </div>
                  {/* 네트워크 상태 표시 */}
                  <div className="performer-latency" title={`레이턴시: ${netStats?.latency ?? '?'}ms | 지터: ${netStats?.jitter ?? '?'}ms | 품질: ${qualityInfo.label}`}>
                    <span className="latency-value" style={{ color: qualityInfo.color }}>
                      {netStats?.latency != null ? `${netStats.latency}ms` : '--'}
                    </span>
                    <span className="quality-indicator">{qualityInfo.icon}</span>
                  </div>
                  <audio
                    autoPlay
                    playsInline
                    ref={(node) => {
                      if (node && stream) {
                        node.srcObject = stream
                        // 브라우저 자동 재생 정책 우회
                        node.play().catch(err => {
                          console.log('Audio play failed:', err)
                        })
                      }
                    }}
                  />
                </div>
              )
            })}

            {performerCount === 0 && (
              <div className="no-performers">
                <p>아직 연주자가 없습니다</p>
                <small>첫 번째 연주자가 되어보세요!</small>
              </div>
            )}
          </div>

          {/* 참여/관람 전환 버튼 */}
          <div className="participation-toggle">
            {isPerformer ? (
              <button onClick={handleBecomeViewer} className="toggle-btn viewer">
                👀 관람자로 전환
              </button>
            ) : (
              <button
                onClick={handleBecomePerformer}
                className="toggle-btn performer"
                disabled={pendingRequest}
              >
                {pendingRequest ? '승인 대기 중...' : '🎤 연주 참여하기'}
              </button>
            )}
            {!room.free_join && !isHost && !isPerformer && (
              <p className="approval-notice">이 방은 방장 승인이 필요합니다</p>
            )}
          </div>
        </aside>

        {/* 가운데: 믹서 */}
        <main className="mixer-panel">
          <div className="panel-header">
            <h2>🎚️ 개인 믹서</h2>
            <span className="mixer-hint">내가 듣는 소리 조절</span>
          </div>

          <div className="mixer-content">
            {/* 마스터 볼륨 */}
            <div className="mixer-master">
              <label>마스터 볼륨</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              />
              <span className="volume-value">{Math.round(masterVolume * 100)}%</span>
            </div>

            {/* 각 연주자별 믹서 */}
            <div className="mixer-channels">
              {/* 내 오디오 */}
              {isPerformer && localStream && myInstrument && (
                <div className="mixer-channel me">
                  <div className="channel-header">
                    <span className="channel-icon">{INSTRUMENT_INFO[myInstrument]?.icon || '🎵'}</span>
                    <span className="channel-name">나 (모니터)</span>
                  </div>
                  <div className="channel-info">
                    <span className="device-info">{currentInputDevice}</span>
                    {actualStreamSettings && (
                      <span className="audio-info">
                        {actualStreamSettings.sampleRate ? `${actualStreamSettings.sampleRate / 1000}kHz` : ''}
                        {actualStreamSettings.channelCount === 1 ? ' 모노' : ' 스테레오'}
                      </span>
                    )}
                  </div>
                  {rtcError && <div className="channel-error">{rtcError}</div>}
                </div>
              )}

              {/* 다른 연주자들 */}
              {remoteAudioEntries.map(([oderId]) => {
                const mix = mixSettingsMap[oderId] || { volume: 1, pan: 0, muted: false }
                const peerInfo = peerInstruments[oderId]
                const instInfo = peerInfo ? INSTRUMENT_INFO[peerInfo.instrument] : null
                const netStats = peerNetworkStats[oderId]
                const qualityInfo = QUALITY_ICONS[netStats?.quality || 'unknown']

                return (
                  <div key={oderId} className={`mixer-channel ${mix.muted ? 'muted' : ''}`}>
                    <div className="channel-header">
                      <span className="channel-icon">{instInfo?.icon || '🎵'}</span>
                      <span className="channel-name">{peerInfo?.nickname || `연주자 ${oderId.slice(0, 4)}`}</span>
                      <button
                        className={`mute-btn ${mix.muted ? 'active' : ''}`}
                        onClick={() => setMixMuted(oderId, !mix.muted)}
                      >
                        {mix.muted ? '🔇' : '🔊'}
                      </button>
                    </div>
                    {/* 네트워크 상태 표시 */}
                    <div className="channel-latency">
                      <span className="quality-dot" style={{ background: qualityInfo.color }}></span>
                      <span className="latency-text">
                        {netStats?.latency != null ? `${netStats.latency}ms` : '측정 중'}
                        {netStats?.jitter != null && <small> (지터: {netStats.jitter}ms)</small>}
                      </span>
                    </div>
                    <div className="channel-controls">
                      <div className="control-row">
                        <label>볼륨</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={mix.volume}
                          onChange={(e) => setMixVolume(oderId, parseFloat(e.target.value))}
                          disabled={mix.muted}
                        />
                        <span>{Math.round(mix.volume * 100)}%</span>
                      </div>
                      <div className="control-row">
                        <label>패닝</label>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.01"
                          value={mix.pan}
                          onChange={(e) => setMixPan(oderId, parseFloat(e.target.value))}
                          disabled={mix.muted}
                        />
                        <span>{mix.pan < 0 ? `L${Math.round(Math.abs(mix.pan) * 100)}` : mix.pan > 0 ? `R${Math.round(mix.pan * 100)}` : 'C'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {remoteAudioEntries.length === 0 && !localStream && (
                <div className="mixer-empty">
                  <p>연주자가 없습니다</p>
                  <small>연주자가 참여하면 여기서 볼륨을 조절할 수 있습니다</small>
                </div>
              )}
            </div>
          </div>

          {/* 관람자 안내 */}
          {!isPerformer && (
            <div className="viewer-guide">
              <p>👀 관람 모드</p>
              <small>연주에 참여하려면 왼쪽에서 "연주 참여하기"를 클릭하세요</small>
            </div>
          )}
        </main>

        {/* 오른쪽: 채팅 */}
        <aside className="chat-panel">
          <div className="panel-header">
            <h2>💬 채팅</h2>
            <div className="nickname-area">
              {editingNickname ? (
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onBlur={() => setEditingNickname(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingNickname(false)}
                  autoFocus
                  className="nickname-input"
                />
              ) : (
                <button onClick={() => setEditingNickname(true)} className="nickname-btn">
                  {nickname} ✏️
                </button>
              )}
            </div>
          </div>

          <div className="chat-messages" ref={chatContainerRef}>
            {chatMessages.length === 0 ? (
              <div className="chat-empty">
                <p>채팅을 시작해보세요!</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.peerId === clientId || msg.peerId === 'me' ? 'me' : ''}`}
                >
                  <span className="chat-nickname">{msg.nickname}</span>
                  <span className="chat-text">{msg.message}</span>
                </div>
              ))
            )}
          </div>

          <form className="chat-input-area" onSubmit={handleSendChat}>
            <input
              type="text"
              placeholder="메시지 입력..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="chat-input"
            />
            <button type="submit" className="chat-send-btn">전송</button>
          </form>
        </aside>
      </div>
    </div>
  )
}
