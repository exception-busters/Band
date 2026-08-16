import * as Tone from 'tone'
import { getMusicFileUrl } from './musicApi'

export interface StemTrack {
  name: string
  url: string
  buffer: Tone.ToneAudioBuffer | null
  gainNode: Tone.Gain | null
  source: Tone.GrainPlayer | null
  enabled: boolean
}

export interface PlayerControls {
  tempo: number        // 재생 속도 배율 (0.5 ~ 2.0)
  pitch: number        // 음정 변화 (반음 단위: -12 ~ +12)
}

export class MultiTrackPlayer {
  private tracks: Map<string, StemTrack> = new Map()
  private isPlaying: boolean = false
  private isPaused: boolean = false
  private duration: number = 0

  private audioPosition: number = 0
  private lastPositionTime: number = 0

  private masterGain: Tone.Gain | null = null
  private playbackRate: number = 1.0
  private pitchShift: number = 0
  private stemVolumes: Map<string, number> = new Map()

  private progressCallback?: (progress: number, currentTime: number) => void
  private progressInterval?: number

  private isInitialized: boolean = false

  constructor() {
    this.initializeAudio()
  }

  private initializeAudio() {
    if (this.isInitialized) return

    this.masterGain = new Tone.Gain(1.0).toDestination()
    this.isInitialized = true

    console.log('[MultiTrackPlayer] Tone.js initialized')
  }

  async loadStems(stems: Record<string, string>): Promise<void> {
    if (!this.masterGain) {
      throw new Error('Audio not initialized')
    }

    console.log('[MultiTrackPlayer] Loading stems:', stems)

    this.clearTracks()

    await Tone.start()

    const loadPromises = Object.entries(stems).map(async ([stemName, stemUrl]) => {
      const url = stemUrl.startsWith('data:') || stemUrl.startsWith('http')
        ? stemUrl
        : getMusicFileUrl(stemUrl)

      try {
        const buffer = new Tone.ToneAudioBuffer()

        if (stemUrl.startsWith('data:')) {
          const base64Data = stemUrl.split(',')[1]
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const arrayBuffer = bytes.buffer

          const audioContext = Tone.getContext().rawContext
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
          buffer.set(audioBuffer)
        } else {
          await buffer.load(url)
        }

        const gainNode = new Tone.Gain(1.0)
        gainNode.connect(this.masterGain!)

        const track: StemTrack = {
          name: stemName,
          url,
          buffer,
          gainNode,
          source: null,
          enabled: true
        }

        this.tracks.set(stemName, track)

        if (buffer.duration > this.duration) {
          this.duration = buffer.duration
        }

        console.log(`[MultiTrackPlayer] Loaded stem: ${stemName} (${buffer.duration.toFixed(2)}s)`)
      } catch (error) {
        console.error(`[MultiTrackPlayer] Failed to load stem ${stemName}:`, error)
        throw error
      }
    })

    await Promise.all(loadPromises)

    console.log(`[MultiTrackPlayer] All stems loaded. Duration: ${this.duration.toFixed(2)}s`)
  }

  async play() {
    if (this.tracks.size === 0) {
      throw new Error('No tracks loaded')
    }

    await Tone.start()

    if (this.isPaused) {
      this.resume()
      return
    }

    this.startNewPlayback(0)
  }

  private startNewPlayback(startOffset: number) {
    this.stopAllSources()

    this.audioPosition = startOffset
    this.lastPositionTime = Tone.now()
    this.isPlaying = true
    this.isPaused = false

    // 모든 트랙이 정확히 같은 시각에 시작하도록 미래 시각을 미리 계산
    const startAt = Tone.now() + 0.05

    this.tracks.forEach((track) => {
      if (!track.buffer || !track.gainNode) return

      const bufferToUse = startOffset > 0
        ? track.buffer.slice(startOffset)
        : track.buffer

      const source = new Tone.GrainPlayer({
        url: bufferToUse,
        grainSize: 0.07,
        overlap: 0.05,
        loop: false,
        reverse: false
      })

      source.playbackRate = this.playbackRate
      source.detune = this.pitchShift * 100
      source.connect(track.gainNode)

      const vol = this.stemVolumes.get(track.name) ?? 1.0
      track.gainNode.gain.value = track.enabled ? vol : 0.0

      source.start(startAt)
      track.source = source
    })

    this.startProgressTracking()

    console.log('[MultiTrackPlayer] Playback started')
  }

  pause() {
    if (!this.isPlaying) return

    this.audioPosition = this.getCurrentTime()
    this.stopAllSources()
    this.isPlaying = false
    this.isPaused = true
    this.stopProgressTracking()

    console.log('[MultiTrackPlayer] Playback paused')
  }

  private resume() {
    if (!this.isPaused) return

    this.startNewPlayback(this.audioPosition)
    console.log('[MultiTrackPlayer] Playback resumed')
  }

