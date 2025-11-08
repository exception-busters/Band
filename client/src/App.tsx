import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type RoomStatus = 'open' | 'recording' | 'locked'

type Room = {
  id: string
  title: string
  genre: string
  vibe: string
  bpm: number
  capacity: number
  musicians: number
  latencyMs: number
  region: string
  status: RoomStatus
}

type MixTrack = {
  id: string
  name: string
  role: string
  color: string
  volume: number
  pan: number
  fx: number
}

type CommunityPost = {
  id: string
  author: string
  role: string
  message: string
  tag: string
  timestamp: string
}

type FeaturePillar = {
  title: string
  description: string
  details: string
  badge: string
}

const FEATURE_PILLARS: FeaturePillar[] = [
  {
    title: '초저지연 합주',
    description: '다중 엣지 시그널링 + UDP 가속으로 20ms 이하 지연을 유지합니다.',
    details: '서울 · 도쿄 · LA 리전에 동시 배포된 네트워크 스택',
    badge: 'Live Rooms',
  },
  {
    title: '개인 레코딩 스튜디오',
    description: '브라우저에서 바로 아이디어를 캡처하고 스템을 정리하세요.',
    details: 'Web Audio 기반 멀티트랙, WAV/MP3 내보내기 로드맵',
    badge: 'Creator',
  },
  {
    title: '커뮤니티 피드',
    description: '합주 파트너를 찾고 프로젝트를 공유하며 루프를 교환합니다.',
    details: '멤버십 · 오픈 세션 · 비공개 팀 기능',
    badge: 'Community',
  },
  {
    title: '믹스 랩',
    description: '레벨/팬/FX를 조정해 실시간으로 믹스를 스케치하세요.',
    details: 'AI 기반 밸런스 제안과 매치드 리퍼런스 계획',
    badge: 'Mix Lab',
  },
]

const INITIAL_ROOMS: Room[] = [
  {
    id: 'neo-groove',
    title: 'Neo Groove Club',
    genre: 'Neo Soul',
    vibe: '따뜻한 전자피아노와 퍼커션이 어우러진 서울 저녁세션',
    bpm: 92,
    capacity: 6,
    musicians: 4,
    latencyMs: 18,
    region: 'Seoul',
    status: 'open',
  },
  {
    id: 'sunset-funk',
    title: 'Sunset Funk Bus',
    genre: 'City Funk',
    vibe: '도쿄 프루티 라운지, 베이스와 일렉트릭 키 중심',
    bpm: 108,
    capacity: 5,
    musicians: 3,
    latencyMs: 24,
    region: 'Tokyo',
    status: 'recording',
  },
  {
    id: 'nautica',
    title: 'Nautica Lab',
    genre: 'Ambient',
    vibe: '로스앤젤레스 레트로 신스페이즈',
    bpm: 76,
    capacity: 4,
    musicians: 2,
    latencyMs: 32,
    region: 'LA',
    status: 'open',
  },
  {
    id: 'midnight-brass',
    title: 'Midnight Brass Room',
    genre: 'Fusion',
    vibe: '서울-부산 리모트 브라스 섹션 전용',
    bpm: 122,
    capacity: 8,
    musicians: 6,
    latencyMs: 21,
    region: 'Busan',
    status: 'locked',
  },
]

const INITIAL_TRACKS: MixTrack[] = [
  { id: 'trk1', name: 'Guitar Glide', role: 'Rhythm', color: '#f37381', volume: 68, pan: -18, fx: 22 },
  { id: 'trk2', name: 'Velvet Keys', role: 'Harmony', color: '#7f7bff', volume: 72, pan: 8, fx: 35 },
  { id: 'trk3', name: 'Pocket Drums', role: 'Backbeat', color: '#4ddfb7', volume: 64, pan: 12, fx: 12 },
  { id: 'trk4', name: 'Sub Air', role: 'Bass', color: '#f6d365', volume: 58, pan: -6, fx: 18 },
]

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

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'ws://localhost:8080'

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

