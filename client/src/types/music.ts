// 악기 타입 정의
export enum InstrumentType {
  PIANO = 'piano',
  GUITAR = 'guitar',
  DRUMS = 'drums'
}

// 기타 코드 정의
export interface GuitarChord {
  name: string;           // 코드명 (C, Am, F 등)
  frets: number[];        // 각 줄의 프렛 번호 (0=개방현, -1=뮤트)
  fingers: number[];      // 각 줄을 누르는 손가락 번호
  notes: string[];        // 코드를 구성하는 음표들
}

// 기타 전용 설정
export interface GuitarSettings {
  tuning: string[];       // 기타 튜닝 (표준: E-A-D-G-B-E)
  capo: number;          // 카포 위치 (0=없음)
  playStyle: 'fingerpicking' | 'strumming' | 'hybrid';
}

// 음표 정보 인터페이스
export interface MusicNote {
  pitch: string;        // 음 높이 (C4, D#5 등)
  duration: number;     // 음표 길이 (1=온음표, 0.5=2분음표 등)
  startTime: number;    // 시작 시간 (박자 단위)
  velocity: number;     // 음량 (0-127)
  instrument: InstrumentType; // 원본 악기 정보 (실제 재생 시에는 선택된 악기들로 재생)
  midi?: number;        // MIDI 노트 번호 (드럼 매핑용)
}

// 마디 정보 인터페이스
export interface Measure {
  number: number;
  timeSignature: string; // 4/4, 3/4 등
  notes: MusicNote[];
}

// 악보 전체 정보 인터페이스
export interface MusicScore {
  title?: string;
  tempo: number;        // BPM
  measures: Measure[];  // 단일 공통 파트(P1)의 마디들
  instruments: InstrumentType[]; // 사용 가능한 악기 목록 (실제 재생 시 선택)
}

// 드럼 샘플 URL 인터페이스
export interface DrumSampleUrls {
  kick: string;
  snare: string;
  hihat_closed: string;
  hihat_open: string;
  tom: string;
  crash: string;
}

// 드럼 MIDI 매핑 인터페이스
export interface DrumMidiMapping {
  [midiNote: number]: keyof DrumSampleUrls;
}

// 악기 설정 인터페이스
export interface InstrumentConfig {
  type: InstrumentType;
  soundFontUrl?: string;        // 드럼의 경우 선택사항
  sampleUrls?: DrumSampleUrls;  // 드럼 전용
  midiChannel: number;
  enabled: boolean;
}

// OCR 처리 상태
export enum OCRStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// OCR 작업 정보
export interface OCRJob {
  jobId: string;
  status: OCRStatus;
  progress: number;
  result?: MusicScore;
  error?: string;
}

// 오류 타입 정의
export enum ErrorType {
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  OCR_PROCESSING_ERROR = 'OCR_PROCESSING_ERROR',
  AUDIO_LOADING_ERROR = 'AUDIO_LOADING_ERROR',
  PLAYBACK_ERROR = 'PLAYBACK_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

// 애플리케이션 오류 인터페이스
export interface AppError {
  type: ErrorType;
  message: string;
  details?: unknown;
  timestamp: Date;
}

// 재생 상태
export enum PlaybackState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused',
  LOADING = 'loading'
}

// 오디오 플레이어 상태
export interface AudioPlayerState {
  playbackState: PlaybackState;
  currentMeasure: number;
  currentTime: number;
  duration: number;
  tempo: number;
}

// 파일 업로드 상태
export interface FileUploadState {
  file: File | null;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

// 가상악기 페이지 전체 상태
export interface VirtualInstrumentsState {
  uploadedFile: File | null;
  musicScore: MusicScore | null;
  selectedInstruments: InstrumentType[];
  isPlaying: boolean;
  currentMeasure: number;
  tempo: number;
  ocrProgress: number;
  isLoading: boolean;
  error: string | null;
  audioPlayerState: AudioPlayerState;
  fileUploadState: FileUploadState;
}

// API 응답 타입
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// OCR API 응답
export interface OCRResponse extends APIResponse<OCRJob> {}

// 파일 업로드 API 응답
export interface FileUploadResponse extends APIResponse<{
  jobId: string;
  fileName: string;
  fileSize: number;
}> {}

// 음표 데이터 변환 유틸리티 타입
export interface NoteConversionOptions {
  defaultTempo?: number;
  defaultTimeSignature?: string;
  instrumentMapping?: Record<string, InstrumentType>;
}

// SoundFont 로딩 상태
export type SoundFontLoadingState = {
  [key in InstrumentType]?: {
    isLoading: boolean;
    isLoaded: boolean;
    error?: string;
  }
}

// 템포 프리셋
export interface TempoPreset {
  name: string;
  bpm: number;
  description: string;
}

// 기본 템포 프리셋들
export const DEFAULT_TEMPO_PRESETS: TempoPreset[] = [
  { name: '느림', bpm: 60, description: 'Largo' },
  { name: '보통', bpm: 120, description: 'Moderato' },
  { name: '빠름', bpm: 160, description: 'Allegro' }
];

// 지원되는 파일 형식
export const SUPPORTED_FILE_FORMATS = {
  PDF: 'application/pdf',
  XML: 'application/xml',
  MUSICXML: 'application/vnd.recordare.musicxml+xml',
  TEXT_XML: 'text/xml',
  JSON: 'application/json'
} as const;

// 파일 크기 제한 (바이트)
export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// 드럼 샘플 URL 상수
export const DRUM_SAMPLE_URLS: DrumSampleUrls = {
  kick: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Kick_1.wav',
  snare: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Snare_1.wav',
  hihat_closed: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Closed-Hi-Hat.wav',
  hihat_open: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Open-Hi-Hat.wav',
  tom: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Tom-Drum.wav',
  crash: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Cymbal_Crash.wav'
};

// 드럼 MIDI 매핑 테이블
export const DRUM_MIDI_MAP: DrumMidiMapping = {
  36: 'kick',
  38: 'snare',
  42: 'hihat_closed',
  46: 'hihat_open',
  45: 'tom',
  49: 'crash'
};

// 합성 드럼 타입 정의
export type SynthDrumType = 'snare' | 'kick' | 'hihat' | 'hihat_open' | 'hihat_closed';

// 합성 드럼 이름 매핑
export const SYNTH_DRUM_NAMES: Record<string, SynthDrumType> = {
  'snare': 'snare',
  'snare_drum': 'snare',
  'sd': 'snare',
  'kick': 'kick',
  'kick_drum': 'kick',
  'bass_drum': 'kick',
  'bd': 'kick',
  'hihat': 'hihat_closed',
  'hihat_closed': 'hihat_closed',
  'closed_hihat': 'hihat_closed',
  'hh': 'hihat_closed',
  'hihat_open': 'hihat_open',
  'open_hihat': 'hihat_open',
  'oh': 'hihat_open'
};

// 기본 설정값들
export const DEFAULT_SETTINGS = {
  TEMPO: 120,
  VOLUME: 0.7,
  MIN_TEMPO: 40,
  MAX_TEMPO: 200,
  OCR_TIMEOUT: 300000, // 5분
  AUDIO_BUFFER_SIZE: 4096
} as const;