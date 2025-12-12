import * as Tone from 'tone';
import {
  InstrumentType,
  MusicNote,
  MusicScore,
  DRUM_MIDI_MAP,
  DrumSampleUrls,
  DrumMidiMapping
} from '../types/music';

/**
 * 합성 드럼 사운드 생성기 클래스
 */
class SynthDrumGenerator {
  private static audioContext: AudioContext | null = null;

  private static getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = Tone.context.rawContext as AudioContext;
    }
    return this.audioContext;
  }

  /**
   * 합성 스네어 드럼 사운드 생성 및 재생 (오디오 노드 반환)
   */
  static playSnare(time: number = 0, velocity: number = 1): AudioBufferSourceNode | null {
    try {
      const ctx = this.getAudioContext();

      // 정확한 시간 계산 (Transport와 동기화)
      const startTime = time > 0 ? ctx.currentTime + time : ctx.currentTime;

      // 노이즈 버퍼 생성 (0.2초)
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // 화이트 노이즈 생성
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // 밴드패스 필터 (스네어 특성 주파수)
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500;
      filter.Q.value = 1;

      // 볼륨 엔벨로프 (빠른 어택, 지수적 디케이)
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(velocity, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      // 오디오 체인 연결
      noise.buffer = buffer;
      noise.connect(filter).connect(gain).connect(ctx.destination);

      // 재생 시작
      noise.start(startTime);

      console.log(`🥁 Synthetic snare played at time ${startTime} (offset: ${time}) with velocity ${velocity}`);

      return noise; // 🎵 오디오 노드 반환
    } catch (error) {
      console.error('❌ Failed to play synthetic snare:', error);
      return null;
    }
  }

  /**
   * 합성 킥 드럼 사운드 생성 및 재생
   */
  static playKick(time: number = 0, velocity: number = 1): void {
    try {
      const ctx = this.getAudioContext();

      // 정확한 시간 계산 (Transport와 동기화)
      const startTime = time > 0 ? ctx.currentTime + time : ctx.currentTime;

      // 메인 킥 오실레이터 (더 낮은 주파수)
      const kickOsc = ctx.createOscillator();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(80, startTime);
      kickOsc.frequency.exponentialRampToValueAtTime(20, startTime + 0.1);
      kickOsc.frequency.exponentialRampToValueAtTime(0.1, startTime + 0.6);

      // 서브 베이스 오실레이터 (더 깊은 저음)
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(40, startTime);
      subOsc.frequency.exponentialRampToValueAtTime(10, startTime + 0.15);
      subOsc.frequency.exponentialRampToValueAtTime(0.1, startTime + 0.7);

      // 클릭 사운드 (어택 강화)
      const clickOsc = ctx.createOscillator();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(200, startTime);
      clickOsc.frequency.exponentialRampToValueAtTime(50, startTime + 0.01);

      // 메인 킥 게인
      const kickGain = ctx.createGain();
      kickGain.gain.setValueAtTime(velocity * 0.8, startTime);
      kickGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);

      // 서브 베이스 게인
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(velocity * 0.6, startTime);
      subGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.7);

      // 클릭 게인 (짧은 어택)
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(velocity * 0.3, startTime);
      clickGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.01);

      // 로우패스 필터 (저음 강조)
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 120;
      filter.Q.value = 1;

      // 컴프레서 (펀치감 강화)
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 10;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.001;
      compressor.release.value = 0.1;

      // 믹서
      const mixer = ctx.createGain();
      mixer.gain.value = 1.2; // 전체 볼륨 증가

      // 오디오 체인 연결
      kickOsc.connect(kickGain);
      subOsc.connect(subGain);
      clickOsc.connect(clickGain);

      kickGain.connect(mixer);
      subGain.connect(mixer);
      clickGain.connect(mixer);

      mixer.connect(filter).connect(compressor).connect(ctx.destination);

      // 재생
      kickOsc.start(startTime);
      kickOsc.stop(startTime + 0.6);

      subOsc.start(startTime);
      subOsc.stop(startTime + 0.7);

      clickOsc.start(startTime);
      clickOsc.stop(startTime + 0.01);

      console.log(`🎛️ Enhanced synthetic kick played at time ${startTime} (offset: ${time}) with velocity ${velocity}`);
    } catch (error) {
      console.error('❌ Failed to play synthetic kick:', error);
    }
  }

  /**
   * 합성 하이햇 사운드 생성 및 재생
   */
  static playHihat(time: number = 0, velocity: number = 1, open: boolean = false): void {
    try {
      const ctx = this.getAudioContext();

      // 정확한 시간 계산 (Transport와 동기화)
      const startTime = time > 0 ? ctx.currentTime + time : ctx.currentTime;

      // 노이즈 버퍼 생성
      const noise = ctx.createBufferSource();
      const duration = open ? 0.3 : 0.1;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // 화이트 노이즈 생성
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // 하이패스 필터 (고음 강조)
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = open ? 8000 : 10000;

      // 볼륨 엔벨로프
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(velocity * 0.7, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      // 오디오 체인 연결
      noise.buffer = buffer;
      noise.connect(filter).connect(gain).connect(ctx.destination);

      // 재생
      noise.start(startTime);

      console.log(`🎛️ Synthetic ${open ? 'open' : 'closed'} hihat played at time ${startTime} (offset: ${time}) with velocity ${velocity}`);
    } catch (error) {
      console.error('❌ Failed to play synthetic hihat:', error);
    }
  }

  /**
   * 합성 톰 드럼 사운드 생성 및 재생
   */
  static playTom(time: number = 0, velocity: number = 1): void {
    try {
      const ctx = this.getAudioContext();

      // 사인파 오실레이터 (톰 기본 톤)
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(150, ctx.currentTime + time);
      oscillator.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + time + 0.3);

      // 노이즈 추가 (드럼 헤드 질감)
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }
      noise.buffer = buffer;

      // 믹서
      const mixer = ctx.createGain();
      mixer.gain.value = 1;

      // 볼륨 엔벨로프
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + time;
      gain.gain.setValueAtTime(velocity * 0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      // 로우패스 필터
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;

      // 오디오 체인 연결
      oscillator.connect(mixer);
      noise.connect(mixer);
      mixer.connect(filter).connect(gain).connect(ctx.destination);

      // 재생
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.4);
      noise.start(startTime);

      console.log(`🎛️ Synthetic tom played at time ${startTime} with velocity ${velocity}`);
    } catch (error) {
      console.error('❌ Failed to play synthetic tom:', error);
    }
  }

  /**
   * 합성 크래시 심벌 사운드 생성 및 재생
   */
  static playCrash(time: number = 0, velocity: number = 1): void {
    try {
      const ctx = this.getAudioContext();

      // 노이즈 버퍼 생성 (긴 지속시간)
      const noise = ctx.createBufferSource();
      const duration = 2.0;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // 화이트 노이즈 생성
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // 하이패스 필터 (심벌 특성)
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 3000;

      // 밴드패스 필터 (메탈릭 사운드)
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 8000;
      bandpass.Q.value = 2;

      // 볼륨 엔벨로프 (빠른 어택, 긴 디케이)
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + time;
      gain.gain.setValueAtTime(velocity * 0.6, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      // 오디오 체인 연결
      noise.buffer = buffer;
      noise.connect(highpass).connect(bandpass).connect(gain).connect(ctx.destination);

      // 재생
      noise.start(startTime);

      console.log(`🎛️ Synthetic crash played at time ${startTime} with velocity ${velocity}`);
    } catch (error) {
      console.error('❌ Failed to play synthetic crash:', error);
    }
  }
}

