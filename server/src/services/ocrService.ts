const pdfParse = require('pdf-parse');
import * as xml2js from 'xml2js';
import { 
  OCRJob, 
  OCRStatus, 
  MusicScore, 
  MusicNote, 
  Measure, 
  InstrumentType,
  PDFProcessResult,
  NoteRecognitionResult,
  FileType
} from '../types/ocr';

export class OCRService {
  private jobs: Map<string, OCRJob> = new Map();
  private processingQueue: string[] = [];
  private isProcessing = false;

  constructor() {
    // 주기적으로 큐 처리
    setInterval(() => {
      this.processQueue();
    }, 1000);
  }

  public startOCRJob(jobId: string, fileName: string, fileBuffer: Buffer, fileType: FileType = FileType.PDF): void {
    const job: OCRJob = {
      jobId,
      fileName,
      status: OCRStatus.PENDING,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.jobs.set(jobId, job);
    this.processingQueue.push(jobId);
    
    console.log(`[OCR] Job ${jobId} queued for processing`);
    
    // 비동기로 처리 시작
    this.processOCRJob(jobId, fileBuffer, fileType);
  }

  public getJob(jobId: string): OCRJob | undefined {
    return this.jobs.get(jobId);
  }

  public getAllJobs(): OCRJob[] {
    return Array.from(this.jobs.values());
  }

  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === OCRStatus.COMPLETED || job.status === OCRStatus.FAILED) {
      return false;
    }

    job.status = OCRStatus.FAILED;
    job.error = '사용자에 의해 취소됨';
    job.updatedAt = new Date();

    // 큐에서 제거
    const queueIndex = this.processingQueue.indexOf(jobId);
    if (queueIndex !== -1) {
      this.processingQueue.splice(queueIndex, 1);
    }

    console.log(`[OCR] Job ${jobId} cancelled`);
    return true;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const jobId = this.processingQueue.shift();
    
    if (jobId) {
      const job = this.jobs.get(jobId);
      if (job && job.status === OCRStatus.PENDING) {
        console.log(`[OCR] Processing job ${jobId}`);
      }
    }