export default function App() {
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS)
  const [selectedRoomId, setSelectedRoomId] = useState<string>(INITIAL_ROOMS[0]?.id ?? '')
  const [tracks, setTracks] = useState<MixTrack[]>(INITIAL_TRACKS)
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_POSTS)
  const [newPost, setNewPost] = useState('')
  const [newTag, setNewTag] = useState('세션')
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle')
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [inputLevel, setInputLevel] = useState(12)
  const [signalStatus, setSignalStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [clientId, setClientId] = useState<string | null>(null)
  const [peers, setPeers] = useState<string[]>([])
  const [roomCode, setRoomCode] = useState<string>(INITIAL_ROOMS[0]?.id ?? 'room-a')
  const [joinFeedback, setJoinFeedback] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

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

  useEffect(() => {
    const meter = setInterval(() => {
      setInputLevel((prev) => {
        const swing = Math.max(4, Math.min(90, prev + (Math.random() - 0.5) * 25))
        return Math.round(swing)
      })
    }, 400)
    return () => clearInterval(meter)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return
    }

    try {
      setSignalStatus('connecting')
      const ws = new WebSocket(SIGNALING_URL)
      wsRef.current = ws

      ws.onopen = () => setSignalStatus('connected')
      ws.onerror = () => setSignalStatus('error')
      ws.onclose = () => {
        setSignalStatus('idle')
        setClientId(null)
        setPeers([])
      }
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'welcome') {
            setClientId(payload.clientId)
          }
          if (payload.type === 'peers') {
            const peerList: string[] = Array.isArray(payload.peerIds) ? payload.peerIds : []
            setPeers(peerList)
            setJoinFeedback(`룸 입장 완료 · 동시 연결 ${peerList.length + 1}명`)
          }
          if (payload.type === 'peer-joined') {
            setPeers((prev) => (prev.includes(payload.peerId) ? prev : [...prev, payload.peerId]))
          }
          if (payload.type === 'peer-left') {
            setPeers((prev) => prev.filter((id) => id !== payload.peerId))
          }
        } catch {
          // ignore malformed payloads
        }
      }

      return () => ws.close()
    } catch (error) {
      setSignalStatus('error')
    }
  }, [])

  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    }
  }, [recordingUrl])

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0]

  const waveform = useMemo(() => Array.from({ length: 48 }, (_, idx) => 12 + (idx % 4) * 8 + Math.random() * 45), [])

  const mixInsights = useMemo(() => {
    const avgVolume = tracks.reduce((sum, track) => sum + track.volume, 0) / tracks.length
    const spread = tracks.reduce((sum, track) => sum + Math.abs(track.pan), 0) / tracks.length
    const fx = tracks.reduce((sum, track) => sum + track.fx, 0) / tracks.length
    const quality = Math.round((avgVolume * 0.5 + (50 - Math.abs(25 - spread)) * 0.8 + fx * 0.3) / 2)
    return { avgVolume: Math.round(avgVolume), spread: Math.round(spread), fx: Math.round(fx), quality }
  }, [tracks])

  const handleTrackChange = (id: string, key: 'volume' | 'pan' | 'fx', value: number) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, [key]: value } : track)))
  }

  const createPost = () => {
    if (!newPost.trim()) return
    const randomId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    const post: CommunityPost = {
      id: randomId,
      author: 'You',
      role: 'Session Member',
      message: newPost.trim(),
      tag: newTag,
      timestamp: new Date().toISOString(),
    }
    setPosts((prev) => [post, ...prev])
    setNewPost('')
  }

  const startRecording = async () => {
    if (recordingState === 'recording') return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setRecordingError('이 브라우저는 오디오 녹음을 지원하지 않습니다.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setRecordingError('MediaRecorder API를 사용할 수 없습니다.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setRecordingUrl(url)
        setRecordingState('preview')
      }
      recorder.start()
      setRecordingError(null)
      setRecordingState('recording')
    } catch (error) {
      setRecordingError('마이크 권한이 필요합니다.')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const resetRecording = () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    setRecordingUrl(null)
    setRecordingState('idle')
  }

  const joinRoom = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setJoinFeedback('시그널링 서버 연결을 확인하세요.')
      return
    }
    wsRef.current.send(JSON.stringify({ type: 'join', roomId: roomCode }))
    setSelectedRoomId(roomCode)
    setJoinFeedback('룸 입장 시도 중...')
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">SYNCROOM INSPIRED · WEB DEMO</p>
        <h1>
          Yamaha Syncroom을 재해석한
          <br />
          초저지연 온라인 합주실
        </h1>
        <p className="lead">
          BandSpace는 웹을 시작으로 데스크톱 · 모바일까지 확장되는 통합 합주 플랫폼입니다. 개인 녹음부터 커뮤니티, 믹싱 실험까지
          하나의 타임라인에서 이어집니다.
        </p>
        <div className="hero-actions">
          <a href="#rooms" className="primary-cta">
            합주실 열기
          </a>
          <a href="#roadmap" className="ghost-cta">
            제품 로드맵
          </a>
        </div>
        <div className="hero-stats">
          <div>
            <strong>18 ms</strong>
            <span>평균 왕복 지연</span>
          </div>
          <div>
            <strong>3 지역</strong>
            <span>KR · JP · US 엣지</span>
          </div>
          <div>
            <strong>256 kbps</strong>
            <span>양방향 오디오</span>
          </div>
        </div>
      </header>

      <main>
        <section className="panel feature-grid" aria-label="핵심 기능">
          {FEATURE_PILLARS.map((feature) => (
            <article key={feature.title} className="feature-card">
              <span className="pill">{feature.badge}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <small>{feature.details}</small>
            </article>
          ))}
        </section>

        <section id="rooms" className="panel room-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Realtime Room</p>
              <h2>합주실 상태 · 시그널링 연결</h2>
            </div>
            <span className="status-hint">WebSocket URL · {SIGNALING_URL}</span>
          </div>
          <div className="room-layout">
            <div className="room-list">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  className={`room-card ${selectedRoomId === room.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedRoomId(room.id)}
                >
                  <div className="room-card-head">
                    <div>
                      <span className="room-title">{room.title}</span>
                      <span className="room-genre">{room.genre}</span>
                    </div>
                    <span className={`status-pill ${room.status}`}>{room.status}</span>
                  </div>
                  <p className="room-vibe">{room.vibe}</p>
                  <div className="room-meta">
                    <span>{room.bpm} bpm</span>
                    <span>
                      {room.musicians}/{room.capacity} 명
                    </span>
                    <span>{room.latencyMs} ms · {room.region}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="room-detail">
              <h3>{selectedRoom?.title}</h3>
              <p className="room-detail-vibe">{selectedRoom?.vibe}</p>
              <ul>
                <li>권장 BPM · <strong>{selectedRoom?.bpm}</strong></li>
                <li>현재 세션 인원 · <strong>{selectedRoom?.musicians} / {selectedRoom?.capacity}</strong></li>
                <li>측정 지연 · <strong>{selectedRoom?.latencyMs} ms</strong></li>
              </ul>

              <div className="signal-card">
                <div className="connection-status">
                  <span className={`signal-dot ${signalStatus}`} />
                  <div>
                    <p>{signalStatus === 'connected' ? '시그널링 서버 연결됨' : signalStatus === 'connecting' ? '연결 중...' : signalStatus === 'error' ? '연결 실패' : '대기 중'}</p>
                    <small>{clientId ? `클라이언트 ID · ${clientId}` : '웹소켓 연결이 필요합니다.'}</small>
                  </div>
                </div>
                <div className="peer-pill-group">
                  {peers.length === 0 && <span className="peer-pill">대기 중</span>}
                  {peers.map((peer) => (
                    <span key={peer} className="peer-pill">
                      peer · {peer.slice(0, 6)}
                    </span>
                  ))}
                </div>

                <label className="join-label">
                  룸 코드
                  <div className="join-form">
                    <input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} />
                    <button type="button" onClick={joinRoom} disabled={selectedRoom?.status === 'locked'}>
                      합주실 입장
                    </button>
                  </div>
                </label>
                <p className="join-feedback">{selectedRoom?.status === 'locked' ? '락된 룸입니다. 초대가 필요합니다.' : joinFeedback || '열린 룸에 입장해 연결을 확인하세요.'}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="record" className="panel recording-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Personal Recorder</p>
              <h2>브라우저에서 곧바로 스케치 녹음</h2>
            </div>
            <span className="status-hint">{recordingState === 'recording' ? 'REC · 실시간 입력 중' : '대기'}</span>
          </div>
          <div className="recording-panel">
            <div className="recording-controls">
              <div className="recording-actions">
                <button type="button" onClick={startRecording} disabled={recordingState === 'recording'}>
                  녹음 시작
                </button>
                <button type="button" onClick={stopRecording} disabled={recordingState !== 'recording'}>
                  정지
                </button>
                <button type="button" onClick={resetRecording} disabled={!recordingUrl}>
                  다시 녹음
                </button>
              </div>
              {recordingError && <p className="error-text">{recordingError}</p>}
              <div className="level-meter">
                <div className="level-fill" style={{ width: `${inputLevel}%` }} />
                <span>{inputLevel} dBFS</span>
              </div>
              <div className="waveform">
                {waveform.map((height, index) => (
                  <span key={index} style={{ height: `${height}px` }} />
                ))}
              </div>
              {recordingUrl && (
                <div className="preview-card">
                  <audio controls src={recordingUrl} />
                  <a download="bandspace-sketch.webm" href={recordingUrl}>
                    오디오 저장
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel mixlab-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Mix Lab</p>
              <h2>실시간 믹스 실험실</h2>
            </div>
            <div className="mix-insight">
              <span>Balance Score · {mixInsights.quality}</span>
              <span>Avg Vol {mixInsights.avgVolume}% · Spread {mixInsights.spread}% · FX {mixInsights.fx}%</span>
            </div>
          </div>
          <div className="mixlab-grid">
            {tracks.map((track) => (
              <article key={track.id} className="mix-card">
                <div className="mix-card-head">
                  <span className="mix-dot" style={{ backgroundColor: track.color }} />
                  <div>
                    <p>{track.name}</p>
                    <small>{track.role}</small>
                  </div>
                  <span className="mix-value">{track.volume}%</span>
                </div>
                <label>
                  볼륨
                  <input type="range" min={0} max={100} value={track.volume} onChange={(event) => handleTrackChange(track.id, 'volume', Number(event.target.value))} />
                </label>
                <label>
                  팬 (-L / +R)
                  <input type="range" min={-50} max={50} value={track.pan} onChange={(event) => handleTrackChange(track.id, 'pan', Number(event.target.value))} />
                </label>
                <label>
                  FX Send
                  <input type="range" min={0} max={100} value={track.fx} onChange={(event) => handleTrackChange(track.id, 'fx', Number(event.target.value))} />
                </label>
              </article>
            ))}
          </div>
        </section>

        <section className="panel community-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Community</p>
              <h2>세션 파트너와 아이디어 공유</h2>
            </div>
          </div>
          <div className="community-layout">
            <div className="community-feed">
              {posts.map((post) => (
                <article key={post.id} className="post-card">
                  <header>
                    <div>
                      <strong>{post.author}</strong>
                      <span>{post.role}</span>
                    </div>
                    <span className="tag">{post.tag}</span>
                  </header>
                  <p>{post.message}</p>
                  <footer>{formatRelativeTime(post.timestamp)}</footer>
                </article>
              ))}
            </div>
            <div className="community-form">
              <h3>새로운 업데이트</h3>
              <textarea
                value={newPost}
                placeholder="세션 계획, 믹스 노트, 협업 요청 등을 남겨보세요."
                onChange={(event) => setNewPost(event.target.value)}
              />
              <div className="form-row">
                <select value={newTag} onChange={(event) => setNewTag(event.target.value)}>
                  <option value="세션">세션</option>
                  <option value="콜라보">콜라보</option>
                  <option value="베타">베타</option>
                  <option value="피드백">피드백</option>
                </select>
                <button type="button" onClick={createPost}>
                  게시
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="roadmap" className="panel roadmap-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Roadmap</p>
              <h2>웹 → 데스크톱 → 모바일까지 확장</h2>
            </div>
          </div>
          <div className="roadmap-grid">
            <article className="roadmap-card">
              <h3>Web Beta</h3>
              <p>합주실 · 개인 녹음 · 커뮤니티 피드를 하나의 앱으로 통합합니다.</p>
              <ul>
                <li>WebRTC 기반 저지연 오디오</li>
                <li>세션 프리셋 / 샘플 공유</li>
                <li>믹스 랩 & 루프 스토리지</li>
              </ul>
            </article>
            <article className="roadmap-card">
              <h3>Desktop Studio</h3>
              <p>Electron + 네이티브 오디오 드라이버 연동으로 96kHz까지 확장.</p>
              <ul>
                <li>ASIO / Core Audio Bridge</li>
                <li>오프라인 프로젝트 · 로컬 캐시</li>
                <li>멀티 모니터 믹스 콘솔</li>
              </ul>
            </article>
            <article className="roadmap-card">
              <h3>Mobile Companion</h3>
              <p>외부 인터페이스 없이도 아이디어 캡처 및 커뮤니티 업데이트 지원.</p>
              <ul>
                <li>iOS / Android 네이티브 모듈</li>
                <li>Low-power Monitoring</li>
                <li>세션 알림 · DM</li>
              </ul>
            </article>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>BandSpace · Syncroom-inspired 데모. 데스크톱 / 모바일 확장을 준비 중입니다.</p>
        <small>Signaling URL: {SIGNALING_URL}</small>
      </footer>
    </div>
  )
}
