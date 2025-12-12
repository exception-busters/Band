import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// 오디오 설정 타입
export interface AudioSettings {
  inputDeviceId: string | null
  outputDeviceId: string | null
  sampleRate: number
  channelCount: number
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
}

// 실제 적용된 오디오 설정 (브라우저가 실제로 적용한 값)
export interface ActualAudioSettings {
  deviceId: string | null
  sampleRate: number | null
  channelCount: number | null
  echoCancellation: boolean | null
  noiseSuppression: boolean | null
  autoGainControl: boolean | null
  latency: number | null
}

// 오디오 장치 정보
export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

// 프리셋 타입
export type AudioPreset = 'vocal' | 'guitar' | 'bass' | 'keyboard' | 'drums' | 'custom'

interface AudioSettingsContextType {
  // 장치 목록
  inputDevices: AudioDevice[]
  outputDevices: AudioDevice[]

  // 현재 설정
  settings: AudioSettings

  // 실제 적용된 설정 (브라우저가 실제로 적용한 값)
  actualSettings: ActualAudioSettings | null

  // 설정 변경
  setInputDevice: (deviceId: string) => void
  setOutputDevice: (deviceId: string) => void
  setSampleRate: (rate: number) => void
  setChannelCount: (count: number) => void
  setEchoCancellation: (enabled: boolean) => void
  setNoiseSuppression: (enabled: boolean) => void
  setAutoGainControl: (enabled: boolean) => void

  // 프리셋
  applyPreset: (preset: AudioPreset) => void

  // 장치 목록 새로고침
  refreshDevices: () => Promise<void>

  // 테스트 기능
  testInput: () => Promise<MediaStream | null>
  stopTest: () => void
  testStream: MediaStream | null
  inputLevel: number

  // 초기화 상태
  isInitialized: boolean
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown'
  requestPermission: () => Promise<boolean>
}

const defaultSettings: AudioSettings = {
  inputDeviceId: null,
  outputDeviceId: null,
  sampleRate: 48000,
  channelCount: 1,
  echoCancellation: false,  // 악기용이므로 기본 OFF
  noiseSuppression: false,
  autoGainControl: false,
}