    this.isProcessing = false;
  }

  private async processOCRJob(jobId: string, fileBuffer: Buffer, fileType: FileType): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      // 상태를 처리 중으로 변경
      this.updateJobStatus(jobId, OCRStatus.PROCESSING, 10);

      let musicScore: MusicScore;

      if (fileType === FileType.PDF) {
        // PDF 처리 로직
        console.log(`[OCR] Step 1: Parsing PDF for job ${jobId}`);
        const pdfResult = await this.parsePDF(fileBuffer);
        this.updateJobStatus(jobId, OCRStatus.PROCESSING, 30);

        console.log(`[OCR] Step 2: Recognizing notes for job ${jobId}`);
        await this.simulateDelay(2000);
        this.updateJobStatus(jobId, OCRStatus.PROCESSING, 60);

        console.log(`[OCR] Step 3: Converting notes for job ${jobId}`);
        musicScore = await this.convertToMusicScore(pdfResult);
        this.updateJobStatus(jobId, OCRStatus.PROCESSING, 90);
      } else {
        // XML/MusicXML 처리 로직
        console.log(`[OCR] Step 1: Parsing XML for job ${jobId}`);
        this.updateJobStatus(jobId, OCRStatus.PROCESSING, 30);

        console.log(`[OCR] Step 2: Converting XML to MusicScore for job ${jobId}`);
        musicScore = await this.parseXML(fileBuffer);
        this.updateJobStatus(jobId, OCRStatus.PROCESSING, 90);
      }

      // 4단계: 완료
      console.log(`[OCR] Step 4: Finalizing job ${jobId}`);
      await this.simulateDelay(500);
      
      job.result = musicScore;
      job.status = OCRStatus.COMPLETED;
      job.progress = 100;
      job.updatedAt = new Date();

      console.log(`[OCR] Job ${jobId} completed successfully`);

    } catch (error) {
      console.error(`[OCR] Job ${jobId} failed:`, error);
      
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // 구체적인 오류 타입별 메시지
        if (error.message.includes('PDF 파싱')) {
          errorMessage = 'PDF 파일을 읽는 중 오류가 발생했습니다. 파일이 손상되었거나 암호화되어 있을 수 있습니다.';
        } else if (error.message.includes('XML 파싱')) {
          errorMessage = 'XML 파일 형식이 올바르지 않습니다. 유효한 MusicXML 파일인지 확인해주세요.';
        } else if (error.message.includes('유효한 MusicXML')) {
          errorMessage = '올바른 MusicXML 형식이 아닙니다. score-partwise 또는 score-timewise 요소가 필요합니다.';
        } else if (error.message.includes('메모리')) {
          errorMessage = '파일이 너무 커서 처리할 수 없습니다. 더 작은 파일을 사용해주세요.';
        } else if (error.message.includes('시간 초과')) {
          errorMessage = '처리 시간이 초과되었습니다. 파일 크기를 줄이거나 다시 시도해주세요.';
        }
      }
      
      job.status = OCRStatus.FAILED;
      job.error = errorMessage;
      job.updatedAt = new Date();
    }
  }

  private updateJobStatus(jobId: string, status: OCRStatus, progress: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.progress = progress;
      job.updatedAt = new Date();
    }
  }

  private async parsePDF(fileBuffer: Buffer): Promise<PDFProcessResult> {
    try {
      const data = await pdfParse(fileBuffer);
      
      return {
        text: data.text,
        images: [], // 실제 구현에서는 이미지 추출 필요
        metadata: {
          pageCount: data.numpages,
          title: data.info?.Title,
          author: data.info?.Author
        }
      };
    } catch (error) {
      throw new Error('PDF 파싱에 실패했습니다: ' + (error as Error).message);
    }
  }

  private async parseXML(fileBuffer: Buffer): Promise<MusicScore> {
    try {
      const xmlString = fileBuffer.toString('utf-8');
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(xmlString);
      
      console.log('[OCR] XML parsed successfully');
      
      // MusicXML 파싱
      return this.convertMusicXMLToScore(result);
    } catch (error) {
      throw new Error('XML 파싱에 실패했습니다: ' + (error as Error).message);
    }
  }

  private convertMusicXMLToScore(xmlData: any): MusicScore {
    // MusicXML 구조를 MusicScore로 변환
    const scorePartwise = xmlData['score-partwise'] || xmlData['score-timewise'];
    
    if (!scorePartwise) {
      throw new Error('유효한 MusicXML 파일이 아닙니다.');
    }

    const title = scorePartwise.work?.[0]?.['work-title']?.[0] || '제목 없음';
    const tempo = this.extractTempo(scorePartwise) || 120;
    
    const measures = this.extractMeasures(scorePartwise);
    const instruments = this.extractInstruments(scorePartwise);

    return {
      title,
      tempo,
      measures,
      instruments
    };
  }

  private extractTempo(scoreData: any): number {
    // MusicXML에서 템포 정보 추출
    try {
      const parts = scoreData.part || [];
      for (const part of parts) {
        const measures = part.measure || [];
        for (const measure of measures) {
          const directions = measure.direction || [];
          for (const direction of directions) {
            const metronome = direction['direction-type']?.[0]?.metronome?.[0];
            if (metronome && metronome['per-minute']) {
              return parseInt(metronome['per-minute'][0]);
            }
          }
        }
      }
    } catch (error) {
      console.warn('템포 추출 실패, 기본값 사용:', error);
    }
    return 120; // 기본 템포
  }

  private extractMeasures(scoreData: any): Measure[] {
    const measures: Measure[] = [];
    
    try {
      const parts = scoreData.part || [];
      if (parts.length === 0) return measures;

      const firstPart = parts[0];
      const measureElements = firstPart.measure || [];
      
      // divisions 값 추출 (음표 길이 계산용)
      const divisions = this.extractDivisions(scoreData);

      // 전체 곡에서 누적 시간 추적
      let globalTime = 0;

      measureElements.forEach((measureElement: any, index: number) => {
        const { notes, measureDuration } = this.extractNotesFromMeasure(
          measureElement, 
          parts, 
          index, 
          globalTime,
          divisions
        );
        const timeSignature = this.extractTimeSignature(measureElement) || '4/4';

        measures.push({
          number: index + 1,
          timeSignature,
          notes
        });

        // 다음 마디를 위해 전역 시간 업데이트
        globalTime += measureDuration;
      });
    } catch (error) {
      console.error('마디 추출 실패:', error);
    }

    return measures;
  }

  private extractNotesFromMeasure(
    measureElement: any, 
    allParts: any[], 
    measureIndex: number, 
    globalStartTime: number,
    divisions: number
  ): { notes: MusicNote[], measureDuration: number } {
    const notes: MusicNote[] = [];
    let maxMeasureDuration = 0;

    try {
      // 첫 번째 파트만 처리 (단선율 가정)
      const firstPart = allParts[0];
      const partMeasure = firstPart?.measure?.[measureIndex];
      
      if (!partMeasure) {
        return { notes: [], measureDuration: 0 };
      }

      const noteElements = partMeasure.note || [];
      let currentTimeInMeasure = 0;
      
      console.log(`Processing measure ${measureIndex + 1} with ${noteElements.length} notes, globalStartTime: ${globalStartTime}`);
      
      noteElements.forEach((noteElement: any, noteIndex: number) => {
        const note = this.parseNoteElement(
          noteElement, 
          globalStartTime + currentTimeInMeasure, 
          0, // 첫 번째 파트만 사용
          divisions
        );
        
        if (note) {
          console.log(`Note ${noteIndex}: ${note.pitch}, startTime: ${note.startTime}, duration: ${note.duration}`);
          notes.push(note);
          
          // REST 음표도 시간을 진행시킴
          currentTimeInMeasure += note.duration;
        }
      });

      maxMeasureDuration = currentTimeInMeasure;
      console.log(`Measure ${measureIndex + 1} duration: ${maxMeasureDuration}`);
      
    } catch (error) {
      console.error('음표 추출 실패:', error);
    }

    return { notes, measureDuration: maxMeasureDuration };
  }

  private parseNoteElement(
    noteElement: any, 
    startTime: number, 
    partIndex: number,
    divisions: number
  ): MusicNote | null {
    try {
      const duration = this.extractDuration(noteElement, divisions);
      
      // 쉼표인 경우
      if (noteElement.rest) {
        return {
          pitch: 'REST',
          duration,
          startTime,
          velocity: 0,
          instrument: this.mapPartToInstrument(partIndex)
        };
      }

      const pitch = this.extractPitch(noteElement);
      const velocity = this.extractVelocity(noteElement);
      const instrument = this.mapPartToInstrument(partIndex);

      if (!pitch) {
        console.warn('Pitch 추출 실패, REST로 처리');
        return {
          pitch: 'REST',
          duration,
          startTime,
          velocity: 0,
          instrument
        };
      }

      return {
        pitch,
        duration,
        startTime,
        velocity,
        instrument
      };
    } catch (error) {
      console.error('음표 파싱 실패:', error);
      return null;
    }
  }

  private extractPitch(noteElement: any): string | null {
    try {
      const pitch = noteElement.pitch?.[0];
      if (!pitch) return null;

      const step = pitch.step?.[0];
      const octave = pitch.octave?.[0];
      const alter = pitch.alter?.[0];

      if (!step || !octave) return null;

      let pitchName = step + octave;
      
      // 임시표 처리
      if (alter) {
        const alterValue = parseInt(alter);
        if (alterValue > 0) {
          pitchName = step + '#' + octave;
        } else if (alterValue < 0) {
          pitchName = step + 'b' + octave;
        }
      }

      return pitchName;
    } catch (error) {
      return null;
    }
  }

  private extractDivisions(scoreData: any): number {
    try {
      const parts = scoreData.part || [];
      if (parts.length === 0) return 480; // 기본값

      const firstPart = parts[0];
      const measures = firstPart.measure || [];
      
      for (const measure of measures) {
        const attributes = measure.attributes?.[0];
        if (attributes && attributes.divisions) {
          return parseInt(attributes.divisions[0]);
        }
      }
      
      return 480; // 기본값
    } catch (error) {
      console.error('Divisions 추출 실패:', error);
      return 480;
    }
  }

  private extractDuration(noteElement: any, divisions: number = 480): number {
    try {
      const duration = noteElement.duration?.[0];
      const type = noteElement.type?.[0];
      
      if (duration) {
        // MusicXML duration을 박자 단위로 변환
        // divisions는 4분음표당 단위 수 (예: 480이면 4분음표 = 480)
        const durationValue = parseFloat(duration);
        const quarterNotesCount = durationValue / divisions;
        
        console.log(`Duration conversion: ${duration} / ${divisions} = ${quarterNotesCount} quarter notes`);
        return quarterNotesCount;
      }
      
      // type 기반 duration 계산 (백업)
      const typeMap: { [key: string]: number } = {
        'whole': 4,
        'half': 2,
        'quarter': 1,
        'eighth': 0.5,
        'sixteenth': 0.25,
        'thirty-second': 0.125
      };
      
      const typeDuration = typeMap[type] || 1;
      console.log(`Using type-based duration: ${type} = ${typeDuration} quarter notes`);
      return typeDuration;
    } catch (error) {
      console.error('Duration 추출 실패:', error);
      return 1; // 기본값
    }
  }

  private extractVelocity(noteElement: any): number {
    try {
      // MusicXML에서 dynamics 정보 추출
      const dynamics = noteElement.notations?.[0]?.dynamics?.[0];
      if (dynamics) {
        // pp, p, mp, mf, f, ff 등을 숫자로 변환
        const dynamicMap: { [key: string]: number } = {
          'pp': 40,
          'p': 55,
          'mp': 70,
          'mf': 85,
          'f': 100,
          'ff': 115
        };
        
        for (const [dynamic, velocity] of Object.entries(dynamicMap)) {
          if (dynamics[dynamic]) {
            return velocity;
          }
        }
      }
      
      return 80; // 기본 velocity
    } catch (error) {
      return 80;
    }
  }

  private extractTimeSignature(measureElement: any): string {
    try {
      const attributes = measureElement.attributes?.[0];
      const time = attributes?.time?.[0];
      
      if (time) {
        const beats = time.beats?.[0];
        const beatType = time['beat-type']?.[0];
        
        if (beats && beatType) {
          return `${beats}/${beatType}`;
        }
      }
      
      return '4/4'; // 기본값
    } catch (error) {
      return '4/4';
    }
  }

  private extractInstruments(scoreData: any): InstrumentType[] {
    const instruments: InstrumentType[] = [];
    
    try {
      const partList = scoreData['part-list']?.[0];
      const scoreParts = partList?.['score-part'] || [];
      
      scoreParts.forEach((scorePart: any, index: number) => {
        const instrument = this.mapPartToInstrument(index);
        if (!instruments.includes(instrument)) {
          instruments.push(instrument);
        }
      });
    } catch (error) {
      console.error('악기 추출 실패:', error);
    }
    
    return instruments.length > 0 ? instruments : [InstrumentType.PIANO];
  }

  private mapPartToInstrument(partIndex: number): InstrumentType {
    // 파트 인덱스를 기반으로 악기 매핑 (간단한 예시)
    const instrumentMap = [
      InstrumentType.PIANO,
      InstrumentType.GUITAR,
      InstrumentType.DRUMS
    ];
    
    return instrumentMap[partIndex % instrumentMap.length];
  }

  private async convertToMusicScore(pdfResult: PDFProcessResult): Promise<MusicScore> {
    // 실제 구현에서는 복잡한 음표 인식 알고리즘이 필요
    // 여기서는 데모용 샘플 데이터를 생성
    
    const sampleNotes: MusicNote[] = [
      {
        pitch: 'C4',
        duration: 1,
        startTime: 0,
        velocity: 80,
        instrument: InstrumentType.PIANO
      },
      {
        pitch: 'D4',
        duration: 1,
        startTime: 1,
        velocity: 75,
        instrument: InstrumentType.PIANO
      },
      {
        pitch: 'E4',
        duration: 1,
        startTime: 2,
        velocity: 85,
        instrument: InstrumentType.PIANO
      },
      {
        pitch: 'F4',
        duration: 1,
        startTime: 3,
        velocity: 80,
        instrument: InstrumentType.PIANO
      },
      {
        pitch: 'G4',
        duration: 2,
        startTime: 4,
        velocity: 90,
        instrument: InstrumentType.PIANO
      }
    ];

    const measures: Measure[] = [
      {
        number: 1,
        timeSignature: '4/4',
        notes: sampleNotes.slice(0, 4)
      },
      {
        number: 2,
        timeSignature: '4/4',
        notes: sampleNotes.slice(4)
      }
    ];

    const musicScore: MusicScore = {
      title: pdfResult.metadata.title || '인식된 악보',
      tempo: 120,
      measures,
      instruments: [InstrumentType.PIANO]
    };

    return musicScore;
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 정리 작업 (오래된 작업 삭제)
  public cleanup(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24시간

    for (const [jobId, job] of this.jobs.entries()) {
      if (now.getTime() - job.createdAt.getTime() > maxAge) {
        this.jobs.delete(jobId);
        console.log(`[OCR] Cleaned up old job ${jobId}`);
      }
    }
  }
}