import { useState, useCallback } from 'react';
import { OCRService } from '../services/ocrService';
import { MusicScore, OCRStatus, FileUploadState } from '../types/music';

interface UseFileUploadReturn {
  uploadState: FileUploadState;
  ocrProgress: number;
  ocrStatus: OCRStatus | null;
  musicScore: MusicScore | null;
  uploadFile: (file: File) => Promise<void>;
  cancelUpload: () => void;
  resetUpload: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const [uploadState, setUploadState] = useState<FileUploadState>({
    file: null,
    isUploading: false,
    uploadProgress: 0,
    error: null
  });

  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState<OCRStatus | null>(null);
  const [musicScore, setMusicScore] = useState<MusicScore | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const ocrService = OCRService.getInstance();

  const uploadFile = useCallback(async (file: File) => {
    try {
      // 초기 상태 설정
      setUploadState({
        file,
        isUploading: true,
        uploadProgress: 0,
        error: null
      });
      setOcrProgress(0);
      setOcrStatus(OCRStatus.PENDING);
      setMusicScore(null);
      setCurrentJobId(null);

      // OCR 처리 시작
      const result = await ocrService.processFile(
        file,
        (progress, status) => {
          setOcrProgress(progress);
          setOcrStatus(status);
          
          // 업로드 진행률도 OCR 진행률에 따라 업데이트
          setUploadState(prev => ({
            ...prev,
            uploadProgress: Math.min(progress, 100)
          }));
        }
      );

      // 결과 검증
      if (!ocrService.validateMusicScore(result)) {
        throw new Error('인식된 악보 데이터가 올바르지 않습니다.');
      }

      // 성공 상태 설정
      setMusicScore(result);
      setOcrStatus(OCRStatus.COMPLETED);
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 100,
        error: null
      }));

      console.log('File upload and OCR completed successfully');
      
    } catch (error) {
      console.error('File upload error:', error);
      
      let errorMessage = '파일 업로드 중 오류가 발생했습니다.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // 네트워크 오류 감지
        if (error.message.includes('fetch') || error.message.includes('네트워크')) {
          errorMessage = '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
        }
        // 파일 크기 오류
        else if (error.message.includes('50MB') || error.message.includes('크기')) {
          errorMessage = `${error.message} 더 작은 파일을 사용해주세요.`;
        }
        // 파일 형식 오류
        else if (error.message.includes('형식') || error.message.includes('확장자')) {
          errorMessage = `${error.message} PDF, XML, 또는 MusicXML 파일을 사용해주세요.`;
        }
      }

      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage
      }));
      
      setOcrStatus(OCRStatus.FAILED);
      setMusicScore(null);
    }
  }, [ocrService]);

  const cancelUpload = useCallback(async () => {
    if (currentJobId) {
      try {
        await ocrService.cancelJob(currentJobId);
      } catch (error) {
        console.error('Failed to cancel job:', error);
      }
    }

    setUploadState({
      file: null,
      isUploading: false,
      uploadProgress: 0,
      error: null
    });
    
    setOcrProgress(0);
    setOcrStatus(null);
    setMusicScore(null);
    setCurrentJobId(null);
  }, [currentJobId, ocrService]);

  const resetUpload = useCallback(() => {
    setUploadState({
      file: null,
      isUploading: false,
      uploadProgress: 0,
      error: null
    });
    
    setOcrProgress(0);
    setOcrStatus(null);
    setMusicScore(null);
    setCurrentJobId(null);
  }, []);

  return {
    uploadState,
    ocrProgress,
    ocrStatus,
    musicScore,
    uploadFile,
    cancelUpload,
    resetUpload
  };
}