// 프리셋 설정
const presets: Record<AudioPreset, Partial<AudioSettings>> = {
  vocal: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  guitar: {
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  bass: {
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  keyboard: {
    channelCount: 2,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  drums: {
    channelCount: 2,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  custom: {},
}

const STORAGE_KEY = 'bandspace_audio_settings'

const AudioSettingsContext = createContext<AudioSettingsContextType | null>(null)

export function AudioSettingsProvider({ children }: { children: ReactNode }) {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([])
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([])
  const [settings, setSettings] = useState<AudioSettings>(defaultSettings)
  const [actualSettings, setActualSettings] = useState<ActualAudioSettings | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [testStream, setTestStream] = useState<MediaStream | null>(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)

  // localStorage에서 설정 로드
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch (e) {
        console.error('Failed to parse saved audio settings:', e)
      }
    }
  }, [])

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    }
  }, [settings, isInitialized])

  // 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // mediaDevices API 지원 여부 확인
    if (!navigator.mediaDevices) {
      console.warn('MediaDevices API not available. This requires HTTPS or localhost.')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setPermissionStatus('granted')
      return true
    } catch (err) {
      console.error('Permission denied:', err)
      setPermissionStatus('denied')
      return false
    }
  }, [])

  // 장치 목록 가져오기
  const refreshDevices = useCallback(async () => {
    // mediaDevices API 지원 여부 확인
    if (!navigator.mediaDevices) {
      console.warn('MediaDevices API not available')
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      const inputs: AudioDevice[] = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `마이크 ${d.deviceId.slice(0, 5)}`,
          kind: 'audioinput' as const,
        }))

      const outputs: AudioDevice[] = devices
        .filter(d => d.kind === 'audiooutput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `스피커 ${d.deviceId.slice(0, 5)}`,
          kind: 'audiooutput' as const,
        }))

      setInputDevices(inputs)
      setOutputDevices(outputs)

      // 저장된 장치가 없으면 기본 장치 선택
      if (!settings.inputDeviceId && inputs.length > 0) {
        setSettings(prev => ({ ...prev, inputDeviceId: inputs[0].deviceId }))
      }
      if (!settings.outputDeviceId && outputs.length > 0) {
        setSettings(prev => ({ ...prev, outputDeviceId: outputs[0].deviceId }))
      }

      setIsInitialized(true)
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
    }
  }, [settings.inputDeviceId, settings.outputDeviceId])

  // 초기화: 권한 확인 후 장치 목록 로드
  useEffect(() => {
    // mediaDevices API 지원 여부 확인 (HTTPS 또는 localhost에서만 사용 가능)
    if (!navigator.mediaDevices) {
      console.warn('MediaDevices API not available. This requires HTTPS or localhost.')
      setIsInitialized(true)
      return
    }

    const init = async () => {
      // 권한 상태 확인
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt')

        result.addEventListener('change', () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt')
        })

        if (result.state === 'granted') {
          await refreshDevices()
        }
      } catch (err) {
        // permissions API를 지원하지 않는 경우
        console.warn('Permissions API not supported')
        await refreshDevices()
      }
    }

    init()

    // 장치 변경 감지
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
    }
  }, [refreshDevices])

  // 설정 변경 함수들
  const setInputDevice = useCallback((deviceId: string) => {
    setSettings(prev => ({ ...prev, inputDeviceId: deviceId }))
  }, [])

  const setOutputDevice = useCallback((deviceId: string) => {
    setSettings(prev => ({ ...prev, outputDeviceId: deviceId }))
  }, [])

  const setSampleRate = useCallback((rate: number) => {
    setSettings(prev => ({ ...prev, sampleRate: rate }))
  }, [])

  const setChannelCount = useCallback((count: number) => {
    setSettings(prev => ({ ...prev, channelCount: count }))
  }, [])

  const setEchoCancellation = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, echoCancellation: enabled }))
  }, [])

  const setNoiseSuppression = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, noiseSuppression: enabled }))
  }, [])

  const setAutoGainControl = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, autoGainControl: enabled }))
  }, [])

  // 프리셋 적용
  const applyPreset = useCallback((preset: AudioPreset) => {
    const presetSettings = presets[preset]
    setSettings(prev => ({ ...prev, ...presetSettings }))
  }, [])

  // 실제 적용된 설정 가져오기
  const getActualSettings = useCallback((stream: MediaStream): ActualAudioSettings => {
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack) {
      return {
        deviceId: null,
        sampleRate: null,
        channelCount: null,
        echoCancellation: null,
        noiseSuppression: null,
        autoGainControl: null,
        latency: null,
      }
    }

    // MediaTrackSettings 타입에 latency가 표준에는 없지만 일부 브라우저에서 지원
    const trackSettings = audioTrack.getSettings() as MediaTrackSettings & { latency?: number }
    return {
      deviceId: trackSettings.deviceId ?? null,
      sampleRate: trackSettings.sampleRate ?? null,
      channelCount: trackSettings.channelCount ?? null,
      echoCancellation: trackSettings.echoCancellation ?? null,
      noiseSuppression: trackSettings.noiseSuppression ?? null,
      autoGainControl: trackSettings.autoGainControl ?? null,
      latency: trackSettings.latency ?? null,
    }
  }, [])

  // 입력 테스트
  const testInput = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // 기존 테스트 스트림 정리
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop())
      }
      if (audioContext) {
        await audioContext.close()
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: settings.inputDeviceId ? { exact: settings.inputDeviceId } : undefined,
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setTestStream(stream)

      // 실제 적용된 설정 가져오기
      const actual = getActualSettings(stream)
      setActualSettings(actual)

      // 오디오 레벨 분석
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      setAudioContext(ctx)
      setAnalyserNode(analyser)

      // 레벨 미터 업데이트
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        if (analyser) {
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setInputLevel(average / 255 * 100)
        }
        if (stream.active) {
          requestAnimationFrame(updateLevel)
        }
      }
      updateLevel()

      return stream
    } catch (err) {
      console.error('Failed to test input:', err)
      return null
    }
  }, [settings, testStream, audioContext, getActualSettings])

  // 테스트 중지
  const stopTest = useCallback(() => {
    if (testStream) {
      testStream.getTracks().forEach(track => track.stop())
      setTestStream(null)
    }
    if (audioContext) {
      audioContext.close()
      setAudioContext(null)
    }
    setAnalyserNode(null)
    setInputLevel(0)
    setActualSettings(null)
  }, [testStream, audioContext])

  // 테스트 중 설정 변경 시 자동으로 재시작
  useEffect(() => {
    if (!testStream) return

    const restartTest = async () => {
      try {
        // 기존 스트림 정리
        testStream.getTracks().forEach(track => track.stop())
        if (audioContext) {
          await audioContext.close()
        }

        // 새 스트림 시작
        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: settings.inputDeviceId ? { exact: settings.inputDeviceId } : undefined,
            sampleRate: settings.sampleRate,
            channelCount: settings.channelCount,
            echoCancellation: settings.echoCancellation,
            noiseSuppression: settings.noiseSuppression,
            autoGainControl: settings.autoGainControl,
          },
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        setTestStream(stream)

        // 실제 적용된 설정 가져오기
        const actual = getActualSettings(stream)
        setActualSettings(actual)

        // 오디오 레벨 분석
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)

        setAudioContext(ctx)
        setAnalyserNode(analyser)

        // 레벨 미터 업데이트
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const updateLevel = () => {
          if (analyser) {
            analyser.getByteFrequencyData(dataArray)
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
            setInputLevel(average / 255 * 100)
          }
          if (stream.active) {
            requestAnimationFrame(updateLevel)
          }
        }
        updateLevel()
      } catch (err) {
        console.error('Failed to restart test:', err)
      }
    }

    restartTest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.inputDeviceId, settings.sampleRate, settings.channelCount,
      settings.echoCancellation, settings.noiseSuppression, settings.autoGainControl])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop())
      }
      if (audioContext) {
        audioContext.close()
      }
    }
  }, [])

  return (
    <AudioSettingsContext.Provider
      value={{
        inputDevices,
        outputDevices,
        settings,
        actualSettings,
        setInputDevice,
        setOutputDevice,
        setSampleRate,
        setChannelCount,
        setEchoCancellation,
        setNoiseSuppression,
        setAutoGainControl,
        applyPreset,
        refreshDevices,
        testInput,
        stopTest,
        testStream,
        inputLevel,
        isInitialized,
        permissionStatus,
        requestPermission,
      }}
    >
      {children}
    </AudioSettingsContext.Provider>
  )
}

export function useAudioSettings() {
  const context = useContext(AudioSettingsContext)
  if (!context) {
    throw new Error('useAudioSettings must be used within AudioSettingsProvider')
  }
  return context
}
