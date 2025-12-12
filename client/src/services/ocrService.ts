import { OCRJob, OCRStatus, MusicScore, APIResponse } from '../types/music';
import { MusicXMLService } from './musicXmlService';

export class OCRService {
  private static instance: OCRService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  public async uploadFile(file: File): Promise<{ jobId: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseUrl}/api/ocr/upload`, {
        method: 'POST',
        body: formData,
      });

      const result: APIResponse<{ jobId: string; fileName: string }> = await response.json();
      
      if (!response.ok || !result.success) {
        // 서버에서 제공한 구체적인 오류 메시지 사용
        const errorMessage = result.error || `서버 오류 (${response.status}): ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (!result.data) {
        throw new Error('서버 응답에 필요한 데이터가 없습니다.');
      }

      return result.data;
    } catch (error) {
      console.error('File upload error:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
      }
      
      if (error instanceof Error) {
        throw error; // 이미 구체적인 오류 메시지가 있으면 그대로 전달
      }
      
      throw new Error('파일 업로드 중 알 수 없는 오류가 발생했습니다.');
    }
  }

  public async getJobStatus(jobId: string): Promise<OCRJob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ocr/status/${jobId}`);
      
      const result: APIResponse<OCRJob> = await response.json();
      
      if (!response.ok || !result.success) {
        const errorMessage = result.error || `상태 확인 실패 (${response.status}): ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (!result.data) {
        throw new Error('작업 정보를 찾을 수 없습니다.');
      }

      return result.data;
    } catch (error) {
      console.error('Status check error:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
      }
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('작업 상태 확인 중 알 수 없는 오류가 발생했습니다.');
    }
  }

  public async pollJobStatus(
    jobId: string, 
    onProgress: (progress: number, status: OCRStatus) => void,
    timeout: number = 300000 // 5분
  ): Promise<MusicScore> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2초마다 폴링

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          // 타임아웃 체크
          if (Date.now() - startTime > timeout) {
            reject(new Error('OCR 처리 시간이 초과되었습니다.'));
            return;
          }

          const job = await this.getJobStatus(jobId);
          onProgress(job.progress, job.status);

          switch (job.status) {
            case OCRStatus.COMPLETED:
              if (job.result) {
                resolve(job.result);
              } else {
                reject(new Error('OCR 결과를 받을 수 없습니다.'));
              }
              break;

            case OCRStatus.FAILED:
              reject(new Error(job.error || 'OCR 처리에 실패했습니다.'));
              break;

            case OCRStatus.PENDING:
            case OCRStatus.PROCESSING:
              // 계속 폴링
              setTimeout(poll, pollInterval);
              break;

            default:
              reject(new Error('알 수 없는 작업 상태입니다.'));
          }
        } catch (error) {
          reject(error);
        }
      };

      // 첫 번째 폴링 시작
      poll();
    });
  }

  public async processFile(
    file: File,
    onProgress: (progress: number, status: OCRStatus) => void
  ): Promise<MusicScore> {
    try {
      // XML 파일인지 확인
      if (MusicXMLService.isXMLFile(file)) {
        return await this.processXMLFile(file, onProgress);
      }

      // JSON 파일인지 확인
      if (this.isJSONFile(file)) {
        return await this.processJSONFile(file, onProgress);
      }

      // PDF 파일은 기존 OCR 처리
      // 1. 파일 업로드
      onProgress(0, OCRStatus.PENDING);
      const { jobId } = await this.uploadFile(file);

      // 2. 처리 상태 폴링
      onProgress(10, OCRStatus.PROCESSING);
      const result = await this.pollJobStatus(jobId, onProgress);

      return result;
    } catch (error) {
      console.error('OCR processing error:', error);
      throw error;
    }
  }

  private async processXMLFile(
    file: File,
    onProgress: (progress: number, status: OCRStatus) => void
  ): Promise<MusicScore> {
    try {
      console.log('Starting XML file processing:', file.name);
      onProgress(0, OCRStatus.PENDING);
      
      // MusicXML 내용인지 확인
      console.log('Checking if file is MusicXML...');
      const isMusicXML = await MusicXMLService.isMusicXMLContent(file);
      if (!isMusicXML) {
        throw new Error(`파일이 올바른 MusicXML 형식이 아닙니다. 파일명: ${file.name}, 크기: ${file.size}바이트`);
      }
      console.log('File confirmed as MusicXML');

      onProgress(25, OCRStatus.PROCESSING);
      
      // XML 파싱
      console.log('Starting XML parsing...');
      const musicXmlService = MusicXMLService.getInstance();
      const musicScore = await musicXmlService.parseXMLFile(file);
      console.log('XML parsing completed successfully');
      
      onProgress(75, OCRStatus.PROCESSING);
      
      // 결과 검증
      console.log('Validating music score...');
      if (!this.validateMusicScore(musicScore)) {
        console.error('Music score validation failed:', musicScore);
        throw new Error(`변환된 악보 데이터가 올바르지 않습니다. 제목: ${musicScore.title}, 마디 수: ${musicScore.measures?.length || 0}`);
      }
      console.log('Music score validation passed');
      
      onProgress(100, OCRStatus.COMPLETED);
      return musicScore;
      
    } catch (error) {
      console.error('XML processing error details:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      if (error instanceof Error) {
        throw new Error(`XML 파일 처리 실패: ${error.message}`);
      }
      throw new Error(`XML 파일 처리 중 알 수 없는 오류가 발생했습니다 (${file.name})`);
    }
  }

  private async processJSONFile(
    file: File,
    onProgress: (progress: number, status: OCRStatus) => void
  ): Promise<MusicScore> {
    try {
      onProgress(0, OCRStatus.PENDING);
      
      // JSON 파일 읽기
      const jsonContent = await this.readFileAsText(file);
      
      onProgress(25, OCRStatus.PROCESSING);
      
      // JSON 파싱
      let musicScore: MusicScore;
      try {
        musicScore = JSON.parse(jsonContent);
      } catch (parseError) {
        throw new Error('올바른 JSON 형식이 아닙니다.');
      }
      
      onProgress(75, OCRStatus.PROCESSING);
      
      // 결과 검증
      if (!this.validateMusicScore(musicScore)) {
        throw new Error('JSON 파일의 악보 데이터가 올바르지 않습니다.');
      }
      
      onProgress(100, OCRStatus.COMPLETED);
      return musicScore;
      
    } catch (error) {
      console.error('JSON processing error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('JSON 파일 처리 중 오류가 발생했습니다.');
    }
  }

  private isJSONFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.json');
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('파일을 읽을 수 없습니다.'));
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  public async cancelJob(jobId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ocr/cancel/${jobId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Cancel failed: ${response.statusText}`);
      }

      const result: APIResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Cancel failed');
      }
    } catch (error) {
      console.error('Job cancellation error:', error);
      throw new Error('작업 취소에 실패했습니다.');
    }
  }

  // 결과 데이터 검증
  public validateMusicScore(score: MusicScore): boolean {
    try {
      // 기본 구조 검증
      if (!score || typeof score !== 'object') {
        return false;
      }

      if (!Array.isArray(score.measures) || score.measures.length === 0) {
        return false;
      }

      if (typeof score.tempo !== 'number' || score.tempo < 40 || score.tempo > 200) {
        return false;
      }

      // 각 마디 검증
      for (const measure of score.measures) {
        if (!Array.isArray(measure.notes)) {
          return false;
        }

        // 각 음표 검증
        for (const note of measure.notes) {
          if (!note.pitch || typeof note.pitch !== 'string') {
            return false;
          }
          
          if (typeof note.duration !== 'number' || note.duration <= 0) {
            return false;
          }
          
          if (typeof note.startTime !== 'number' || note.startTime < 0) {
            return false;
          }
          
          if (typeof note.velocity !== 'number' || note.velocity < 0 || note.velocity > 127) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Music score validation error:', error);
      return false;
    }
  }

  // 미리보기용 음표 통계 생성
  public generatePreviewStats(score: MusicScore): {
    totalNotes: number;
    totalMeasures: number;
    instrumentCounts: Record<string, number>;
    averageTempo: number;
    estimatedDuration: number;
  } {
    const stats = {
      totalNotes: 0,
      totalMeasures: score.measures.length,
      instrumentCounts: {} as Record<string, number>,
      averageTempo: score.tempo,
      estimatedDuration: 0
    };

    let totalDuration = 0;

    for (const measure of score.measures) {
      stats.totalNotes += measure.notes.length;
      
      for (const note of measure.notes) {
        // 악기별 카운트
        const instrument = note.instrument;
        stats.instrumentCounts[instrument] = (stats.instrumentCounts[instrument] || 0) + 1;
        
        // 총 재생 시간 계산
        const noteEndTime = note.startTime + note.duration;
        if (noteEndTime > totalDuration) {
          totalDuration = noteEndTime;
        }
      }
    }

    // 예상 재생 시간 (초 단위)
    stats.estimatedDuration = (totalDuration * 60) / score.tempo;

    return stats;
  }
}