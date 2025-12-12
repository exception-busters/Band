import React from 'react';
import { PlaybackState, MusicNote, InstrumentType } from '../types/music';
import { GuitarDisplay } from './GuitarDisplay';
import { detectGuitarChord } from '../data/guitarChords';

interface AudioPlayerProps {
  playbackState: PlaybackState;
  currentMeasure: number;
  totalMeasures: number;
  currentTime: number;
  duration: number;
  tempo: number;
  currentNote?: MusicNote | null;
  selectedInstruments?: InstrumentType[];
  instrumentLoadingStates?: Map<InstrumentType, boolean>;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onTempoChange: (tempo: number) => void;
  onSeek: (position: number) => void;
  disabled?: boolean;
}

export function AudioPlayer({
  playbackState,
  currentMeasure,
  totalMeasures,
  currentTime,
  duration,
  tempo,
  currentNote,
  selectedInstruments = [],
  instrumentLoadingStates = new Map(),
  onPlay,
  onPause,
  onStop,
  onTempoChange,
  onSeek,
  disabled = false
}: AudioPlayerProps) {
  const isPlaying = playbackState === PlaybackState.PLAYING;
  const isLoading = playbackState === PlaybackState.LOADING;
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || duration === 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newPosition = percentage * duration;
    
    onSeek(newPosition);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player">
      <h2>🎵 재생 제어</h2>
      
      {/* 템포 조절 */}
      <div className="tempo-control">
        <label htmlFor="tempo-slider">템포: {tempo} BPM</label>
        <div className="tempo-slider-container">
          <span className="tempo-min">40</span>
          <input 
            id="tempo-slider"
            type="range" 
            min="40" 
            max="200" 
            value={tempo}
            className="tempo-slider"
            onChange={(e) => onTempoChange(Number(e.target.value))}
            disabled={disabled}
          />
          <span className="tempo-max">200</span>
        </div>
        
        {/* 템포 프리셋 버튼들 */}
        <div className="tempo-presets">
          <button 
            className="preset-button"
            onClick={() => onTempoChange(60)}
            disabled={disabled}
          >
            느림 (60)
          </button>
          <button 
            className="preset-button"
            onClick={() => onTempoChange(120)}
            disabled={disabled}
          >
            보통 (120)
          </button>
          <button 
            className="preset-button"
            onClick={() => onTempoChange(160)}
            disabled={disabled}
          >
            빠름 (160)
          </button>
        </div>
      </div>

      {/* 재생 버튼들 */}
      <div className="playback-controls">
        <button 
          className={`control-button play-button ${isPlaying ? 'playing' : ''}`}
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled || isLoading}
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isLoading ? '⏳' : (isPlaying ? '⏸️' : '▶️')}
        </button>
        
        <button 
          className="control-button stop-button"
          onClick={onStop}
          disabled={disabled || playbackState === PlaybackState.STOPPED}
          title="정지"
        >
          ⏹️
        </button>
      </div>

      {/* 진행률 바 */}
      <div className="progress-section">
        <div className="time-display">
          <span className="current-time">{formatTime(currentTime)}</span>
          <span className="duration">{formatTime(duration)}</span>
        </div>
        
        <div 
          className="playback-progress"
          onClick={handleProgressClick}
        >
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
        
        <div className="measure-display">
          <span className="current-measure">
            현재 마디: {currentMeasure} / {totalMeasures}
          </span>
        </div>
      </div>

      {/* 현재 재생 중인 음표 표시 */}
      {currentNote && playbackState === PlaybackState.PLAYING && (
        <div className="current-note-display" data-instrument={currentNote.instrument}>
          <h3>
            {currentNote.instrument === 'guitar' ? '🎸' : 
             currentNote.instrument === 'piano' ? '🎹' : 
             currentNote.instrument === 'drums' ? '🥁' : '🎼'} 
            현재 재생 중인 음표
          </h3>
          <div className="note-info">
            <div className="note-pitch">
              <span className="note-label">음높이:</span>
              <span className="note-value pitch-display">{currentNote.pitch}</span>
            </div>
            <div className="note-duration">
              <span className="note-label">길이:</span>
              <span className="note-value">{currentNote.duration}박자</span>
            </div>
            <div className="note-instrument">
              <span className="note-label">악기:</span>
              <span className="note-value">{currentNote.instrument}</span>
            </div>
          </div>
          <div className="note-visualization">
            <div className="musical-note-icon">♪</div>
          </div>
          
          {/* 기타 전용 코드 표시 */}
          {currentNote.instrument === InstrumentType.GUITAR && (
            <GuitarDisplay 
              currentChord={detectGuitarChord([currentNote.pitch])}
              isPlaying={playbackState === PlaybackState.PLAYING}
            />
          )}
        </div>
      )}

      {/* 악기 로딩 상태 표시 */}
      {selectedInstruments.length > 0 && (
        <div className="instrument-loading-status">
          <h3>🎼 악기 로딩 상태</h3>
          <div className="loading-indicators">
            {selectedInstruments.map(instrument => {
              const isLoading = instrumentLoadingStates.get(instrument) || false;
              const instrumentConfig = {
                [InstrumentType.PIANO]: { icon: '🎹', name: '피아노' },
                [InstrumentType.GUITAR]: { icon: '🎸', name: '기타' },
                [InstrumentType.DRUMS]: { icon: '🥁', name: '드럼' }
              };
              
              return (
                <div key={instrument} className={`instrument-status ${isLoading ? 'loading' : 'loaded'}`}>
                  <span className="instrument-icon">{instrumentConfig[instrument].icon}</span>
                  <span className="instrument-name">{instrumentConfig[instrument].name}</span>
                  <span className="loading-indicator">
                    {isLoading ? '⏳ 로딩 중...' : '✅ 준비됨'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 재생 상태 표시 */}
      <div className="playback-status">
        <div className={`status-indicator ${playbackState}`}>
          <span className="status-icon">
            {playbackState === PlaybackState.PLAYING && '🎵'}
            {playbackState === PlaybackState.PAUSED && '⏸️'}
            {playbackState === PlaybackState.STOPPED && '⏹️'}
            {playbackState === PlaybackState.LOADING && '⏳'}
          </span>
          <span className="status-text">
            {playbackState === PlaybackState.PLAYING && '재생 중'}
            {playbackState === PlaybackState.PAUSED && '일시정지'}
            {playbackState === PlaybackState.STOPPED && '정지'}
            {playbackState === PlaybackState.LOADING && '로딩 중'}
          </span>
        </div>
      </div>

      {/* 키보드 단축키 안내 */}
      <div className="keyboard-shortcuts">
        <small>
          키보드 단축키: 스페이스바(재생/일시정지), ESC(정지)
        </small>
      </div>
    </div>
  );
}