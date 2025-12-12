import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { OCRService } from '../services/ocrService';
import { OCRJob, OCRStatus, FileType } from '../types/ocr';

const router = express.Router();

// 파일 업로드 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/xml',
      'text/xml',
      'application/vnd.recordare.musicxml+xml'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xml') || file.originalname.endsWith('.musicxml')) {
      cb(null, true);
    } else {
      cb(new Error('PDF 또는 XML(MusicXML) 파일만 업로드 가능합니다.'));
    }
  }
});

const ocrService = new OCRService();

// 파일 업로드 및 OCR 작업 시작
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      // Multer 오류 처리
      if (err) {
        console.error('Multer upload error:', err);
        
        let errorMessage = '파일 업로드 중 오류가 발생했습니다.';
        let statusCode = 400;
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          errorMessage = '파일 크기가 50MB를 초과합니다.';
        } else if (err.message.includes('PDF 또는 XML')) {
          errorMessage = err.message;
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          errorMessage = '예상하지 못한 파일 필드입니다.';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          errorMessage = '파일 개수가 제한을 초과했습니다.';
        } else {
          statusCode = 500;
          errorMessage = `업로드 오류: ${err.message}`;
        }
        
        return res.status(statusCode).json({
          success: false,
          error: errorMessage,
          errorCode: err.code || 'UPLOAD_ERROR',
          details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '파일이 선택되지 않았습니다.',
          errorCode: 'NO_FILE'
        });
      }

      // 파일 크기 검증
      if (req.file.size === 0) {
        return res.status(400).json({
          success: false,
          error: '빈 파일은 업로드할 수 없습니다.',
          errorCode: 'EMPTY_FILE'
        });
      }

      // 파일 확장자 검증
      const fileName = req.file.originalname;
      const fileExtension = fileName.toLowerCase().split('.').pop();
      const allowedExtensions = ['pdf', 'xml', 'musicxml'];
      
      if (!allowedExtensions.includes(fileExtension || '')) {
        return res.status(400).json({
          success: false,
          error: `지원하지 않는 파일 형식입니다. (${fileExtension}) 지원 형식: PDF, XML, MusicXML`,
          errorCode: 'INVALID_FILE_TYPE'
        });
      }

      const jobId = uuidv4();
      const fileBuffer = req.file.buffer;
      
      // 파일 타입 결정
      let fileType: FileType;
      if (req.file.mimetype === 'application/pdf' || fileExtension === 'pdf') {
        fileType = FileType.PDF;
      } else if (fileName.endsWith('.musicxml') || req.file.mimetype === 'application/vnd.recordare.musicxml+xml') {
        fileType = FileType.MUSICXML;
      } else {
        fileType = FileType.XML;
      }

      console.log(`[OCR] Starting job ${jobId} for file: ${fileName} (type: ${fileType}, size: ${fileBuffer.length} bytes)`);

      // 파일 내용 검증
      try {
        if (fileType === FileType.PDF) {
          // PDF 헤더 검증
          const pdfHeader = fileBuffer.slice(0, 4).toString();
          if (pdfHeader !== '%PDF') {
            throw new Error('유효하지 않은 PDF 파일입니다.');
          }
        } else {
          // XML 파일 검증
          const xmlContent = fileBuffer.toString('utf-8', 0, Math.min(1000, fileBuffer.length));
          if (!xmlContent.includes('<?xml') && !xmlContent.includes('<score-partwise') && !xmlContent.includes('<score-timewise')) {
            throw new Error('유효하지 않은 XML/MusicXML 파일입니다.');
          }
        }
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          error: (validationError as Error).message,
          errorCode: 'INVALID_FILE_CONTENT'
        });
      }

      // OCR 작업 시작 (비동기)
      ocrService.startOCRJob(jobId, fileName, fileBuffer, fileType);

      res.json({
        success: true,
        data: {
          jobId,
          fileName,
          fileSize: fileBuffer.length,
          fileType
        }
      });

    } catch (error) {
      console.error('OCR upload error:', error);
      res.status(500).json({
        success: false,
        error: '서버 내부 오류가 발생했습니다.',
        errorCode: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });
});

// OCR 작업 상태 조회
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = ocrService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: '작업을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: job
    });

  } catch (error) {
    console.error('OCR status check error:', error);
    res.status(500).json({
      success: false,
      error: '작업 상태 확인 중 오류가 발생했습니다.'
    });
  }
});

// OCR 작업 취소
router.post('/cancel/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const success = ocrService.cancelJob(jobId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '작업을 찾을 수 없거나 이미 완료되었습니다.'
      });
    }

    res.json({
      success: true,
      message: '작업이 취소되었습니다.'
    });

  } catch (error) {
    console.error('OCR cancel error:', error);
    res.status(500).json({
      success: false,
      error: '작업 취소 중 오류가 발생했습니다.'
    });
  }
});

// 작업 목록 조회 (디버깅용)
router.get('/jobs', async (req, res) => {
  try {
    const jobs = ocrService.getAllJobs();
    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    console.error('OCR jobs list error:', error);
    res.status(500).json({
      success: false,
      error: '작업 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

export default router;