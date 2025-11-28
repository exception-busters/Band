import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAudioSettings, ActualAudioSettings } from './AudioSettingsContext'

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'ws://localhost:8080'
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

type RtcStatus = 'idle' | 'connecting' | 'live' | 'error'
type SignalStatus = 'idle' | 'connecting' | 'connected' | 'error'

// 개인 믹서 설정
export interface MixSettings {
  volume: number  // 0 ~ 1
  pan: number     // -1 (좌) ~ 1 (우)
  muted: boolean
}

// 채팅 메시지
export interface ChatMessage {
  id: string
  peerId: string
  nickname: string
  message: string
  timestamp: number
}

// 연주자 악기 정보
export interface PeerInstrument {
  peerId: string
  instrument: string
  nickname: string
}

// 피어 네트워크 상태
export interface PeerNetworkStats {
  latency: number | null      // RTT in ms
  jitter: number | null       // 지터 in ms
  packetsLost: number         // 패킷 손실 수
  packetLossRate: number      // 패킷 손실률 (%)
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
}

// 네트워크 품질 판정 함수
function getNetworkQuality(latency: number | null, packetLossRate: number): PeerNetworkStats['quality'] {
  if (latency === null) return 'unknown'
  if (latency < 30 && packetLossRate < 1) return 'excellent'
  if (latency < 60 && packetLossRate < 3) return 'good'
  if (latency < 100 && packetLossRate < 5) return 'fair'
  return 'poor'
}

type RoomContextType = {
  // WebSocket
  signalStatus: SignalStatus
  clientId: string | null
  peers: string[]
  joinRoom: (roomId: string) => void
  joinFeedback: string

  // WebRTC
  rtcStatus: RtcStatus
  rtcError: string | null
  localStream: MediaStream | null
  remoteAudioMap: Record<string, MediaStream>
  startLocalMic: () => Promise<void>
  stopLocalMic: () => void
  currentRoomId: string | null
  leaveRoom: () => void

  // 실제 적용된 오디오 설정
  actualStreamSettings: ActualAudioSettings | null

  // 개인 믹서
  mixSettingsMap: Record<string, MixSettings>
  setMixVolume: (oderId: string, volume: number) => void
  setMixPan: (oderId: string, pan: number) => void
  setMixMuted: (oderId: string, muted: boolean) => void
  masterVolume: number
  setMasterVolume: (volume: number) => void

  // 채팅
  chatMessages: ChatMessage[]
  sendChatMessage: (message: string) => void
  nickname: string
  setNickname: (name: string) => void

  // 연주자 악기 정보
  peerInstruments: Record<string, PeerInstrument>
  myInstrument: string | null
  setMyInstrument: (instrument: string) => void

  // 네트워크 상태
  peerNetworkStats: Record<string, PeerNetworkStats>
}

const RoomContext = createContext<RoomContextType | null>(null)

