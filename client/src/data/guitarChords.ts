import { GuitarChord } from '../types/music';

// 기본 기타 코드 데이터베이스
export const GUITAR_CHORDS: { [key: string]: GuitarChord } = {
  // 메이저 코드
  'C': {
    name: 'C',
    frets: [0, 1, 0, 2, 1, 0],  // E-A-D-G-B-E
    fingers: [0, 1, 0, 3, 2, 0],
    notes: ['C', 'E', 'G', 'C', 'E']
  },
  'D': {
    name: 'D',
    frets: [-1, -1, 0, 2, 3, 2],
    fingers: [0, 0, 0, 1, 3, 2],
    notes: ['D', 'A', 'D', 'F#']
  },
  'E': {
    name: 'E',
    frets: [0, 2, 2, 1, 0, 0],
    fingers: [0, 2, 3, 1, 0, 0],
    notes: ['E', 'B', 'E', 'G#', 'B', 'E']
  },
  'F': {
    name: 'F',
    frets: [1, 1, 3, 3, 2, 1],
    fingers: [1, 1, 4, 3, 2, 1],
    notes: ['F', 'A', 'C', 'F', 'A', 'F']
  },
  'G': {
    name: 'G',
    frets: [3, 2, 0, 0, 3, 3],
    fingers: [3, 2, 0, 0, 4, 4],
    notes: ['G', 'B', 'D', 'G', 'B', 'G']
  },
  'A': {
    name: 'A',
    frets: [-1, 0, 2, 2, 2, 0],
    fingers: [0, 0, 1, 2, 3, 0],
    notes: ['A', 'E', 'A', 'C#', 'E']
  },
  'B': {
    name: 'B',
    frets: [-1, 2, 4, 4, 4, 2],
    fingers: [0, 1, 3, 4, 4, 2],
    notes: ['B', 'F#', 'B', 'D#', 'F#']
  },

  // 마이너 코드
  'Am': {
    name: 'Am',
    frets: [-1, 0, 2, 2, 1, 0],
    fingers: [0, 0, 2, 3, 1, 0],
    notes: ['A', 'E', 'A', 'C', 'E']
  },
  'Dm': {
    name: 'Dm',
    frets: [-1, -1, 0, 2, 3, 1],
    fingers: [0, 0, 0, 2, 3, 1],
    notes: ['D', 'A', 'D', 'F']
  },
  'Em': {
    name: 'Em',
    frets: [0, 2, 2, 0, 0, 0],
    fingers: [0, 2, 3, 0, 0, 0],
    notes: ['E', 'B', 'E', 'G', 'B', 'E']
  },
  'Fm': {
    name: 'Fm',
    frets: [1, 1, 3, 3, 1, 1],
    fingers: [1, 1, 4, 3, 1, 1],
    notes: ['F', 'Ab', 'C', 'F', 'Ab', 'F']
  },
  'Gm': {
    name: 'Gm',
    frets: [3, 1, 0, 3, 3, 3],
    fingers: [3, 1, 0, 2, 4, 4],
    notes: ['G', 'Bb', 'D', 'G', 'Bb', 'G']
  },

  // 7th 코드
  'C7': {
    name: 'C7',
    frets: [0, 1, 0, 2, 1, 0],
    fingers: [0, 1, 0, 3, 2, 0],
    notes: ['C', 'E', 'G', 'Bb', 'E']
  },
  'G7': {
    name: 'G7',
    frets: [3, 2, 0, 0, 0, 1],
    fingers: [3, 2, 0, 0, 0, 1],
    notes: ['G', 'B', 'D', 'G', 'B', 'F']
  }
};

// 표준 기타 튜닝
export const STANDARD_TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// 음표를 기타 코드로 변환하는 함수
export function detectGuitarChord(notes: string[]): GuitarChord | null {
  // 간단한 코드 감지 로직
  const noteSet = new Set(notes.map(note => note.replace(/\d+/, ''))); // 옥타브 제거
  
  for (const [chordName, chord] of Object.entries(GUITAR_CHORDS)) {
    const chordNotes = new Set(chord.notes.map(note => note.replace(/\d+/, '')));
    
    // 음표가 일치하는지 확인
    if (noteSet.size === chordNotes.size && 
        [...noteSet].every(note => chordNotes.has(note))) {
      return chord;
    }
  }
  
  return null;
}

// 프렛 번호를 실제 음표로 변환
export function fretToNote(stringIndex: number, fret: number, tuning: string[] = STANDARD_TUNING): string {
  if (fret === -1) return ''; // 뮤트된 줄
  
  const openNote = tuning[stringIndex];
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // 기본 음표에서 프렛만큼 올림
  const baseNoteIndex = noteNames.indexOf(openNote.replace(/\d+/, ''));
  const targetNoteIndex = (baseNoteIndex + fret) % 12;
  
  // 옥타브 계산
  const baseOctave = parseInt(openNote.replace(/[A-G#]+/, ''));
  const octaveShift = Math.floor((baseNoteIndex + fret) / 12);
  
  return noteNames[targetNoteIndex] + (baseOctave + octaveShift);
}