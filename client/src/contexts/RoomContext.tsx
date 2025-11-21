import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'ws://localhost:8080'
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

type RtcStatus = 'idle' | 'connecting' | 'live' | 'error'
type SignalStatus = 'idle' | 'connecting' | 'connected' | 'error'

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
}

const RoomContext = createContext<RoomContextType | null>(null)

export function RoomProvider({ children }: { children: ReactNode }) {
  const [signalStatus, setSignalStatus] = useState<SignalStatus>('idle')
  const [clientId, setClientId] = useState<string | null>(null)
  const [peers, setPeers] = useState<string[]>([])
  const [joinFeedback, setJoinFeedback] = useState('')
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)

  const [rtcStatus, setRtcStatus] = useState<RtcStatus>('idle')
  const [rtcError, setRtcError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteAudioMap, setRemoteAudioMap] = useState<Record<string, MediaStream>>({})

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setLocalStream(stream)
      setRtcError(null)
      setRtcStatus(peerConnections.current.size > 0 ? 'connecting' : 'live')
    } catch {
      setRtcError('마이크 권한이 필요합니다.')
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
      ws.onerror = (event) => {
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
