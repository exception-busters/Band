import React from 'react';
import { InstrumentType } from '../types/music';

interface InstrumentSelectorProps {
  selectedInstruments: InstrumentType[];
  onInstrumentToggle: (instrument: InstrumentType) => void;
  disabled?: boolean;
}

const INSTRUMENT_CONFIG = {
  [InstrumentType.PIANO]: {
    icon: '🎹',
    name: '피아노',
    description: '클래식한 피아노 사운드'
  },
  [InstrumentType.GUITAR]: {
    icon: '🎸',
    name: '기타',
    description: '따뜻한 어쿠스틱 기타 사운드 (코러스, 리버브 포함)'
  },
  [InstrumentType.DRUMS]: {
    icon: '🥁',
    name: '드럼',
    description: '리듬 섹션'
  }
};

export function InstrumentSelector({ 
  selectedInstruments, 
  onInstrumentToggle, 
  disabled = false 
}: InstrumentSelectorProps) {
  return (
    <div className="instrument-selector">
      <h2>🎹 악기 선택</h2>
      <p>연주할 악기를 선택하세요 (다중 선택 가능)</p>
      
      <div className="instrument-grid">
        {Object.entries(INSTRUMENT_CONFIG).map(([instrumentType, config]) => {
          const instrument = instrumentType as InstrumentType;
          const isSelected = selectedInstruments.includes(instrument);
          
          return (
            <div 
              key={instrument}
              className={`instrument-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              data-instrument={instrument}
              onClick={() => !disabled && onInstrumentToggle(instrument)}
            >
              <div className="instrument-icon">{config.icon}</div>
              <h3>{config.name}</h3>
              <p className="instrument-description">{config.description}</p>
              
              <label className="instrument-checkbox">
                <input 
                  type="checkbox" 
                  value={instrument}
                  checked={isSelected}
                  onChange={() => onInstrumentToggle(instrument)}
                  disabled={disabled}
                />
                <span className="checkmark"></span>
              </label>
            </div>
          );
        })}
      </div>
      
      {selectedInstruments.length === 0 && (
        <div className="selection-hint">
          <span className="hint-icon">💡</span>
          <span>최소 하나의 악기를 선택해주세요</span>
        </div>
      )}
      
      {selectedInstruments.length > 0 && (
        <div className="selection-summary">
          <span className="summary-icon">✅</span>
          <span>선택된 악기: {selectedInstruments.length}개</span>
        </div>
      )}
    </div>
  );
}