// DrumSampleLoader 제거 - 합성 드럼만 사용

/**
 * 드럼 MIDI 매퍼 클래스
 */
class DrumMidiMapper {
  static getSampleName(midiNote: number): keyof DrumSampleUrls | null {
    return DRUM_MIDI_MAP[midiNote] || null;
  }

  static isSupportedMidiNote(midiNote: number): boolean {
    return midiNote in DRUM_MIDI_MAP;
  }

  static getAllSupportedMidiNotes(): number[] {
    return Object.keys(DRUM_MIDI_MAP).map(Number);
  }
}

/**
 * 멜로디 음을 드럼 패턴으로 변환하는 매퍼 클래스
 */
class MelodyToDrumMapper {
  // 음계별 드럼 매핑 규칙
  private static readonly PITCH_TO_DRUM_MAP: { [key: string]: string } = {
    'C': 'kick',      // C 계열 → 킥
    'D': 'snare',     // D 계열 → 스네어
    'E': 'hihat',     // E 계열 → 하이햇
    'F': 'kick',      // F 계열 → 킥
    'G': 'snare',     // G 계열 → 스네어
    'A': 'hihat',     // A 계열 → 하이햇
    'B': 'snare'      // B 계열 → 스네어
  };

  /**
   * 멜로디 pitch(C4, D#5 등)를 드럼 이름으로 변환
   */
  static convertPitchToDrum(pitch: string): string | null {
    // pitch에서 음계 추출 (C4 → C, D#5 → D, Bb3 → B)
    const noteMatch = pitch.match(/^([A-G][#b]?)/);
    if (!noteMatch) {
      console.warn(`Invalid pitch format for drum conversion: ${pitch}`);
      return null;
    }

    let noteName = noteMatch[1];

    // 샤프/플랫 처리 (옥타브는 무시하고 기본 음계만 사용)
    if (noteName.includes('#')) {
      noteName = noteName.charAt(0); // C# → C
    } else if (noteName.includes('b')) {
      noteName = noteName.charAt(0); // Bb → B
    }

    const drumName = this.PITCH_TO_DRUM_MAP[noteName];

    if (drumName) {
      console.log(`🎛️ Melody to drum conversion: ${pitch} → ${drumName}`);
      return drumName;
    }

    console.warn(`No drum mapping found for note: ${noteName} (from pitch: ${pitch})`);
    return null;
  }

  /**
   * 지원되는 음계인지 확인
   */
  static isSupportedNote(pitch: string): boolean {
    const noteMatch = pitch.match(/^([A-G][#b]?)/);
    if (!noteMatch) return false;

    let noteName = noteMatch[1];
    if (noteName.includes('#') || noteName.includes('b')) {
      noteName = noteName.charAt(0);
    }

    return noteName in this.PITCH_TO_DRUM_MAP;
  }

  /**
   * 매핑 테이블 반환 (디버깅용)
   */
  static getMappingTable(): { [key: string]: string } {
    return { ...this.PITCH_TO_DRUM_MAP };
  }
}

export class AudioEngine {
  private static instance: AudioEngine;
  private isInitialized = false;
  private samplers: Map<InstrumentType, Tone.Sampler> = new Map();
  private drumPlayers: Tone.Players | null = null;
  private loadingStates: Map<InstrumentType, boolean> = new Map();
  private transport: typeof Tone.Transport;
  private currentParts: Tone.Part[] = [];
  private musicDuration: number = 0; // 음악의 총 길이 (박자 단위)
  private lastLoadedNotes: MusicNote[] = []; // 마지막으로 로드된 음표들
  private lastSelectedInstruments: InstrumentType[] = []; // 마지막으로 선택된 악기들

  // 🎵 실제 오디오 종료 시점 추적 시스템
  private songStartTime: number = 0; // 재생 시작 절대 시간 (Tone.now())
  private _lastNoteEndedAt: number = 0; // 마지막 음표가 실제로 끝난 시간
  private activeAudioNodes: Set<AudioNode | Tone.ToneAudioNode> = new Set(); // 활성 오디오 노드들
  private expectedEndTime: number = 0; // 예상 종료 시간 (계산값)

  private constructor() {
    this.transport = Tone.Transport;
  }

  /**
   * 피치 문자열을 MIDI 번호로 변환
   */
  private pitchToMidiNumber(pitch: string): number {
    const noteMap: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) {
      console.warn(`Invalid pitch format: ${pitch}`);
      return -1;
    }

    const noteName = match[1];
    const octave = parseInt(match[2], 10);

    const noteNumber = noteMap[noteName];
    if (noteNumber === undefined) {
      console.warn(`Unknown note: ${noteName}`);
      return -1;
    }

    return (octave + 1) * 12 + noteNumber;
  }

  /**
   * MIDI 번호가 드럼 매핑에 해당하는지 확인
   */
  private isDrumNote(midiNumber: number): boolean {
    return DrumMidiMapper.isSupportedMidiNote(midiNumber);
  }

  /**
   * MIDI 번호를 드럼 샘플 이름으로 변환
   */
  private midiToDrumSample(midiNumber: number): string | null {
    return DrumMidiMapper.getSampleName(midiNumber);
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      this.transport.bpm.value = 120;
      this.transport.timeSignature = 4;

      this.isInitialized = true;
      console.log('AudioEngine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioEngine:', error);
      throw new Error('오디오 엔진 초기화에 실패했습니다.');
    }
  }

  /**
   * 합성 드럼 키트 초기화 (샘플 로딩 없음)
   */
  private async loadDrumKit(): Promise<void> {
    if (this.loadingStates.get(InstrumentType.DRUMS)) {
      return this.waitForInstrumentLoad(InstrumentType.DRUMS);
    }

    this.loadingStates.set(InstrumentType.DRUMS, true);

    return new Promise((resolve) => {
      try {
        // 합성 드럼은 샘플 로딩이 필요 없으므로 즉시 완료
        console.log('🎛️ Initializing synthetic drum kit...');

        // drumPlayers를 null로 설정하여 합성 드럼 사용을 강제
        this.drumPlayers = null;

        console.log('✅ Synthetic drum kit initialized successfully');
        this.loadingStates.set(InstrumentType.DRUMS, false);
        resolve();

      } catch (error) {
        this.loadingStates.set(InstrumentType.DRUMS, false);
        console.error('❌ Failed to initialize synthetic drum kit:', error);
        resolve(); // 합성 드럼은 실패해도 계속 진행
      }
    });
  }

  /**
   * 드럼 이펙트 설정
   */
  private setupDrumEffects(): void {
    if (!this.drumPlayers) return;

    const drumCompressor = new Tone.Compressor({
      threshold: -18,
      ratio: 6,
      attack: 0.001,
      release: 0.05
    });

    this.drumPlayers.chain(drumCompressor, Tone.Destination);
    console.log('🥁 Drum effects chain setup complete');
  }

  public async loadInstrument(instrumentType: InstrumentType): Promise<void> {
    if (instrumentType === InstrumentType.DRUMS) {
      return this.loadDrumKit();
    }

    if (this.samplers.has(instrumentType)) {
      return;
    }

    if (this.loadingStates.get(instrumentType)) {
      return this.waitForInstrumentLoad(instrumentType);
    }

    this.loadingStates.set(instrumentType, true);

    try {
      const sampler = await this.createSampler(instrumentType);
      this.samplers.set(instrumentType, sampler);
      this.loadingStates.set(instrumentType, false);
      console.log(`${instrumentType} instrument loaded successfully`);
    } catch (error) {
      this.loadingStates.set(instrumentType, false);
      console.error(`Failed to load ${instrumentType} instrument:`, error);
      throw new Error(`${instrumentType} 악기 로딩에 실패했습니다.`);
    }
  }

  private async waitForInstrumentLoad(instrumentType: InstrumentType): Promise<void> {
    return new Promise((resolve) => {
      const checkLoaded = () => {
        if (this.isInstrumentLoaded(instrumentType)) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    });
  }

  public isInstrumentLoaded(instrumentType: InstrumentType): boolean {
    if (instrumentType === InstrumentType.DRUMS) {
      // 합성 드럼은 항상 사용 가능 (로딩 중이 아닐 때)
      return !this.loadingStates.get(instrumentType);
    }
    return this.samplers.has(instrumentType) && !this.loadingStates.get(instrumentType);
  }

  public isInstrumentLoading(instrumentType: InstrumentType): boolean {
    return this.loadingStates.get(instrumentType) || false;
  }

  private async createSampler(instrumentType: InstrumentType): Promise<Tone.Sampler> {
    return new Promise((resolve, reject) => {
      let urls: { [key: string]: string } = {};
      let baseUrl = '';

      switch (instrumentType) {
        case InstrumentType.PIANO:
          urls = {
            'C4': 'C4.mp3',
            'D#4': 'Ds4.mp3',
            'F#4': 'Fs4.mp3',
            'A4': 'A4.mp3',
          };
          baseUrl = 'https://tonejs.github.io/audio/salamander/';
          break;

        case InstrumentType.GUITAR:
          urls = {
            'C3': 'C3.mp3',
            'D3': 'D3.mp3',
            'E3': 'E3.mp3',
            'F3': 'F3.mp3',
            'G3': 'G3.mp3',
            'A3': 'A3.mp3',
            'B3': 'B3.mp3',
            'C4': 'C4.mp3',
            'D4': 'D4.mp3',
            'E4': 'E4.mp3',
            'F4': 'F4.mp3',
            'G4': 'G4.mp3',
            'A4': 'A4.mp3',
            'B4': 'B4.mp3'
          };
          baseUrl = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/';
          break;

        case InstrumentType.DRUMS:
          // 드럼은 별도 처리
          urls = {};
          baseUrl = '';
          break;
      }

      console.log(`🎼 Loading ${instrumentType} samples from: ${baseUrl}`);

      const sampler = new Tone.Sampler({
        urls,
        baseUrl,
        release: instrumentType === InstrumentType.GUITAR ? 2 : 1,
        onload: () => {
          console.log(`✅ ${instrumentType} samples loaded successfully`);
          this.setupInstrumentEffects(sampler, instrumentType);
          resolve(sampler);
        },
        onerror: (error) => {
          console.error(`❌ Failed to load ${instrumentType} samples:`, error);
          reject(new Error(`${instrumentType} 샘플 로딩 실패: ${error}`));
        }
      });
    });
  }

  private setupInstrumentEffects(sampler: Tone.Sampler, instrumentType: InstrumentType): void {
    switch (instrumentType) {
      case InstrumentType.GUITAR: {
        const guitarReverb = new Tone.Reverb({
          decay: 2,
          wet: 0.3
        });

        const guitarChorus = new Tone.Chorus({
          frequency: 1.5,
          delayTime: 3.5,
          depth: 0.7,
          wet: 0.2
        });

        const guitarCompressor = new Tone.Compressor({
          threshold: -24,
          ratio: 8,
          attack: 0.003,
          release: 0.1
        });

        sampler.chain(guitarCompressor, guitarChorus, guitarReverb, Tone.Destination);
        console.log('Guitar effects chain setup complete');
        break;
      }

      case InstrumentType.PIANO: {
        const pianoReverb = new Tone.Reverb({
          decay: 1.5,
          wet: 0.2
        });

        sampler.chain(pianoReverb, Tone.Destination);
        console.log('Piano effects chain setup complete');
        break;
      }

      case InstrumentType.DRUMS: {
        const drumCompressor = new Tone.Compressor({
          threshold: -18,
          ratio: 6,
          attack: 0.001,
          release: 0.05
        });

        sampler.chain(drumCompressor, Tone.Destination);
        console.log('Drums effects chain setup complete');
        break;
      }

      default:
        sampler.toDestination();
        break;
    }
  }

  public async loadMusicScore(score: MusicScore, selectedInstruments: InstrumentType[]): Promise<void> {
    this.clearCurrentParts();

    this.transport.bpm.value = score.tempo;
    console.log(`Set BPM to: ${score.tempo}`);

    console.log(`Loading instruments: ${selectedInstruments.join(', ')}`);
    await Promise.all(selectedInstruments.map(instrument => this.loadInstrument(instrument)));

    const allLoaded = selectedInstruments.every(instrument => this.isInstrumentLoaded(instrument));
    if (!allLoaded) {
      throw new Error('일부 악기 로딩에 실패했습니다.');
    }

    console.log('All instruments loaded successfully');

    const commonNotes = this.extractCommonNotes(score);
    console.log(`Found ${commonNotes.length} notes in common part (P1)`);

    // 마지막 로드된 정보 저장 (재생성을 위해)
    this.lastLoadedNotes = [...commonNotes];
    this.lastSelectedInstruments = [...selectedInstruments];

    // 음악의 총 길이 계산 (박자 단위)
    this.musicDuration = this.calculateMusicDuration(commonNotes);
    console.log(`Music duration calculated: ${this.musicDuration} beats`);

    // 🎵 예상 종료 시간 계산 및 저장
    const bpm = this.transport.bpm.value;
    const releaseMap: Record<string, number> = {
      piano: 0.5, guitar: 0.3, drums: 0.06
    };
    const result = this.calculateMusicDurationWithRelease(commonNotes, bpm, releaseMap, 0.05);
    this.expectedEndTime = result.maxEndSeconds;

    if (commonNotes.length > 0) {
      const part = this.createMultiInstrumentPart(commonNotes, selectedInstruments);
      this.currentParts.push(part);
    }

    console.log(`Music score loaded with single shared part for ${selectedInstruments.length} instruments, BPM: ${this.transport.bpm.value}`);
  }

  private extractCommonNotes(score: MusicScore): MusicNote[] {
    const notes: MusicNote[] = [];

    for (const measure of score.measures) {
      for (const note of measure.notes) {
        notes.push({
          ...note,
          instrument: note.instrument
        });
      }
    }

    return notes;
  }

  /**
   * 음악의 총 길이 계산 (실제 소리가 완전히 끝나는 시점 고려)
   */
  private calculateMusicDuration(notes: MusicNote[]): number {
    const bpm = this.transport.bpm.value;

    // 악기별 release 시간 (초 단위)
    const releaseMap: Record<string, number> = {
      piano: 0.5,    // 피아노 잔향
      guitar: 0.3,   // 기타 잔향
      drums: 0.06    // 드럼 짧은 잔향
    };

    const safetyMarginSec = 0.05; // 스케줄러 지연 고려

    const result = this.calculateMusicDurationWithRelease(notes, bpm, releaseMap, safetyMarginSec);

    // 기존 호환성을 위해 beats 값만 반환
    return result.maxEndBeats;
  }

  /**
   * 악기별 release와 스케줄링 지연을 고려한 정확한 음악 길이 계산
   */
  private calculateMusicDurationWithRelease(
    notes: MusicNote[],
    bpm: number,
    releaseMap: Record<string, number>,
    safetyMarginSec: number = 0.05
  ): { maxEndBeats: number; maxEndSeconds: number } {

    if (notes.length === 0) {
      console.log(`🎵 No notes to calculate duration`);
      return { maxEndBeats: 0, maxEndSeconds: 0 };
    }

    // 1 beat = 60/bpm 초
    const secPerBeat = 60 / bpm;

    // 안전 여유를 beats로 변환
    const safetyMarginBeats = safetyMarginSec / secPerBeat;

    let maxEndBeats = 0;
    let maxEndNote: MusicNote | null = null;

    // 각 노트의 실제 종료 시점 계산
    for (const note of notes) {
      // 악기별 release 시간 가져오기 (기본값: 0.1초)
      const instrumentKey = note.instrument.toLowerCase();
      const releaseSec = releaseMap[instrumentKey] || 0.1;

      // release를 beats로 변환
      const releaseBeats = releaseSec / secPerBeat;

      // 실제 종료 시점 = 시작 + 지속시간 + 잔향 + 안전여유
      const actualEndBeats = note.startTime + note.duration + releaseBeats + safetyMarginBeats;

      if (actualEndBeats > maxEndBeats) {
        maxEndBeats = actualEndBeats;
        maxEndNote = note;
      }
    }

    // 최종 시간을 초 단위로도 계산
    const maxEndSeconds = maxEndBeats * secPerBeat;

    // 디버깅 로그
    console.log(`🎵 Enhanced duration calculation:`);
    console.log(`  Total notes: ${notes.length}`);
    console.log(`  BPM: ${bpm}, Seconds per beat: ${secPerBeat.toFixed(4)}`);
    console.log(`  Safety margin: ${safetyMarginSec}s (${safetyMarginBeats.toFixed(4)} beats)`);
    console.log(`  Max end time: ${maxEndBeats.toFixed(4)} beats (${maxEndSeconds.toFixed(4)} seconds)`);

    if (maxEndNote) {
      const instrumentKey = maxEndNote.instrument.toLowerCase();
      const releaseSec = releaseMap[instrumentKey] || 0.1;
      const releaseBeats = releaseSec / secPerBeat;

      console.log(`  Longest note: ${maxEndNote.pitch} (${maxEndNote.instrument})`);
      console.log(`    Start: ${maxEndNote.startTime}, Duration: ${maxEndNote.duration}`);
      console.log(`    Release: ${releaseSec}s (${releaseBeats.toFixed(4)} beats)`);
      console.log(`    Total end: ${(maxEndNote.startTime + maxEndNote.duration + releaseBeats + safetyMarginBeats).toFixed(4)} beats`);
    }

    // 마지막 5개 노트의 상세 정보
    const lastNotes = notes.slice(-5);
    console.log(`  Last 5 notes analysis:`);
    lastNotes.forEach((note, index) => {
      const instrumentKey = note.instrument.toLowerCase();
      const releaseSec = releaseMap[instrumentKey] || 0.1;
      const releaseBeats = releaseSec / secPerBeat;
      const actualEnd = note.startTime + note.duration + releaseBeats + safetyMarginBeats;

      console.log(`    Note ${index + 1}: ${note.pitch} (${note.instrument})`);
      console.log(`      Start: ${note.startTime}, Duration: ${note.duration}, Release: ${releaseBeats.toFixed(4)}`);
      console.log(`      Actual end: ${actualEnd.toFixed(4)} beats`);
    });

    return {
      maxEndBeats,
      maxEndSeconds
    };
  }

  /**
   * 재생이 완료되었는지 확인 (실제 오디오 종료 시점 기준)
   */
  public isPlaybackComplete(): boolean {
    // 🎵 실제 오디오 추적 기반 완료 확인 사용
    return this.isActualPlaybackComplete();
  }

  /**
   * 음악의 총 길이 반환 (박자 단위)
   */
  public getMusicDuration(): number {
    return this.musicDuration;
  }

  /**
   * 음악의 총 길이 반환 (초 단위) - 정확한 계산 사용
   */
  public getMusicDurationInSeconds(): number {
    if (this.lastLoadedNotes.length === 0) {
      console.warn('No loaded notes for duration calculation');
      return 0;
    }

    const bpm = this.transport.bpm.value;

    // 악기별 release 시간 (초 단위)
    const releaseMap: Record<string, number> = {
      piano: 0.5,
      guitar: 0.3,
      drums: 0.06
    };

    const safetyMarginSec = 0.05;

    const result = this.calculateMusicDurationWithRelease(
      this.lastLoadedNotes,
      bpm,
      releaseMap,
      safetyMarginSec
    );

    console.log(`🎵 Accurate duration: ${result.maxEndBeats.toFixed(4)} beats = ${result.maxEndSeconds.toFixed(4)} seconds`);

    return result.maxEndSeconds;
  }

  /**
   * 🎵 재생 시작 시 실제 오디오 추적 초기화
   */
  private initializeAudioTracking(): void {
    this.songStartTime = Tone.now();
    this._lastNoteEndedAt = this.songStartTime;
    this.activeAudioNodes.clear();

    console.log(`🎵 Audio tracking initialized - Start time: ${this.songStartTime.toFixed(4)}`);
  }

  /**
   * 🎵 오디오 노드에 종료 추적 리스너 추가
   */
  private trackAudioNodeEnd(node: AudioNode | Tone.ToneAudioNode, expectedDuration: number): void {
    this.activeAudioNodes.add(node);

    // 예상 종료 시간 계산
    const expectedEndTime = Tone.now() + expectedDuration;

    // AudioBufferSourceNode의 경우
    if (node instanceof AudioBufferSourceNode) {
      node.onended = () => {
        const actualEndTime = Tone.now();
        if (actualEndTime > this._lastNoteEndedAt) {
          this._lastNoteEndedAt = actualEndTime;
          console.log(`🎵 Audio node ended at: ${actualEndTime.toFixed(4)} (expected: ${expectedEndTime.toFixed(4)})`);
        }
        this.activeAudioNodes.delete(node);
      };
    } else {
      // Tone.js 노드의 경우 예상 시간으로 추적
      setTimeout(() => {
        const actualEndTime = Tone.now();
        if (actualEndTime > this._lastNoteEndedAt) {
          this._lastNoteEndedAt = actualEndTime;
          console.log(`🎵 Tone node ended at: ${actualEndTime.toFixed(4)} (expected: ${expectedEndTime.toFixed(4)})`);
        }
        this.activeAudioNodes.delete(node);
      }, expectedDuration * 1000);
    }
  }

  /**
   * 🎵 실제 재생 완료 여부 확인 (실제 오디오 종료 기준)
   */
  public isActualPlaybackComplete(): boolean {
    if (this.songStartTime === 0) return false;

    const currentTime = Tone.now();
    const elapsedTime = currentTime - this.songStartTime;

    // 1. 모든 활성 노드가 종료되었는지 확인
    const allNodesEnded = this.activeAudioNodes.size === 0;

    // 2. 마지막 음표 종료 시간이 현재 시간을 넘었는지 확인
    const lastNoteCompleted = this._lastNoteEndedAt <= currentTime;

    // 3. 예상 시간을 충분히 넘었는지 확인 (안전장치)
    const expectedTimeExceeded = elapsedTime >= (this.expectedEndTime + 0.1); // 0.1초 여유

    const isComplete = allNodesEnded && (lastNoteCompleted || expectedTimeExceeded);

    // 진행 상황 로깅 (90% 이상일 때만)
    if (elapsedTime > this.expectedEndTime * 0.9) {
      console.log(`🎵 Actual playback progress:`);
      console.log(`  Elapsed: ${elapsedTime.toFixed(4)}s / Expected: ${this.expectedEndTime.toFixed(4)}s`);
      console.log(`  Last note ended: ${this._lastNoteEndedAt.toFixed(4)}s`);
      console.log(`  Active nodes: ${this.activeAudioNodes.size}`);
      console.log(`  Complete: ${isComplete}`);
    }

    if (isComplete) {
      console.log(`🎵 Actual playback complete!`);
      console.log(`  Total elapsed: ${elapsedTime.toFixed(4)}s`);
      console.log(`  Expected duration: ${this.expectedEndTime.toFixed(4)}s`);
      console.log(`  Last note ended at: ${this._lastNoteEndedAt.toFixed(4)}s`);
    }

    return isComplete;
  }

  /**
   * 🎵 실제 재생 진행률 계산 (실제 오디오 기준)
   */
  public getActualPlaybackProgress(): number {
    if (this.songStartTime === 0 || this.expectedEndTime === 0) return 0;

    const currentTime = Tone.now();
    const elapsedTime = currentTime - this.songStartTime;

    // 실제 진행률 = 경과시간 / 예상 총 시간
    const progress = Math.min(1.0, elapsedTime / this.expectedEndTime);

    return progress;
  }

  /**
   * Part들을 다시 생성 (정지 후 재생을 위해)
   */
  private recreateParts(): void {
    if (this.lastLoadedNotes.length === 0 || this.lastSelectedInstruments.length === 0) {
      console.warn('No previous music data to recreate parts');
      return;
    }

    // 기존 Part들 정리
    this.clearCurrentParts();

    // 새로운 Part 생성
    const part = this.createMultiInstrumentPart(this.lastLoadedNotes, this.lastSelectedInstruments);
    this.currentParts.push(part);

    console.log('🔄 Parts recreated for fresh playback');
  }

  private createMultiInstrumentPart(notes: MusicNote[], selectedInstruments: InstrumentType[]): Tone.Part {
    const playableNotes = notes.filter(note => note.pitch !== 'REST');
    playableNotes.sort((a, b) => a.startTime - b.startTime);

    console.log(`Creating multi-instrument part with ${playableNotes.length} playable notes for instruments: ${selectedInstruments.join(', ')}`);

    // Tone.Part를 사용하여 안전하게 스케줄링
    const partEvents = playableNotes.map(note => {
      // startTime은 이미 박자 단위로 계산되어 있음
      // Tone.js는 박자 단위 시간을 자동으로 BPM에 맞춰 변환함
      const timeInBeats = `${note.startTime}`;

      return {
        time: timeInBeats, // 박자 단위 시간 (예: "0", "1", "2.5")
        note: note,
        duration: note.duration, // 박자 단위 duration 유지
        instruments: selectedInstruments
      };
    });

    console.log(`Part events created:`, partEvents.slice(0, 5).map(e => ({
      time: e.time,
      pitch: e.note.pitch,
      duration: e.duration
    })));

    const part = new Tone.Part((time, event) => {
      const velocity = Math.max(0.1, Math.min(1.0, event.note.velocity / 127));

      console.log(`🎵 Playing note ${event.note.pitch} at time ${time} for instruments: ${event.instruments.join(', ')}`);
      event.instruments.forEach((instrument: InstrumentType) => {
        console.log(`🎼 Attempting to play ${event.note.pitch} on ${instrument}`);

        if (instrument === InstrumentType.DRUMS) {
          // 드럼은 Transport 시간과 정확히 동기화
          if (event.note.midi !== undefined) {
            this.playDrumNote(event.note.midi.toString(), time, velocity);
          } else {
            this.playDrumNote(event.note.pitch, time, velocity);
          }
        } else {
          // 일반 악기는 기존 방식 유지
          const bpm = this.transport.bpm.value;
          const secondsPerBeat = 60 / bpm;
          const durationInSeconds = event.duration * secondsPerBeat;

          this.playNoteForInstrument(instrument, event.note.pitch, durationInSeconds, time, velocity);
        }
      });
    }, partEvents);

    // Part는 생성만 하고 시작하지 않음 (play() 호출 시에만 시작)
    return part;
  }

  /**
   * 특정 악기로 음표 재생 (드럼 매핑 포함) + 실제 오디오 추적
   */
  private playNoteForInstrument(instrumentType: InstrumentType, pitch: string, duration: number, time: number, velocity: number): void {
    console.log(`🎵 playNoteForInstrument called: ${instrumentType}, ${pitch}`);

    if (instrumentType === InstrumentType.DRUMS) {
      this.playDrumNoteWithTracking(pitch, time, velocity, duration);
      return;
    }

    // 일반 악기 처리
    const sampler = this.samplers.get(instrumentType);
    if (!sampler) {
      console.error(`❌ Sampler for ${instrumentType} not found! Available samplers:`, Array.from(this.samplers.keys()));
      return;
    }

    console.log(`✅ Found sampler for ${instrumentType}, playing ${pitch}`);

    try {
      // 🎵 악기별 release 시간 계산
      const releaseMap: Record<string, number> = {
        piano: 0.5, guitar: 0.3, drums: 0.06
      };
      const instrumentKey = instrumentType.toLowerCase();
      const releaseTime = releaseMap[instrumentKey] || 0.1;
      const totalDuration = duration + releaseTime;

      // Tone.js 샘플러로 재생
      sampler.triggerAttackRelease(pitch, duration, time, velocity);

      // 🎵 오디오 노드 추적 (Tone.js 노드는 직접 추적이 어려우므로 예상 시간으로 추적)
      this.trackAudioNodeEnd(sampler as any, totalDuration);

      console.log(`🎶 Successfully triggered ${pitch} on ${instrumentType} (duration: ${duration}s, release: ${releaseTime}s)`);
    } catch (error) {
      console.error(`❌ Failed to play note ${pitch} on ${instrumentType}:`, error);
    }
  }

  /**
   * 🎵 드럼 음표 재생 + 오디오 추적 (합성 드럼 전용 + 멜로디 음 자동 변환)
   */
  private playDrumNoteWithTracking(pitch: string, time: number, velocity: number, duration: number): void {
    console.log(`🎛️ Playing synthetic drum with tracking: ${pitch} at transport time ${time} with velocity ${velocity}`);

    // Transport 시간을 AudioContext 시간으로 변환
    const relativeTime = time - Tone.now();

    // 🎵 드럼별 예상 지속시간 (초)
    const drumDurations: Record<string, number> = {
      'snare': 0.2,
      'kick': 0.6,
      'hihat': 0.1,
      'hihat_open': 0.3,
      'tom': 0.4,
      'crash': 2.0
    };

    let audioNode: AudioBufferSourceNode | null = null;
    let drumType = '';

    // 1. 먼저 직접적인 드럼 이름으로 시도 (snare, kick 등)
    audioNode = this.playSynthDrumByNameWithTracking(pitch, relativeTime, velocity);
    if (audioNode) {
      drumType = pitch.toLowerCase();
    } else {
      // 2. 멜로디 음(C4, D#5 등)을 드럼으로 자동 변환
      const convertedDrumName = MelodyToDrumMapper.convertPitchToDrum(pitch);
      if (convertedDrumName) {
        console.log(`🎵→🥁 Auto-converted melody pitch ${pitch} to drum: ${convertedDrumName}`);
        audioNode = this.playSynthDrumByNameWithTracking(convertedDrumName, relativeTime, velocity);
        drumType = convertedDrumName;
      } else {
        // 3. MIDI 번호 기반 매핑 시도
        let midiNumber: number;
        if (/^\d+$/.test(pitch)) {
          midiNumber = parseInt(pitch, 10);
        } else {
          midiNumber = this.pitchToMidiNumber(pitch);
        }

        // MIDI 번호를 드럼 타입으로 매핑하여 합성 드럼 재생
        const drumSample = DrumMidiMapper.getSampleName(midiNumber);
        if (drumSample) {
          console.log(`🎛️ MIDI ${midiNumber} mapped to synthetic ${drumSample}`);
          audioNode = this.playSynthDrumByNameWithTracking(drumSample, relativeTime, velocity);
          drumType = drumSample;
        }
      }
    }

    // 🎵 오디오 노드 추적
    if (audioNode && drumType) {
      const expectedDuration = drumDurations[drumType] || 0.1;
      this.trackAudioNodeEnd(audioNode, expectedDuration);
      console.log(`🎵 Tracking drum audio node: ${drumType}, expected duration: ${expectedDuration}s`);
    } else {
      console.warn(`⚠️ No drum mapping found for pitch: ${pitch} - skipping playback`);
    }
  }

  /**
   * 레거시 드럼 재생 메서드 (추적 없음)
   */
  private playDrumNote(pitch: string, time: number, velocity: number): void {
    // 추적 기능이 있는 버전으로 리다이렉트
    this.playDrumNoteWithTracking(pitch, time, velocity, 0.1);
  }

  /**
   * 🎵 합성 드럼을 이름으로 재생 + 오디오 노드 반환 (Transport 동기화)
   */
  private playSynthDrumByNameWithTracking(pitch: string, time: number, velocity: number): AudioBufferSourceNode | null {
    const normalizedVelocity = Math.max(0.1, Math.min(1.0, velocity));
    const pitchLower = pitch.toLowerCase();

    // Transport와 동기화된 시간으로 재생
    const playTime = time;

    switch (pitchLower) {
      case 'snare':
      case 'snare_drum':
      case 'sd':
        const snareNode = SynthDrumGenerator.playSnare(playTime, normalizedVelocity);
        console.log(`🎛️ Played synthetic snare for pitch: ${pitch} at transport time: ${playTime}`);
        return snareNode;

      case 'kick':
      case 'kick_drum':
      case 'bass_drum':
      case 'bd':
        // 킥 드럼은 여러 오실레이터를 사용하므로 추적이 복잡함 - 예상 시간으로 처리
        SynthDrumGenerator.playKick(playTime, normalizedVelocity);
        console.log(`🎛️ Played synthetic kick for pitch: ${pitch} at transport time: ${playTime}`);
        return null; // 복합 노드는 null 반환

      case 'hihat':
      case 'hihat_closed':
      case 'closed_hihat':
      case 'hh':
        // 하이햇도 버퍼 소스 노드 반환하도록 수정 필요
        SynthDrumGenerator.playHihat(playTime, normalizedVelocity, false);
        console.log(`🎛️ Played synthetic closed hihat for pitch: ${pitch} at transport time: ${playTime}`);
        return null; // 현재는 null, 나중에 수정 가능

      case 'hihat_open':
      case 'open_hihat':
      case 'oh':
        SynthDrumGenerator.playHihat(playTime, normalizedVelocity, true);
        console.log(`🎛️ Played synthetic open hihat for pitch: ${pitch} at transport time: ${playTime}`);
        return null;

      case 'tom':
      case 'tom_drum':
        SynthDrumGenerator.playTom(playTime, normalizedVelocity);
        console.log(`🎛️ Played synthetic tom for pitch: ${pitch} at transport time: ${playTime}`);
        return null;

      case 'crash':
      case 'crash_cymbal':
        SynthDrumGenerator.playCrash(playTime, normalizedVelocity);
        console.log(`🎛️ Played synthetic crash for pitch: ${pitch} at transport time: ${playTime}`);
        return null;

      default:
        console.warn(`🎛️ Unknown synthetic drum type: ${pitch}`);
        return null;
    }
  }

  /**
   * 합성 드럼을 이름으로 재생 (Transport 동기화) - 레거시
   */
  private playSynthDrumByName(pitch: string, time: number, velocity: number): boolean {
    const audioNode = this.playSynthDrumByNameWithTracking(pitch, time, velocity);
    return audioNode !== null;
  }

  public async play(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('AudioEngine is not initialized');
    }

    // 오디오 컨텍스트 상태 확인 및 재개
    if (Tone.context.state === 'suspended') {
      console.log('🔊 Resuming suspended audio context...');
      await Tone.context.resume();
    }

    // Transport가 정지 상태라면 Part들을 다시 생성
    if (this.transport.state === 'stopped') {
      this.transport.position = 0;
      this.recreateParts();
    }

    // 🎵 실제 오디오 추적 초기화
    this.initializeAudioTracking();

    // 모든 Part 시작
    this.currentParts.forEach(part => {
      if (part.state === 'stopped') {
        part.start(0);
      }
    });

    // Transport 시작
    this.transport.start();

    console.log(`🎵 Started playback with audio tracking, music duration: ${this.musicDuration} beats, parts: ${this.currentParts.length}, context state: ${Tone.context.state}`);
  }

  public pause(): void {
    this.transport.pause();
  }

  public stop(): void {
    // Transport 정지 및 위치 초기화
    this.transport.stop();
    this.transport.position = 0;

    // 스케줄된 모든 이벤트 취소
    this.transport.cancel();

    // Part들 정리 (다음 재생을 위해)
    this.currentParts.forEach(part => {
      part.stop();
    });

    // 🎵 오디오 추적 초기화
    this.songStartTime = 0;
    this._lastNoteEndedAt = 0;
    this.activeAudioNodes.clear();

    console.log(`🛑 Stopped playback with audio tracking reset, transport position reset to 0, parts stopped`);
  }

  public setTempo(bpm: number): void {
    this.transport.bpm.value = bpm;
  }

  public getTempo(): number {
    return this.transport.bpm.value;
  }

  public getCurrentTime(): number {
    return this.transport.seconds;
  }

  public setPosition(seconds: number): void {
    this.transport.seconds = seconds;
  }

  public getPlaybackState(): 'started' | 'paused' | 'stopped' {
    return this.transport.state;
  }

  public async playNote(instrumentType: InstrumentType, pitch: string, duration: string | number = '8n', velocity: number = 0.8): Promise<void> {
    if (instrumentType === InstrumentType.DRUMS) {
      this.playDrumNote(pitch, Tone.now(), velocity);
      return;
    }

    if (!this.isInstrumentLoaded(instrumentType)) {
      console.warn(`${instrumentType} is not loaded yet`);
      return;
    }

    const sampler = this.samplers.get(instrumentType);
    if (!sampler) {
      console.error(`Sampler for ${instrumentType} not found`);
      return;
    }

    try {
      sampler.triggerAttackRelease(pitch, duration, undefined, velocity);
      console.log(`${instrumentType} note played: ${pitch}, duration: ${duration}`);
    } catch (error) {
      console.error(`Failed to play note ${pitch} on ${instrumentType}:`, error);
    }
  }

  /**
   * 합성 드럼 직접 재생 메서드들
   */
  public async playSynthSnare(velocity: number = 0.8): Promise<void> {
    SynthDrumGenerator.playSnare(0, velocity);
  }

  public async playSynthKick(velocity: number = 0.8): Promise<void> {
    SynthDrumGenerator.playKick(0, velocity);
  }

  public async playSynthHihat(open: boolean = false, velocity: number = 0.8): Promise<void> {
    SynthDrumGenerator.playHihat(0, velocity, open);
  }

  public async playSynthTom(velocity: number = 0.8): Promise<void> {
    SynthDrumGenerator.playTom(0, velocity);
  }

  public async playSynthCrash(velocity: number = 0.8): Promise<void> {
    SynthDrumGenerator.playCrash(0, velocity);
  }

  public async playGuitarChord(notes: string[], duration: string | number = '2n', velocity: number = 0.7): Promise<void> {
    if (!this.isInstrumentLoaded(InstrumentType.GUITAR)) {
      console.warn('Guitar is not loaded yet');
      return;
    }

    const guitarSampler = this.samplers.get(InstrumentType.GUITAR);
    if (!guitarSampler) {
      console.error('Guitar sampler not found');
      return;
    }

    try {
      notes.forEach((note, index) => {
        setTimeout(() => {
          guitarSampler.triggerAttackRelease(note, duration, undefined, velocity);
        }, index * 10);
      });

      console.log(`Guitar chord played: [${notes.join(', ')}], duration: ${duration}`);
    } catch (error) {
      console.error(`Failed to play guitar chord:`, error);
    }
  }

  private clearCurrentParts(): void {
    this.currentParts.forEach(part => {
      part.stop();
      part.dispose();
    });
    this.currentParts = [];

    Tone.Transport.cancel();
    console.log('Cleared all scheduled events and parts');
  }

  public dispose(): void {
    this.clearCurrentParts();
    this.samplers.forEach(sampler => sampler.dispose());
    this.samplers.clear();

    if (this.drumPlayers) {
      this.drumPlayers.dispose();
      this.drumPlayers = null;
    }

    this.transport.stop();
    this.transport.cancel();
    this.isInitialized = false;
  }

  public static checkWebAudioSupport(): boolean {
    return !!(window.AudioContext || (window as unknown).webkitAudioContext);
  }

  public async resumeContext(): Promise<void> {
    if (Tone.context.state === 'suspended') {
      await Tone.context.resume();
    }
  }

  // 디버깅용 메서드들
  public getDrumMappingTable(): { [key: string]: string } {
    const table: { [key: string]: string } = {};
    DrumMidiMapper.getAllSupportedMidiNotes().forEach(midiNum => {
      const sample = DrumMidiMapper.getSampleName(midiNum);
      const pitchName = this.midiNumberToPitch(midiNum);
      if (sample) {
        table[pitchName] = sample;
      }
    });
    return table;
  }

  public getMelodyToDrumMappingTable(): { [key: string]: string } {
    return MelodyToDrumMapper.getMappingTable();
  }

  private midiNumberToPitch(midiNumber: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;
    return noteNames[noteIndex] + octave;
  }
}