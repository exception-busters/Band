import { useState, useCallback, useEffect, useRef } from 'react';
import { AudioEngine } from '../services/audioEngine';
import { 
  MusicScore, 
  MusicNote,
  InstrumentType, 
  PlaybackState, 
  AudioPlayerState,
  DEFAULT_SETTINGS 
} from '../types/music';

interface UseAudioPlayerReturn {
  audioState: AudioPlayerState;
  currentNote: MusicNote | null;
  isLoading: boolean;
  error: string | null;
  selectedInstruments: InstrumentType[];
  instrumentLoadingStates: Map<InstrumentType, boolean>;
  loadMusicScore: (score: MusicScore, instruments: InstrumentType[]) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setTempo: (tempo: number) => void;
  seek: (position: number) => void;
  dispose: () => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [audioState, setAudioState] = useState<AudioPlayerState>({
    playbackState: PlaybackState.STOPPED,
    currentMeasure: 0,
    currentTime: 0,
    duration: 0,
    tempo: DEFAULT_SETTINGS.TEMPO
  });

  const [currentNote, setCurrentNote] = useState<MusicNote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstruments, setSelectedInstruments] = useState<InstrumentType[]>([]);
  const [instrumentLoadingStates, setInstrumentLoadingStates] = useState<Map<InstrumentType, boolean>>(new Map());
  
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const musicScoreRef = useRef<MusicScore | null>(null);

  // 오디오 엔진 초기화
  useEffect(() => {
    const initializeAudioEngine = async () => {
      try {
        if (!AudioEngine.checkWebAudioSupport()) {
          throw new Error('이 브라우저는 Web Audio API를 지원하지 않습니다.');
        }

        audioEngineRef.current = AudioEngine.getInstance();
        await audioEngineRef.current.initialize();
      } catch (err) {
        console.error('Audio engine initialization failed:', err);
        setError(err instanceof Error ? err.message : '오디오 엔진 초기화에 실패했습니다.');
      }
    };

    initializeAudioEngine();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 현재 재생 중인 음표 찾기
  const findCurrentNote = useCallback((currentTime: number, tempo: number): MusicNote | null => {
    if (!musicScoreRef.current) return null;

    // 시간을 박자 단위로 변환
    const beatsPerSecond = tempo / 60;
    const currentBeat = currentTime * beatsPerSecond;

    // 모든 마디의 모든 음표를 확인 (REST 제외)
    for (const measure of musicScoreRef.current.measures) {
      for (const note of measure.notes) {
        // REST 음표는 건너뛰기
        if (note.pitch === 'REST') continue;

        const noteStartBeat = note.startTime;
        const noteEndBeat = note.startTime + note.duration;
        
        // 현재 시점이 이 음표의 재생 시간 범위 내에 있는지 확인
        if (currentBeat >= noteStartBeat && currentBeat < noteEndBeat) {
          return note;
        }
      }
    }

    return null;
  }, []);

  // 재생 위치 업데이트 루프
  const updatePlaybackPosition = useCallback(() => {
    if (!audioEngineRef.current || !musicScoreRef.current) return;

    const engine = audioEngineRef.current;
    const currentTime = engine.getCurrentTime();
    const playbackState = engine.getPlaybackState();

    // 현재 마디 계산 (실제 음표 데이터 기반)
    const beatsPerSecond = audioState.tempo / 60;
    const currentBeat = currentTime * beatsPerSecond;
    const currentMeasure = calculateCurrentMeasure(currentBeat, musicScoreRef.current);

    // 현재 재생 중인 음표 찾기
    const activeNote = findCurrentNote(currentTime, audioState.tempo);
    setCurrentNote(activeNote);

    // 재생 완료 확인 - 더 관대한 접근으로 수정
    const timeBuffer = 1.0; // 1초 여유 (더 넉넉하게)
    const timeBasedComplete = currentTime >= (audioState.duration + timeBuffer);
    const engineBasedComplete = engine.isPlaybackComplete();
    
    // 두 조건 모두 만족해야 완료로 판단 (AND 조건으로 변경)
    const isPlaybackComplete = timeBasedComplete && engineBasedComplete;
    
    // 디버깅 정보 출력
    if (currentTime > audioState.duration * 0.8) { // 80% 이상 재생되었을 때만 로그
      console.log(`🎵 Playback progress: ${currentTime.toFixed(2)}s / ${audioState.duration.toFixed(2)}s (${((currentTime/audioState.duration)*100).toFixed(1)}%)`);
      console.log(`Time complete: ${timeBasedComplete}, Engine complete: ${engineBasedComplete}`);
    }

    // 재생이 완료되었으면 자동으로 정지
    if (isPlaybackComplete && playbackState === 'started') {
      console.log('🎵 Playback completed, stopping automatically');
      console.log(`Time: ${currentTime}/${audioState.duration}, Engine complete: ${engineBasedComplete}`);
      
      engine.stop();
      
      setAudioState(prev => ({
        ...prev,
        currentTime: prev.duration, // 마지막 시간으로 설정
        currentMeasure: musicScoreRef.current?.measures.length || 0,
        playbackState: PlaybackState.STOPPED
      }));

      setCurrentNote(null);

      // 애니메이션 프레임 정리
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // 마디 변경 시 로그 출력
    const finalMeasure = Math.min(currentMeasure, musicScoreRef.current?.measures.length || 0);
    if (audioState.currentMeasure !== finalMeasure) {
      console.log(`🎵 Measure changed: ${audioState.currentMeasure} → ${finalMeasure} (beat: ${currentBeat.toFixed(2)})`);
    }

    setAudioState(prev => ({
      ...prev,
      currentTime,
      currentMeasure: finalMeasure,
      playbackState: playbackState === 'started' ? PlaybackState.PLAYING :
                    playbackState === 'paused' ? PlaybackState.PAUSED :
                    PlaybackState.STOPPED
    }));

    // 재생 중이면 계속 업데이트
    if (playbackState === 'started') {
      animationFrameRef.current = requestAnimationFrame(updatePlaybackPosition);
    } else {
      // 재생이 중지되었으면 애니메이션 프레임 정리
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [audioState.tempo, audioState.duration, audioState.currentMeasure, findCurrentNote]);

  const loadMusicScore = useCallback(async (score: MusicScore, instruments: InstrumentType[]) => {
    if (!audioEngineRef.current) {
      setError('오디오 엔진이 초기화되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedInstruments(instruments);

    // 악기별 로딩 상태 초기화
    const loadingStates = new Map<InstrumentType, boolean>();
    instruments.forEach(instrument => {
      loadingStates.set(instrument, true);
    });
    setInstrumentLoadingStates(loadingStates);

    try {
      // 각 악기를 개별적으로 로드하면서 상태 업데이트
      for (const instrument of instruments) {
        console.log(`Loading ${instrument}...`);
        await audioEngineRef.current.loadInstrument(instrument);
        
        // 해당 악기 로딩 완료 표시
        setInstrumentLoadingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(instrument, false);
          return newStates;
        });
        
        console.log(`${instrument} loaded successfully`);
      }

      // 악보 로드
      await audioEngineRef.current.loadMusicScore(score, instruments);
      
      musicScoreRef.current = score;

      // AudioEngine에서 정확한 재생 시간 가져오기
      const duration = audioEngineRef.current.getMusicDurationInSeconds();

      setAudioState(prev => ({
        ...prev,
        duration,
        tempo: score.tempo,
        currentTime: 0,
        currentMeasure: 0,
        playbackState: PlaybackState.STOPPED
      }));

      console.log(`Music loaded - Duration: ${duration}s, Beats: ${audioEngineRef.current.getMusicDuration()}`);

      console.log('Music score loaded successfully');
    } catch (err) {
      console.error('Failed to load music score:', err);
      setError(err instanceof Error ? err.message : '악보 로딩에 실패했습니다.');
      
      // 로딩 실패 시 모든 악기 상태를 false로 설정
      setInstrumentLoadingStates(prev => {
        const newStates = new Map(prev);
        instruments.forEach(instrument => {
          newStates.set(instrument, false);
        });
        return newStates;
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const play = useCallback(async () => {
    if (!audioEngineRef.current) {
      setError('오디오 엔진이 초기화되지 않았습니다.');
      return;
    }

    try {
      // 모바일 브라우저에서 오디오 컨텍스트 재개
      await audioEngineRef.current.resumeContext();
      
      // AudioEngine의 play 메서드가 이제 async이므로 await 사용
      await audioEngineRef.current.play();
      
      setAudioState(prev => ({
        ...prev,
        playbackState: PlaybackState.PLAYING
      }));

      // 재생 위치 업데이트 시작
      updatePlaybackPosition();
    } catch (err) {
      console.error('Playback failed:', err);
      setError(err instanceof Error ? err.message : '재생에 실패했습니다.');
    }
  }, [updatePlaybackPosition]);

  const pause = useCallback(() => {
    if (!audioEngineRef.current) return;

    audioEngineRef.current.pause();
    
    setAudioState(prev => ({
      ...prev,
      playbackState: PlaybackState.PAUSED
    }));

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (!audioEngineRef.current) return;

    audioEngineRef.current.stop();
    
    setAudioState(prev => ({
      ...prev,
      playbackState: PlaybackState.STOPPED,
      currentTime: 0,
      currentMeasure: 0
    }));

    setCurrentNote(null);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const setTempo = useCallback((tempo: number) => {
    if (!audioEngineRef.current) return;

    const clampedTempo = Math.max(
      DEFAULT_SETTINGS.MIN_TEMPO, 
      Math.min(DEFAULT_SETTINGS.MAX_TEMPO, tempo)
    );

    audioEngineRef.current.setTempo(clampedTempo);
    
    setAudioState(prev => ({
      ...prev,
      tempo: clampedTempo
    }));
  }, []);

  const seek = useCallback((position: number) => {
    if (!audioEngineRef.current || !musicScoreRef.current) return;

    const clampedPosition = Math.max(0, Math.min(audioState.duration, position));
    
    audioEngineRef.current.setPosition(clampedPosition);
    
    // 현재 마디 재계산 (실제 음표 데이터 기반)
    const beatsPerSecond = audioState.tempo / 60;
    const currentBeat = clampedPosition * beatsPerSecond;
    const currentMeasure = calculateCurrentMeasure(currentBeat, musicScoreRef.current);

    setAudioState(prev => ({
      ...prev,
      currentTime: clampedPosition,
      currentMeasure: Math.min(currentMeasure, musicScoreRef.current?.measures.length || 0)
    }));
  }, [audioState.duration, audioState.tempo]);

  const dispose = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioEngineRef.current) {
      audioEngineRef.current.dispose();
      audioEngineRef.current = null;
    }

    musicScoreRef.current = null;
    setSelectedInstruments([]);
    setInstrumentLoadingStates(new Map());
    
    setAudioState({
      playbackState: PlaybackState.STOPPED,
      currentMeasure: 0,
      currentTime: 0,
      duration: 0,
      tempo: DEFAULT_SETTINGS.TEMPO
    });
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    audioState,
    currentNote,
    isLoading,
    error,
    selectedInstruments,
    instrumentLoadingStates,
    loadMusicScore,
    play,
    pause,
    stop,
    setTempo,
    seek,
    dispose
  };
}

// 🎵 현재 박자를 기준으로 마디 번호 계산 (단순 균등 분할 방식)
function calculateCurrentMeasure(currentBeat: number, score: MusicScore): number {
  if (!score || !score.measures || score.measures.length === 0) {
    return 1;
  }

  // 마디를 번호순으로 정렬
  const sortedMeasures = [...score.measures].sort((a, b) => a.number - b.number);
  const totalMeasures = sortedMeasures.length;
  
  // 전체 곡의 길이 (박자 단위) 계산
  let maxEndBeat = 0;
  for (const measure of sortedMeasures) {
    for (const note of measure.notes) {
      const noteEndBeat = note.startTime + note.duration;
      if (noteEndBeat > maxEndBeat) {
        maxEndBeat = noteEndBeat;
      }
    }
  }
  
  if (maxEndBeat === 0) {
    return sortedMeasures[0].number;
  }
  
  // 🎯 단순 균등 분할: 전체 길이를 마디 수로 나누기
  const beatsPerMeasure = maxEndBeat / totalMeasures;
  
  // 현재 박자가 몇 번째 마디에 해당하는지 계산
  const measureIndex = Math.floor(currentBeat / beatsPerMeasure);
  const clampedIndex = Math.max(0, Math.min(measureIndex, totalMeasures - 1));
  
  const currentMeasureNumber = sortedMeasures[clampedIndex].number;
  
  console.log(`🎵 Beat: ${currentBeat.toFixed(2)}/${maxEndBeat.toFixed(2)}, BeatsPerMeasure: ${beatsPerMeasure.toFixed(2)} → Measure ${currentMeasureNumber} (index: ${clampedIndex}/${totalMeasures})`);
  
  return currentMeasureNumber;
}

// 악보의 예상 재생 시간 계산
function calculateDuration(score: MusicScore): number {
  let maxEndTime = 0;

  for (const measure of score.measures) {
    for (const note of measure.notes) {
      const noteEndTime = note.startTime + note.duration;
      if (noteEndTime > maxEndTime) {
        maxEndTime = noteEndTime;
      }
    }
  }

  // 박자를 초 단위로 변환
  return (maxEndTime * 60) / score.tempo;
}