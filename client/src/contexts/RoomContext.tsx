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

  const wsRef = useRef<WebSocket | null>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())

  const sendSignalMessage = (payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    }
  }

  const attachLocalTracks = (pc: RTCPeerConnection, stream: MediaStream | null = localStream) => {
    if (!stream) return
    stream.getTracks().forEach((track) => {
      const already = pc.getSenders().some((sender) => sender.track === track)
      if (!already) {
        pc.addTrack(track, stream)
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
        sendSignalMessage({ type: 'ice-candidate', to: peerId, candidate: event.candidate })
      }
    }
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      setRemoteAudioMap((prev) => ({ ...prev, [peerId]: stream }))
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setRtcStatus('live')
      } else if (pc.connectionState === 'failed') {
        setRtcStatus('error')
        closePeerConnection(peerId)
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        closePeerConnection(peerId)
      }
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
    try {
      const pc = ensurePeerConnection(peerId)
      setRtcStatus('connecting')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignalMessage({ type: 'offer', to: peerId, offer })
    } catch (error) {
      setRtcStatus('error')
      setRtcError('WebRTC offer 생성에 실패했습니다.')
    }
  }

  const handleRemoteOffer = async (peerId: string, offer: RTCSessionDescriptionInit) => {
    try {
      const pc = ensurePeerConnection(peerId)
      await pc.setRemoteDescription(offer)
      attachLocalTracks(pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignalMessage({ type: 'answer', to: peerId, answer })
      setRtcStatus('connecting')
    } catch (error) {
      setRtcStatus('error')
      setRtcError('원격 offer 처리 중 오류가 발생했습니다.')
    }
  }

  const handleRemoteAnswer = async (peerId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(peerId)
    if (!pc) return
    try {
      await pc.setRemoteDescription(answer)
    } catch {
      setRtcStatus('error')
    }
  }

  const handleRemoteCandidate = async (peerId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(peerId)
    if (!pc) return
    try {
      await pc.addIceCandidate(candidate)
    } catch {
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
      setRtcStatus(peerConnections.current.size > 0 ? 'connecting' : 'live')
    } catch (err) {
      console.error('마이크 접근 실패:', err)
      setRtcError('마이크 권한이 필요합니다. 오디오 설정에서 장치를 확인해주세요.')
      setRtcStatus('error')
    }
  }

  const stopLocalMic = () => {
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
  }

  const joinRoom = (roomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setJoinFeedback('시그널링 서버 연결을 확인하세요.')
      return
    }
    wsRef.current.send(JSON.stringify({ type: 'join', roomId }))
    setCurrentRoomId(roomId)
    setJoinFeedback('룸 입장 시도 중...')
  }

  const leaveRoom = () => {
    teardownPeerConnections()
    stopLocalMic()
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

  // 내 악기 설정 및 브로드캐스트
  const setMyInstrument = (instrument: string) => {
    setMyInstrumentState(instrument)

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'instrument',
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

  // WebSocket setup
  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return
    }

    try {
      setSignalStatus('connecting')
      const ws = new WebSocket(SIGNALING_URL)
      wsRef.current = ws

      ws.onopen = () => setSignalStatus('connected')
      ws.onerror = (_event) => {
        // Suppress connection errors in development mode (React Strict Mode double mount)
        if (import.meta.env.DEV && ws.readyState === WebSocket.CONNECTING) {
          return
        }
        setSignalStatus('error')
      }
      ws.onclose = () => {
        setSignalStatus('idle')
        setClientId(null)
        setPeers([])
        teardownPeerConnections()
      }
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'welcome') {
            setClientId(payload.clientId)
            return
          }
          if (payload.type === 'peers') {
            const peerList: string[] = Array.isArray(payload.peerIds) ? payload.peerIds : []
            setPeers(peerList)
            setJoinFeedback(`룸 입장 완료 · 동시 연결 ${peerList.length + 1}명`)
            peerList.forEach((peerId) => {
              void createOfferForPeer(peerId)
            })
            return
          }
          if (payload.type === 'peer-joined') {
            setPeers((prev) => (prev.includes(payload.peerId) ? prev : [...prev, payload.peerId]))
            return
          }
          if (payload.type === 'peer-left') {
            setPeers((prev) => prev.filter((id) => id !== payload.peerId))
            if (typeof payload.peerId === 'string') {
              closePeerConnection(payload.peerId)
              // 악기 정보 제거
              setPeerInstruments(prev => {
                const next = { ...prev }
                delete next[payload.peerId]
                return next
              })
            }
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
          // 채팅 메시지 수신
          if (payload.type === 'chat' && typeof payload.from === 'string') {
            setChatMessages(prev => [...prev, {
              id: `${payload.from}-${payload.timestamp || Date.now()}`,
              peerId: payload.from,
              nickname: payload.nickname || `User ${payload.from.slice(0, 4)}`,
              message: payload.message,
              timestamp: payload.timestamp || Date.now()
            }])
            return
          }
          // 악기 정보 수신
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

      return () => ws.close()
    } catch (error) {
      setSignalStatus('error')
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
