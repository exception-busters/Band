import { useState, useEffect, useCallback } from 'react';
import { FileUpload } from '../components/FileUpload';
import { InstrumentSelector } from '../components/InstrumentSelector';
import { AudioPlayer } from '../components/AudioPlayer';
import { OCRProgress } from '../components/OCRProgress';
import { useFileUpload } from '../hooks/useFileUpload';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { InstrumentType, OCRStatus } from '../types/music';
import '../styles/virtual-instruments.css';

export function VirtualInstruments() {
  const [selectedInstruments, setSelectedInstruments] = useState<InstrumentType[]>([]);
  
  const {
    uploadState,
    ocrProgress,
    ocrStatus,
    musicScore,
    uploadFile,
    cancelUpload,
    resetUpload
  } = useFileUpload();

  const {
    audioState,
    currentNote,
    isLoading: audioLoading,
    error: audioError,
    selectedInstruments: audioSelectedInstruments,
    instrumentLoadingStates,
    loadMusicScore,
    play,
    pause,
    stop,
    setTempo,
    seek
  } = useAudioPlayer();

  // 악기 선택 토글 핸들러
  const handleInstrumentToggle = useCallback((instrument: InstrumentType) => {
    setSelectedInstruments(prev => {
      const isSelected = prev.includes(instrument);
      if (isSelected) {
        return prev.filter(i => i !== instrument);
      } else {
        return [...prev, instrument];
      }
    });
  }, []);



  // 악보 로드 시 오디오 플레이어에 로드
  useEffect(() => {
    if (musicScore && selectedInstruments.length > 0) {
      loadMusicScore(musicScore, selectedInstruments);
    }
  }, [musicScore, selectedInstruments, loadMusicScore]);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // 입력 필드에서는 단축키 무시
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (audioState.playbackState === 'playing') {
            pause();
          } else {
            play();
          }
          break;
        case 'Escape':
          e.preventDefault();
          stop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [audioState.playbackState, play, pause, stop]);

  // 🎯 실제 마디 번호의 최댓값을 totalMeasures로 사용
  const totalMeasures = musicScore?.measures.length > 0 
    ? Math.max(...musicScore.measures.map(m => m.number))
    : 0;
  const hasError = uploadState.error || audioError;
  const isProcessing = uploadState.isUploading || ocrStatus === OCRStatus.PROCESSING;

  return (
    <div className="virtual-instruments-page">
      <div className="virtual-instruments-container">
        {/* 헤더 */}
        <div className="page-header">
          <h1>🎼 가상악기</h1>
          <p>PDF 악보를 업로드하여 자동 연주를 체험해보세요</p>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="main-content">
          {/* 파일 업로드 섹션 */}
          <section className="upload-section">
            <h2>📄 악보 업로드</h2>
            <FileUpload
              onFileSelect={uploadFile}
              isUploading={uploadState.isUploading}
              uploadProgress={uploadState.uploadProgress}
              error={uploadState.error}
            />
            
            {/* OCR 진행 상태 */}
            {(isProcessing || ocrStatus) && (
              <OCRProgress
                status={ocrStatus || OCRStatus.PENDING}
                progress={ocrProgress}
                fileName={uploadState.file?.name}
                onCancel={cancelUpload}
                error={uploadState.error || undefined}
              />
            )}
          </section>

          {/* 악기 선택 섹션 */}
          <section className="instrument-section">
            <InstrumentSelector
              selectedInstruments={selectedInstruments}
              onInstrumentToggle={handleInstrumentToggle}
              disabled={!musicScore || isProcessing}
            />

          </section>

          {/* 재생 제어 섹션 */}
          {musicScore && (
            <section className="player-section">
              <AudioPlayer
                playbackState={audioState.playbackState}
                currentMeasure={audioState.currentMeasure}
                totalMeasures={totalMeasures}
                currentTime={audioState.currentTime}
                duration={audioState.duration}
                tempo={audioState.tempo}
                currentNote={currentNote}
                selectedInstruments={audioSelectedInstruments}
                instrumentLoadingStates={instrumentLoadingStates}
                onPlay={play}
                onPause={pause}
                onStop={stop}
                onTempoChange={setTempo}
                onSeek={seek}
                disabled={selectedInstruments.length === 0 || audioLoading}
              />
            </section>
          )}

          {/* 오류 표시 */}
          {hasError && (
            <section className="error-section">
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span>{hasError}</span>
                <button 
                  className="retry-button"
                  onClick={resetUpload}
                >
                  다시 시도
                </button>
              </div>
            </section>
          )}

          {/* 안내사항 */}
          <section className="info-section">
            <h3>📋 사용 안내</h3>
            <ul>
              <li>지원 형식: PDF, XML, MusicXML, JSON 파일 (최대 50MB)</li>
              <li>XML/MusicXML/JSON은 즉시 처리되며, PDF는 30초~1분 정도 소요됩니다</li>
              <li>여러 악기를 동시에 선택하여 합주 연주가 가능합니다</li>
              <li>템포는 40~200 BPM 범위에서 조절할 수 있습니다</li>
              <li>키보드 단축키: 스페이스바(재생/일시정지), ESC(정지)</li>
              <li>MusicXML 파일은 MuseScore, Finale, Sibelius 등에서 내보낼 수 있습니다</li>
              <li>JSON 파일은 기존에 변환된 악보 데이터를 직접 업로드할 때 사용합니다</li>
              <li><strong>🎸 기타 기능:</strong> 코러스, 리버브 이펙트가 적용되며, 재생 중 코드 정보가 표시됩니다</li>
              <li><strong>🎹 피아노 기능:</strong> 클래식한 피아노 사운드와 자연스러운 리버브</li>
              <li><strong>🎛️ 합성 드럼:</strong> Web Audio API로 실시간 생성되는 드럼 사운드 (샘플 없이 순수 합성)</li>
              <li><strong>🥁 지원 드럼:</strong> Snare, Kick, Hi-Hat (Open/Closed), Tom, Crash - 모두 실시간 합성</li>
              <li><strong>🎵→🥁 자동 변환:</strong> 멜로디 음(C4, D4 등)을 드럼 패턴으로 자동 변환 (C→Kick, D→Snare, E→HiHat 등)</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}