  stop() {
    this.stopAllSources()
    this.isPlaying = false
    this.isPaused = false
    this.audioPosition = 0
    this.stopProgressTracking()

    console.log('[MultiTrackPlayer] Playback stopped')
  }

  seekTo(time: number) {
    if (this.tracks.size === 0) return

    const clampedTime = Math.max(0, Math.min(time, this.duration))

    if (this.isPlaying) {
      this.startNewPlayback(clampedTime)
    } else {
      this.audioPosition = clampedTime
      this.isPaused = true

      if (this.progressCallback) {
        this.progressCallback(clampedTime / this.duration, clampedTime)
      }
    }

    console.log(`[MultiTrackPlayer] Seeked to ${clampedTime.toFixed(2)}s`)
  }

  seekToProgress(progress: number) {
    const clampedProgress = Math.max(0, Math.min(1, progress))
    const time = clampedProgress * this.duration
    this.seekTo(time)
  }

  getCurrentTime(): number {
    if (this.isPlaying) {
      const elapsed = Tone.now() - this.lastPositionTime
      return this.audioPosition + elapsed * this.playbackRate
    }

    if (this.isPaused) {
      return this.audioPosition
    }

    return 0
  }

  private stopAllSources() {
    this.tracks.forEach((track) => {
      if (track.source) {
        try {
          track.source.stop()
          track.source.disconnect()
          track.source.dispose()
        } catch (e) {
          // Already stopped
        }
        track.source = null
      }
    })
  }

  toggleStem(stemName: string) {
    const track = this.tracks.get(stemName)
    if (!track) return

    track.enabled = !track.enabled

    if (track.gainNode) {
      const vol = this.stemVolumes.get(stemName) ?? 1.0
      track.gainNode.gain.value = track.enabled ? vol : 0.0
    }

    console.log(`[MultiTrackPlayer] Stem ${stemName} ${track.enabled ? 'enabled' : 'disabled'}`)
  }

  setStemVolume(stemName: string, volume: number) {
    const clamped = Math.max(0, Math.min(1, volume))
    this.stemVolumes.set(stemName, clamped)
    const track = this.tracks.get(stemName)
    if (track?.gainNode && track.enabled) {
      track.gainNode.gain.value = clamped
    }
  }

  setMasterVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume))
    if (this.masterGain) {
      this.masterGain.gain.value = clamped
    }
  }

  isStemEnabled(stemName: string): boolean {
    const track = this.tracks.get(stemName)
    return track ? track.enabled : false
  }

  setTempo(tempo: number) {
    const clampedTempo = Math.max(0.5, Math.min(2.0, tempo))

    if (this.isPlaying) {
      this.audioPosition = this.getCurrentTime()
      this.lastPositionTime = Tone.now()
      this.playbackRate = clampedTempo

      // 모든 소스에 동일한 오디오 시각에 rate 적용 (드리프트 방지)
      const changeAt = Tone.now()
      this.tracks.forEach((track) => {
        if (track.source) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(track.source.playbackRate as any).setValueAtTime(clampedTempo, changeAt)
          } catch {
            track.source.playbackRate = clampedTempo
          }
        }
      })
    } else {
      this.playbackRate = clampedTempo
    }

    console.log(`[MultiTrackPlayer] Tempo set to ${clampedTempo}x`)
  }

  setPitch(semitones: number) {
    this.pitchShift = Math.max(-12, Math.min(12, semitones))

    this.tracks.forEach((track) => {
      if (track.source) {
        track.source.detune = this.pitchShift * 100
      }
    })

    console.log(`[MultiTrackPlayer] Pitch set to ${this.pitchShift} semitones (tempo preserved)`)
  }

  onProgress(callback: (progress: number, currentTime: number) => void) {
    this.progressCallback = callback
  }

  private startProgressTracking() {
    this.stopProgressTracking()

    this.progressInterval = window.setInterval(() => {
      if (!this.isPlaying) return

      const currentTime = this.getCurrentTime()
      const progress = Math.min(currentTime / this.duration, 1)

      if (this.progressCallback) {
        this.progressCallback(progress, currentTime)
      }

      if (progress >= 1) {
        this.stop()
      }
    }, 100)
  }

  private stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = undefined
    }
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      duration: this.duration,
      tempo: this.playbackRate,
      pitch: this.pitchShift
    }
  }

  getLoadedStems(): string[] {
    return Array.from(this.tracks.keys())
  }

  private clearTracks() {
    this.stop()
    this.tracks.forEach((track) => {
      if (track.gainNode) {
        track.gainNode.disconnect()
        track.gainNode.dispose()
      }
      if (track.buffer) {
        track.buffer.dispose()
      }
    })
    this.tracks.clear()
    this.duration = 0
  }

  dispose() {
    this.clearTracks()
    this.stopProgressTracking()

    if (this.masterGain) {
      this.masterGain.disconnect()
      this.masterGain.dispose()
      this.masterGain = null
    }

    this.isInitialized = false

    console.log('[MultiTrackPlayer] Disposed')
  }
}
