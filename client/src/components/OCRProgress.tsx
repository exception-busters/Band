import React from 'react';
import { OCRStatus } from '../types/music';

interface OCRProgressProps {
  status: OCRStatus;
  progress: number;
  fileName?: string;
  onCancel?: () => void;
  error?: string;
}

const STATUS_CONFIG = {
  [OCRStatus.PENDING]: {
    icon: '⏳',
    title: '대기 중',
    description: '악보 분석 작업이 곧 시작됩니다...'
  },
  [OCRStatus.PROCESSING]: {
    icon: '🔍',
    title: '분석 중',
    description: '악보에서 음표를 인식하고 있습니다...'
  },
  [OCRStatus.COMPLETED]: {
    icon: '✅',
    title: '완료',
    description: '악보 분석이 성공적으로 완료되었습니다!'
  },
  [OCRStatus.FAILED]: {
    icon: '❌',
    title: '실패',
    description: '악보 분석 중 오류가 발생했습니다.'
  }
};

export function OCRProgress({ 
  status, 
  progress, 
  fileName, 
  onCancel, 
  error 
}: OCRProgressProps) {
  const config = STATUS_CONFIG[status];
  const isProcessing = status === OCRStatus.PROCESSING || status === OCRStatus.PENDING;
  const isCompleted = status === OCRStatus.COMPLETED;
  const isFailed = status === OCRStatus.FAILED;

  return (
    <div className={`ocr-progress ${status}`}>
      <div className="ocr-header">
        <div className="ocr-icon">{config.icon}</div>
        <div className="ocr-info">
          <h3>{config.title}</h3>
          {fileName && (
            <p className="file-name">파일: {fileName}</p>
          )}
        </div>
        
        {isProcessing && onCancel && (
          <button 
            className="cancel-button"
            onClick={onCancel}
            title="취소"
          >
            ❌
          </button>
        )}
      </div>

      <div className="ocr-content">
        <p className="ocr-description">{config.description}</p>
        
        {isProcessing && (
          <>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-info">
              <span className="progress-percentage">{progress}%</span>
              <span className="progress-eta">
                {progress > 0 && progress < 100 && (
                  `예상 완료: ${Math.ceil((100 - progress) * 0.5)}초`
                )}
              </span>
            </div>
          </>
        )}

        {isCompleted && (
          <div className="completion-info">
            <div className="success-animation">🎉</div>
            <p>이제 악기를 선택하고 재생해보세요!</p>
          </div>
        )}

        {isFailed && (
          <div className="error-info">
            <div className="error-details">
              {error && (
                <p className="error-message">오류 내용: {error}</p>
              )}
              <div className="error-suggestions">
                <h4>해결 방법:</h4>
                <ul>
                  {error?.includes('PDF') && (
                    <>
                      <li>파일이 올바른 PDF 형식인지 확인해주세요</li>
                      <li>PDF가 암호화되어 있지 않은지 확인해주세요</li>
                      <li>악보가 선명하고 읽기 쉬운지 확인해주세요</li>
                    </>
                  )}
                  {error?.includes('XML') && (
                    <>
                      <li>올바른 MusicXML 파일인지 확인해주세요</li>
                      <li>MuseScore, Finale, Sibelius 등에서 내보낸 파일을 사용해주세요</li>
                      <li>파일이 손상되지 않았는지 확인해주세요</li>
                    </>
                  )}
                  {error?.includes('크기') && (
                    <>
                      <li>파일 크기를 50MB 이하로 줄여주세요</li>
                      <li>불필요한 페이지나 요소를 제거해보세요</li>
                    </>
                  )}
                  {error?.includes('네트워크') || error?.includes('연결') && (
                    <>
                      <li>인터넷 연결 상태를 확인해주세요</li>
                      <li>잠시 후 다시 시도해주세요</li>
                    </>
                  )}
                  <li>다른 파일로 다시 시도해보세요</li>
                  <li>문제가 계속되면 고객지원에 문의해주세요</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 처리 단계 표시 */}
      {isProcessing && (
        <div className="processing-steps">
          <div className="step-list">
            <div className={`step ${progress >= 20 ? 'completed' : 'active'}`}>
              <span className="step-icon">📄</span>
              <span className="step-text">PDF 파일 읽기</span>
            </div>
            <div className={`step ${progress >= 40 ? 'completed' : progress >= 20 ? 'active' : ''}`}>
              <span className="step-icon">🖼️</span>
              <span className="step-text">이미지 추출</span>
            </div>
            <div className={`step ${progress >= 70 ? 'completed' : progress >= 40 ? 'active' : ''}`}>
              <span className="step-icon">🔍</span>
              <span className="step-text">음표 인식</span>
            </div>
            <div className={`step ${progress >= 90 ? 'completed' : progress >= 70 ? 'active' : ''}`}>
              <span className="step-icon">🎵</span>
              <span className="step-text">음표 데이터 변환</span>
            </div>
            <div className={`step ${progress >= 100 ? 'completed' : progress >= 90 ? 'active' : ''}`}>
              <span className="step-icon">✅</span>
              <span className="step-text">완료</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}