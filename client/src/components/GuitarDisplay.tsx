import React from 'react';
import { GuitarChord } from '../types/music';

interface GuitarDisplayProps {
  currentChord?: GuitarChord | null;
  isPlaying: boolean;
}

export function GuitarDisplay({ currentChord, isPlaying }: GuitarDisplayProps) {
  if (!currentChord || !isPlaying) {
    return null;
  }

  return (
    <div className="guitar-chord-display">
      <div className="guitar-chord-name">{currentChord.name}</div>
      
      <div className="guitar-fretboard">
        {currentChord.frets.map((fret, stringIndex) => (
          <div 
            key={stringIndex}
            className={`guitar-string ${fret > 0 ? 'pressed' : ''}`}
            title={`${stringIndex + 1}번줄: ${fret === -1 ? 'X' : fret === 0 ? '개방' : `${fret}프렛`}`}
          >
            {fret === -1 ? 'X' : fret === 0 ? '○' : fret}
          </div>
        ))}
      </div>
      
      <div className="chord-notes">
        <small>구성음: {currentChord.notes.join(' - ')}</small>
      </div>
    </div>
  );
}