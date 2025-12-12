// OCR 처리 상태
export enum OCRStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 악기 타입
export enum InstrumentType {
  PIANO = 'piano',
  GUITAR = 'guitar',
  DRUMS = 'drums'
}

// 음표 정보
export interface MusicNote {
  pitch: string;        // 음 높이 (C4, D#5 등)
  duration: number;     // 음표 길이 (1=온음표, 0.5=2분음표 등)
  startTime: number;    // 시작 시간 (박자 단위)
  velocity: number;     // 음량 (0-127)
  instrument: InstrumentType;
}

// 마디 정보
export interface Measure {
  number: number;
  timeSignature: string; // 4/4, 3/4 등
  notes: MusicNote[];
}

// 악보 전체 정보
export interface MusicScore {
  title?: string;
  tempo: number;        // BPM
  measures: Measure[];
  instruments: InstrumentType[];
}

// OCR 작업 정보
export interface OCRJob {
  jobId: string;
  fileName: string;
  status: OCRStatus;
  progress: number;
  result?: MusicScore;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// PDF 처리 결과
export interface PDFProcessResult {
  text: string;
  images: Buffer[];
  metadata: {
    pageCount: number;
    title?: string;
    author?: string;
  };
}

// 음표 인식 결과
export interface NoteRecognitionResult {
  notes: MusicNote[];
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// 파일 타입
export enum FileType {
  PDF = 'pdf',
  XML = 'xml',
  MUSICXML = 'musicxml'
}

// OCR 처리 옵션
export interface OCRProcessOptions {
  enableImageProcessing: boolean;
  confidenceThreshold: number;
  maxProcessingTime: number;
  outputFormat: 'json' | 'midi';
  fileType: FileType;
}

// MusicXML 파싱 결과
export interface MusicXMLParseResult {
  score: MusicScore;
  metadata: {
    title?: string;
    composer?: string;
    software?: string;
    encoding?: string;
  };
}