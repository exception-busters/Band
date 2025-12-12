import React, { useCallback, useState } from 'react';
import { SUPPORTED_FILE_FORMATS, MAX_FILE_SIZE } from '../types/music';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

export function FileUpload({ onFileSelect, isUploading, uploadProgress, error }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): string | null => {
    // 파일 크기 검증
    if (file.size === 0) {
      return '빈 파일은 업로드할 수 없습니다.';
    }
    
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
      const fileSizeMB = Math.round(file.size / (1024 * 1024) * 100) / 100;
      return `파일 크기가 너무 큽니다. (${fileSizeMB}MB / ${maxSizeMB}MB 제한)`;
    }
    
    // 파일 형식 검증
    const supportedTypes = Object.values(SUPPORTED_FILE_FORMATS);
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    const isXMLFile = fileName.endsWith('.xml') || fileName.endsWith('.musicxml');
    const isJSONFile = fileName.endsWith('.json');
    
    if (!supportedTypes.includes(file.type as any) && !isXMLFile && !isJSONFile) {
      return `지원하지 않는 파일 형식입니다. (${fileExtension}) 지원 형식: PDF, XML, MusicXML, JSON`;
    }
    
    // 파일 이름 검증
    if (!fileExtension || fileExtension.length === 0) {
      return '파일 확장자가 없습니다. 올바른 파일을 선택해주세요.';
    }
    
    const allowedExtensions = ['pdf', 'xml', 'musicxml', 'json'];
    if (!allowedExtensions.includes(fileExtension)) {
      return `지원하지 않는 파일 확장자입니다. (${fileExtension}) 지원 확장자: ${allowedExtensions.join(', ')}`;
    }
    
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      // alert 대신 props로 오류 전달하도록 수정 (부모 컴포넌트에서 처리)
      console.error('File validation error:', validationError);
      // 임시로 alert 사용, 나중에 더 나은 UI로 개선 가능
      alert(`파일 선택 오류: ${validationError}`);
      return;
    }
    
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  return (
    <div className="file-upload-container">
      <div 
        className={`upload-area ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!isUploading ? (
          <>
            <div className="upload-icon">📁</div>
            <p>PDF, XML(MusicXML) 또는 JSON 악보 파일을 드래그하거나 클릭하여 업로드하세요</p>
            <input
              type="file"
              accept=".pdf,.xml,.musicxml,.json,application/pdf,application/xml,text/xml,application/json"
              onChange={handleInputChange}
              style={{ display: 'none' }}
              id="file-input"
              disabled={isUploading}
            />
            <label htmlFor="file-input" className="upload-button">
              파일 선택
            </label>
          </>
        ) : (
          <div className="upload-progress">
            <div className="upload-icon">⏳</div>
            <p>파일 업로드 중...</p>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}
      </div>
      
      {error && (
        <div className="upload-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}
      
      <div className="upload-info">
        <p>지원 형식: PDF, XML, MusicXML, JSON 파일 (최대 50MB)</p>
        <p>XML/MusicXML/JSON은 즉시 처리되며, PDF는 30초~1분 정도 소요됩니다</p>
      </div>
    </div>
  );
}