export function RoomProvider({ children }: { children: ReactNode }) {
  // 오디오 설정 가져오기
  const { settings: audioSettings } = useAudioSettings()

  const [signalStatus, setSignalStatus] = useState<SignalStatus>('idle')
  const [clientId, setClientId] = useState<string | null>(null)
  const [peers, setPeers] = useState<string[]>([])
  const [joinFeedback, setJoinFeedback] = useState('')
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)

  const [rtcStatus, setRtcStatus] = useState<RtcStatus>('idle')
  const [rtcError, setRtcError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteAudioMap, setRemoteAudioMap] = useState<Record<string, MediaStream>>({})
  const [actualStreamSettings, setActualStreamSettings] = useState<ActualAudioSettings | null>(null)

  // 개인 믹서 상태
  const [mixSettingsMap, setMixSettingsMap] = useState<Record<string, MixSettings>>({})
  const [masterVolume, setMasterVolume] = useState(1)
  const audioNodesRef = useRef<Map<string, { gain: GainNode; panner: StereoPannerNode; context: AudioContext }>>(new Map())

  // 채팅 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [nickname, setNickname] = useState(() => {
    return localStorage.getItem('bandspace_nickname') || `User${Math.random().toString(36).slice(2, 6)}`
  })

  // 연주자 악기 정보 상태
  const [peerInstruments, setPeerInstruments] = useState<Record<string, PeerInstrument>>({})
  const [myInstrument, setMyInstrumentState] = useState<string | null>(null)

  // 네트워크 상태
  const [peerNetworkStats, setPeerNetworkStats] = useState<Record<string, PeerNetworkStats>>({})

  const wsRef = useRef<WebSocket | null>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())

  // 최신 상태 참조용 ref (useEffect 클로저 내부에서 사용)
  const myInstrumentRef = useRef<string | null>(null)
  const nicknameRef = useRef<string>(nickname)
  const localStreamRef = useRef<MediaStream | null>(null)
  const clientIdRef = useRef<string | null>(null)

  const sendSignalMessage = (payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    }
  }

  const attachLocalTracks = (pc: RTCPeerConnection, stream?: MediaStream | null) => {
    // ref를 사용하여 항상 최신 localStream 사용
    const streamToUse = stream !== undefined ? stream : localStreamRef.current
    if (!streamToUse) {
      console.log('[RTC] attachLocalTracks: No stream available!')
      return
    }
    console.log('[RTC] attachLocalTracks: Adding', streamToUse.getTracks().length, 'tracks')
    streamToUse.getTracks().forEach((track) => {
      const already = pc.getSenders().some((sender) => sender.track === track)
      if (!already) {
        pc.addTrack(track, streamToUse)
        console.log('[RTC] Track added:', track.kind)
      }
    })
  }

  const closePeerConnection = (peerId: string) => {
    const pc = peerConnections.current.get(peerId)
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
      peerConnections.current.delete(peerId)
    }
    setRemoteAudioMap((prev) => {
      if (!(peerId in prev)) return prev
      const next = { ...prev }
      delete next[peerId]
      return next
    })
  }

  const createPeerConnection = (peerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[RTC] ICE candidate generated for:', peerId.slice(0, 8))
        sendSignalMessage({ type: 'ice-candidate', to: peerId, candidate: event.candidate })
      } else {
        console.log('[RTC] ICE gathering complete for:', peerId.slice(0, 8))
      }
    }
    pc.ontrack = (event) => {
      console.log('[RTC] ontrack received from:', peerId.slice(0, 8), 'track:', event.track.kind)
      const stream = event.streams[0] ?? new MediaStream([event.track])
      setRemoteAudioMap((prev) => ({ ...prev, [peerId]: stream }))
    }
    pc.onconnectionstatechange = () => {
      console.log(`[RTC] Connection state changed: ${pc.connectionState} (peer: ${peerId.slice(0, 8)})`)
      if (pc.connectionState === 'connected') {
        console.log('[RTC] Setting rtcStatus to LIVE!')
        setRtcStatus('live')
      } else if (pc.connectionState === 'failed') {
        setRtcStatus('error')
        closePeerConnection(peerId)
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        closePeerConnection(peerId)
      }
    }
    pc.oniceconnectionstatechange = () => {
      console.log(`[RTC] ICE state changed: ${pc.iceConnectionState} (peer: ${peerId.slice(0, 8)})`)
    }
    attachLocalTracks(pc)
    peerConnections.current.set(peerId, pc)
    return pc
  }

  const ensurePeerConnection = (peerId: string) =>
    peerConnections.current.get(peerId) ?? createPeerConnection(peerId)

  const teardownPeerConnections = () => {
    peerConnections.current.forEach((_, peerId) => closePeerConnection(peerId))
    setRemoteAudioMap({})
    if (!localStream) {
      setRtcStatus('idle')
    }
  }

  const createOfferForPeer = async (peerId: string) => {
    console.log('[RTC] createOfferForPeer called for:', peerId.slice(0, 8))
    try {
      const pc = ensurePeerConnection(peerId)
      // 이미 connected 상태면 connecting으로 바꾸지 않음
      if (pc.connectionState !== 'connected') {
        setRtcStatus('connecting')
      }
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      console.log('[RTC] Offer created and sent to:', peerId.slice(0, 8))
      sendSignalMessage({ type: 'offer', to: peerId, offer })
    } catch (error) {
      console.error('[RTC] createOfferForPeer error:', error)
      setRtcStatus('error')
      setRtcError('WebRTC offer 생성에 실패했습니다.')
    }
  }

  const handleRemoteOffer = async (peerId: string, offer: RTCSessionDescriptionInit) => {
    console.log('[RTC] handleRemoteOffer from:', peerId.slice(0, 8))
    try {
      const pc = ensurePeerConnection(peerId)

      // Glare 처리: 양쪽에서 동시에 offer를 보낸 경우
      if (pc.signalingState === 'have-local-offer') {
        // clientId가 더 큰 쪽이 자신의 offer를 유지 (polite peer 패턴)
        const myId = clientIdRef.current
        if (myId && myId > peerId) {
          console.log('[RTC] Glare detected: ignoring incoming offer (we have priority)')
          return
        }
        // 상대방이 우선순위가 높으면 내 offer를 롤백
        console.log('[RTC] Glare detected: rolling back local offer')
        await pc.setLocalDescription({ type: 'rollback' })
      }

      await pc.setRemoteDescription(offer)
      attachLocalTracks(pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      console.log('[RTC] Answer created and sent to:', peerId.slice(0, 8))
      sendSignalMessage({ type: 'answer', to: peerId, answer })
      // 이미 connected 상태면 connecting으로 바꾸지 않음
      if (pc.connectionState !== 'connected') {
        setRtcStatus('connecting')
      }
    } catch (error) {
      console.error('[RTC] handleRemoteOffer error:', error)
      setRtcStatus('error')
      setRtcError('원격 offer 처리 중 오류가 발생했습니다.')
    }
  }

  const handleRemoteAnswer = async (peerId: string, answer: RTCSessionDescriptionInit) => {
    console.log('[RTC] handleRemoteAnswer from:', peerId.slice(0, 8))
    const pc = peerConnections.current.get(peerId)
    if (!pc) return
    // stable 상태에서는 answer를 무시 (이미 연결 완료됨)
    if (pc.signalingState === 'stable') {
      console.log('[RTC] Ignoring answer - already in stable state')
      return
    }
    try {
      await pc.setRemoteDescription(answer)
      console.log('[RTC] Remote answer set, connectionState:', pc.connectionState)
    } catch (error) {
      console.error('[RTC] handleRemoteAnswer error:', error)
      setRtcStatus('error')
    }
  }

  const handleRemoteCandidate = async (peerId: string, candidate: RTCIceCandidateInit) => {
    console.log('[RTC] Received ICE candidate from:', peerId.slice(0, 8))
    const pc = peerConnections.current.get(peerId)
    if (!pc) {
      console.log('[RTC] No peer connection for:', peerId.slice(0, 8))
      return
    }
    try {
      await pc.addIceCandidate(candidate)
      console.log('[RTC] ICE candidate added, iceConnectionState:', pc.iceConnectionState)
    } catch (error) {
      console.error('[RTC] Failed to add ICE candidate:', error)
      setRtcStatus('error')
    }
  }

  const startLocalMic = async () => {
    if (localStream) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setRtcError('이 브라우저는 오디오 공유를 지원하지 않습니다.')
      setRtcStatus('error')
      return
    }
    try {
      // 오디오 설정에서 선택한 장치와 설정 사용
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: audioSettings.inputDeviceId ? { exact: audioSettings.inputDeviceId } : undefined,
          sampleRate: audioSettings.sampleRate,
          channelCount: audioSettings.channelCount,
          echoCancellation: audioSettings.echoCancellation,
          noiseSuppression: audioSettings.noiseSuppression,
          autoGainControl: audioSettings.autoGainControl,
        },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setLocalStream(stream)

      // 실제 적용된 설정 가져오기
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        // MediaTrackSettings 타입에 latency가 표준에는 없지만 일부 브라우저에서 지원
        const trackSettings = audioTrack.getSettings() as MediaTrackSettings & { latency?: number }
        setActualStreamSettings({
          deviceId: trackSettings.deviceId ?? null,
          sampleRate: trackSettings.sampleRate ?? null,
          channelCount: trackSettings.channelCount ?? null,
          echoCancellation: trackSettings.echoCancellation ?? null,
          noiseSuppression: trackSettings.noiseSuppression ?? null,
          autoGainControl: trackSettings.autoGainControl ?? null,
          latency: trackSettings.latency ?? null,
        })
      }

      setRtcError(null)

      // 기존 peer connection에 트랙 추가하고 renegotiation
      if (peerConnections.current.size > 0) {
        console.log('[RTC] Adding tracks to existing peer connections')
        let hasConnectedPeer = false
        for (const [peerId, pc] of peerConnections.current.entries()) {
          attachLocalTracks(pc, stream)
          // 이미 연결된 피어가 있는지 확인
          if (pc.connectionState === 'connected') {
            hasConnectedPeer = true
          }
          // offer 다시 생성해서 보내기
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            sendSignalMessage({ type: 'offer', to: peerId, offer })
            console.log('[RTC] Renegotiation offer sent to:', peerId.slice(0, 8))
          } catch (err) {
            console.error('[RTC] Renegotiation failed:', err)
          }
        }
        // 이미 연결된 피어가 있으면 live 유지
        setRtcStatus(hasConnectedPeer ? 'live' : 'connecting')
      } else {
        setRtcStatus('live')
      }
    } catch (err) {
      console.error('마이크 접근 실패:', err)
      setRtcError('마이크 권한이 필요합니다. 오디오 설정에서 장치를 확인해주세요.')
      setRtcStatus('error')
    }
  }

  const stopLocalMic = (notifyPeers = true) => {
    if (!localStream) return
    localStream.getTracks().forEach((track) => track.stop())
    peerConnections.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.replaceTrack(null).catch(() => {})
        }
      })
    })
    setLocalStream(null)
    setActualStreamSettings(null)
    if (peerConnections.current.size === 0) {
      setRtcStatus('idle')
    }

    // 내 악기 정보 초기화
    setMyInstrumentState(null)
    myInstrumentRef.current = null

    // 내 악기 정보를 peerInstruments에서 제거
    const myId = clientIdRef.current
    if (myId) {
      setPeerInstruments(prev => {
        const next = { ...prev }
        delete next[myId]
        return next
      })
    }

    // 다른 피어들에게 연주 중단 알림
    if (notifyPeers) {
      sendSignalMessage({ type: 'stop-performing' })
    }
  }

  const joinRoom = (roomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setJoinFeedback('시그널링 서버 연결을 확인하세요.')
      return
    }
    wsRef.current.send(JSON.stringify({ type: 'join', roomId, nickname }))
    setCurrentRoomId(roomId)
    setJoinFeedback('룸 입장 시도 중...')
  }

  const leaveRoom = () => {
    // 서버에 나가기 알림
    sendSignalMessage({ type: 'leave' })
    teardownPeerConnections()
    stopLocalMic(false) // 이미 leave로 알렸으므로 중복 알림 방지
    setPeers([])
    setCurrentRoomId(null)
    setJoinFeedback('')
    setChatMessages([])
    // 믹서 노드 정리
    audioNodesRef.current.forEach(({ context }) => context.close())
    audioNodesRef.current.clear()
    setMixSettingsMap({})
    // 악기 정보 초기화
    setPeerInstruments({})
    setMyInstrumentState(null)
    myInstrumentRef.current = null
    // 네트워크 상태 초기화
    setPeerNetworkStats({})
  }

  // 닉네임 저장
  useEffect(() => {
    localStorage.setItem('bandspace_nickname', nickname)
  }, [nickname])

  // 개인 믹서 함수들
  const setMixVolume = (oderId: string, volume: number) => {
    setMixSettingsMap(prev => ({
      ...prev,
      [oderId]: { ...prev[oderId], volume: Math.max(0, Math.min(1, volume)) }
    }))
    const nodes = audioNodesRef.current.get(oderId)
    if (nodes) {
      nodes.gain.gain.value = volume * masterVolume
    }
  }

  const setMixPan = (oderId: string, pan: number) => {
    setMixSettingsMap(prev => ({
      ...prev,
      [oderId]: { ...prev[oderId], pan: Math.max(-1, Math.min(1, pan)) }
    }))
    const nodes = audioNodesRef.current.get(oderId)
    if (nodes) {
      nodes.panner.pan.value = pan
    }
  }

  const setMixMuted = (oderId: string, muted: boolean) => {
    setMixSettingsMap(prev => ({
      ...prev,
      [oderId]: { ...prev[oderId], muted }
    }))
    const nodes = audioNodesRef.current.get(oderId)
    if (nodes) {
      nodes.gain.gain.value = muted ? 0 : (mixSettingsMap[oderId]?.volume ?? 1) * masterVolume
    }
  }

  // 마스터 볼륨 변경 시 모든 노드 업데이트
  useEffect(() => {
    audioNodesRef.current.forEach((nodes, oderId) => {
      const settings = mixSettingsMap[oderId]
      if (settings && !settings.muted) {
        nodes.gain.gain.value = settings.volume * masterVolume
      }
    })
  }, [masterVolume, mixSettingsMap])

  // 채팅 메시지 전송
  const sendChatMessage = (message: string) => {
    if (!message.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const chatPayload = {
      type: 'chat',
      message: message.trim(),
      nickname,
      timestamp: Date.now()
    }
    wsRef.current.send(JSON.stringify(chatPayload))

    // 내 메시지도 바로 추가
    setChatMessages(prev => [...prev, {
      id: `${clientId}-${Date.now()}`,
      peerId: clientId || 'me',
      nickname,
      message: message.trim(),
      timestamp: Date.now()
    }])
  }

  // 내 악기 설정 및 연주 시작 알림
  const setMyInstrument = (instrument: string) => {
    setMyInstrumentState(instrument)
    myInstrumentRef.current = instrument

    // 서버에 연주 시작 알림 (서버가 방 전체에 브로드캐스트)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'start-performing',
        instrument,
        nickname
      }))
    }

    // 내 악기 정보도 peerInstruments에 추가
    if (clientId) {
      setPeerInstruments(prev => ({
        ...prev,
        [clientId]: { peerId: clientId, instrument, nickname }
      }))
    }
  }

  // nickname 변경 시 ref 업데이트
  useEffect(() => {
    nicknameRef.current = nickname
  }, [nickname])

  // localStream 변경 시 ref 업데이트
  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  // WebSocket setup
  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return
    }

    // StrictMode double-mount 방지용 플래그
    let isMounted = true

    console.log('[WS] Connecting to', SIGNALING_URL)
    setSignalStatus('connecting')
    const ws = new WebSocket(SIGNALING_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected!')
      if (isMounted) setSignalStatus('connected')
    }
    ws.onerror = (event) => {
      console.error('[WS] Error:', event)
      if (!isMounted) return
      setSignalStatus('error')
    }
    ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason)
      if (!isMounted) return
      setSignalStatus('idle')
      setClientId(null)
      setPeers([])
      teardownPeerConnections()
    }
    ws.onmessage = (event) => {
      if (!isMounted) return
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'welcome') {
          setClientId(payload.clientId)
          clientIdRef.current = payload.clientId
          return
        }
        // 새로운 서버 메시지: 방 상태 (입장 시 수신)
        if (payload.type === 'room-state') {
          const peerList: string[] = Array.isArray(payload.peerIds) ? payload.peerIds : []
          const participants = Array.isArray(payload.participants) ? payload.participants : []
          console.log('[WS] Received room-state, peers:', peerList.length, 'participants:', participants.length)

          setPeers(peerList)
          setJoinFeedback(`룸 입장 완료 · 동시 연결 ${peerList.length + 1}명`)

          // 참여자 정보로 peerInstruments 초기화 (연주 중인 사람만)
          const instrumentsMap: Record<string, PeerInstrument> = {}
          for (const p of participants) {
            if (p.isPerforming && p.instrument) {
              instrumentsMap[p.oderId] = {
                peerId: p.oderId,
                instrument: p.instrument,
                nickname: p.nickname
              }
            }
          }
          setPeerInstruments(instrumentsMap)
          console.log('[WS] Initialized peerInstruments:', Object.keys(instrumentsMap).length, 'performers')

          // 각 피어에게 offer 전송
          peerList.forEach((peerId) => {
            console.log('[RTC] Creating offer for peer:', peerId.slice(0, 8))
            void createOfferForPeer(peerId)
          })
          return
        }

        // 새로운 참여자 입장
        if (payload.type === 'participant-joined' && payload.participant) {
          const participant = payload.participant
          console.log('[WS] Participant joined:', participant.oderId?.slice(0, 8), participant.nickname)
          setPeers((prev) => (prev.includes(participant.oderId) ? prev : [...prev, participant.oderId]))

          // 연주 중인 참여자라면 악기 정보 추가
          if (participant.isPerforming && participant.instrument) {
            setPeerInstruments(prev => ({
              ...prev,
              [participant.oderId]: {
                peerId: participant.oderId,
                instrument: participant.instrument,
                nickname: participant.nickname
              }
            }))
          }

          // 내가 연주 중이면 새 참여자에게 offer 전송 (오디오를 보내기 위해)
          if (localStreamRef.current) {
            console.log('[RTC] I have localStream, creating offer for new participant:', participant.oderId?.slice(0, 8))
            void createOfferForPeer(participant.oderId)
          }
          return
        }

        // 참여자 퇴장
        if (payload.type === 'participant-left' && typeof payload.oderId === 'string') {
          const peerId = payload.oderId
          console.log('[WS] Participant left:', peerId.slice(0, 8))
          setPeers((prev) => prev.filter((id) => id !== peerId))
          closePeerConnection(peerId)
          // 악기 정보 제거
          setPeerInstruments(prev => {
            const next = { ...prev }
            delete next[peerId]
            return next
          })
          // 네트워크 상태 제거
          setPeerNetworkStats(prev => {
            const next = { ...prev }
            delete next[peerId]
            return next
          })
          return
        }

        // 연주자 상태 업데이트 (연주 시작/중단)
        if (payload.type === 'performer-updated' && typeof payload.oderId === 'string') {
          const { oderId, nickname: peerNickname, instrument, isPerforming } = payload
          console.log('[WS] Performer updated:', oderId.slice(0, 8), isPerforming ? 'started' : 'stopped', instrument)

          if (isPerforming && instrument) {
            // 연주 시작
            setPeerInstruments(prev => ({
              ...prev,
              [oderId]: {
                peerId: oderId,
                instrument,
                nickname: peerNickname || `User ${oderId.slice(0, 4)}`
              }
            }))
          } else {
            // 연주 중단 - 악기 정보 제거
            setPeerInstruments(prev => {
              const next = { ...prev }
              delete next[oderId]
              return next
            })
          }
          return
        }

        // 하위 호환용: 기존 peers 메시지
        if (payload.type === 'peers') {
          const peerList: string[] = Array.isArray(payload.peerIds) ? payload.peerIds : []
          console.log('[WS] Received peers (legacy):', peerList)
          setPeers(peerList)
          setJoinFeedback(`룸 입장 완료 · 동시 연결 ${peerList.length + 1}명`)
          peerList.forEach((peerId) => {
            void createOfferForPeer(peerId)
          })
          return
        }

        // 하위 호환용: 기존 peer-joined 메시지
        if (payload.type === 'peer-joined' && typeof payload.peerId === 'string') {
          setPeers((prev) => (prev.includes(payload.peerId) ? prev : [...prev, payload.peerId]))
          return
        }

        // 하위 호환용: 기존 peer-left 메시지
        if (payload.type === 'peer-left' && typeof payload.peerId === 'string') {
          setPeers((prev) => prev.filter((id) => id !== payload.peerId))
          closePeerConnection(payload.peerId)
          setPeerInstruments(prev => {
            const next = { ...prev }
            delete next[payload.peerId]
            return next
          })
          setPeerNetworkStats(prev => {
            const next = { ...prev }
            delete next[payload.peerId]
            return next
          })
          return
        }
        if (payload.type === 'offer' && typeof payload.from === 'string' && payload.offer) {
          void handleRemoteOffer(payload.from, payload.offer)
          return
        }
        if (payload.type === 'answer' && typeof payload.from === 'string' && payload.answer) {
          void handleRemoteAnswer(payload.from, payload.answer)
          return
        }
        if (payload.type === 'ice-candidate' && typeof payload.from === 'string' && payload.candidate) {
          void handleRemoteCandidate(payload.from, payload.candidate)
          return
        }
        // 채팅 메시지 수신 (서버는 oderId로 보냄)
        if (payload.type === 'chat') {
          const senderId = payload.oderId || payload.from
          if (typeof senderId === 'string') {
            setChatMessages(prev => [...prev, {
              id: `${senderId}-${payload.timestamp || Date.now()}`,
              peerId: senderId,
              nickname: payload.nickname || `User ${senderId.slice(0, 4)}`,
              message: payload.message,
              timestamp: payload.timestamp || Date.now()
            }])
          }
          return
        }
        // 하위 호환용: 악기 정보 수신 (레거시)
        if (payload.type === 'instrument' && typeof payload.from === 'string') {
          setPeerInstruments(prev => ({
            ...prev,
            [payload.from]: {
              peerId: payload.from,
              instrument: payload.instrument,
              nickname: payload.nickname || `User ${payload.from.slice(0, 4)}`
            }
          }))
          return
        }
      } catch {
        // ignore malformed payloads
      }
    }

    return () => {
      isMounted = false
      // 연결이 완전히 열린 경우에만 close
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // 연결 중이면 열리자마자 닫기
        ws.onopen = () => ws.close()
      }
    }
  }, [])

  // Update peer connections when local stream changes
  useEffect(() => {
    if (localStream) {
      peerConnections.current.forEach((pc) => attachLocalTracks(pc, localStream))
    }
    return () => {
      localStream?.getTracks().forEach((track) => track.stop())
    }
  }, [localStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardownPeerConnections()
    }
  }, [])

  // 피어 연결 네트워크 상태 측정 (2초마다)
  useEffect(() => {
    const measureNetworkStats = async () => {
      const statsUpdate: Record<string, PeerNetworkStats> = {}

      for (const [peerId, pc] of peerConnections.current.entries()) {
        // connectionState 또는 iceConnectionState로 연결 상태 확인
        const isConnected = pc.connectionState === 'connected' ||
                           pc.iceConnectionState === 'connected' ||
                           pc.iceConnectionState === 'completed'

        if (!isConnected) {
          // 연결 대기 중인 피어도 표시
          statsUpdate[peerId] = {
            latency: null,
            jitter: null,
            packetsLost: 0,
            packetLossRate: 0,
            quality: 'unknown'
          }
          continue
        }

        try {
          const stats = await pc.getStats()
          let latency: number | null = null
          let jitter: number | null = null
          let packetsLost = 0
          let packetsReceived = 0

          stats.forEach((report) => {
            // candidate-pair에서 RTT 가져오기 (여러 상태 허용)
            if (report.type === 'candidate-pair' &&
                (report.state === 'succeeded' || report.nominated === true)) {
              if (typeof report.currentRoundTripTime === 'number') {
                latency = Math.round(report.currentRoundTripTime * 1000) // ms로 변환
              }
            }

            // remote-inbound-rtp에서도 RTT 가져오기 시도 (fallback)
            if (report.type === 'remote-inbound-rtp' && latency === null) {
              if (typeof report.roundTripTime === 'number') {
                latency = Math.round(report.roundTripTime * 1000)
              }
            }

            // inbound-rtp에서 jitter와 패킷 손실 가져오기
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
              if (typeof report.jitter === 'number') {
                jitter = Math.round(report.jitter * 1000) // ms로 변환
              }
              if (typeof report.packetsLost === 'number') {
                packetsLost = report.packetsLost
              }
              if (typeof report.packetsReceived === 'number') {
                packetsReceived = report.packetsReceived
              }
            }
          })

          const totalPackets = packetsReceived + packetsLost
          const packetLossRate = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0

          statsUpdate[peerId] = {
            latency,
            jitter,
            packetsLost,
            packetLossRate: Math.round(packetLossRate * 10) / 10,
            quality: getNetworkQuality(latency, packetLossRate)
          }
        } catch (err) {
          console.error(`Failed to get stats for peer ${peerId}:`, err)
          statsUpdate[peerId] = {
            latency: null,
            jitter: null,
            packetsLost: 0,
            packetLossRate: 0,
            quality: 'unknown'
          }
        }
      }

      if (Object.keys(statsUpdate).length > 0) {
        setPeerNetworkStats(prev => ({ ...prev, ...statsUpdate }))
      }
    }

    // 연결된 피어가 있을 때만 측정
    const interval = setInterval(() => {
      if (peerConnections.current.size > 0) {
        measureNetworkStats()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <RoomContext.Provider
      value={{
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
        actualStreamSettings,
        // 개인 믹서
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
        // 연주자 악기 정보
        peerInstruments,
        myInstrument,
        setMyInstrument,
        // 네트워크 상태
        peerNetworkStats,
      }}
    >
      {children}
    </RoomContext.Provider>
  )
}

export function useRoom() {
  const context = useContext(RoomContext)
  if (!context) {
    throw new Error('useRoom must be used within RoomProvider')
  }
  return context
}
