import { useState, useMemo } from 'react'
import { usePremium } from '../contexts/PremiumContext'

type MixTrack = {
  id: string
  name: string
  role: string
  color: string
  volume: number
  pan: number
  fx: number
}

type MixPreset = {
  id: string
  name: string
  description: string
  values: Record<string, Partial<Pick<MixTrack, 'volume' | 'pan' | 'fx'>>>
}

const INITIAL_TRACKS: MixTrack[] = [
  { id: 'trk1', name: 'Guitar Glide', role: 'Rhythm', color: '#f37381', volume: 68, pan: -18, fx: 22 },
  { id: 'trk2', name: 'Velvet Keys', role: 'Harmony', color: '#7f7bff', volume: 72, pan: 8, fx: 35 },
  { id: 'trk3', name: 'Pocket Drums', role: 'Backbeat', color: '#4ddfb7', volume: 64, pan: 12, fx: 12 },
  { id: 'trk4', name: 'Sub Air', role: 'Bass', color: '#f6d365', volume: 58, pan: -6, fx: 18 },
]

const MIX_PRESETS: MixPreset[] = [
  {
    id: 'wide',
    name: 'Wide Room',
    description: '팬을 넓히고 FX를 강조해 공간감을 확보합니다.',
    values: {
      trk1: { pan: -32, fx: 28 },
      trk2: { pan: 22, volume: 74, fx: 40 },
      trk3: { pan: 10, volume: 66 },
      trk4: { pan: -8, volume: 60 },
    },
  },
  {
    id: 'tight-pocket',
    name: 'Tight Pocket',
    description: '중앙에 에너지를 모아 리듬감을 강조합니다.',
    values: {
      trk1: { pan: -8, volume: 70 },
      trk2: { pan: 6, fx: 18 },
      trk3: { pan: 2, volume: 76 },
      trk4: { pan: -2, volume: 64 },
    },
  },
  {
    id: 'dreamy',
    name: 'Dreamy FX',
    description: 'FX send를 높여 앰비언트 레이어를 만듭니다.',
    values: {
      trk1: { fx: 48 },
      trk2: { fx: 58, pan: 18 },
      trk3: { fx: 32 },
      trk4: { fx: 26, volume: 55 },
    },
  },
]

export function MixLab() {
  const { checkFeatureAccess, showPremiumModal, planLimits, isFeatureDisabled } = usePremium()
  const [tracks, setTracks] = useState<MixTrack[]>(INITIAL_TRACKS)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(MIX_PRESETS[0]?.id ?? '')

  // Mix Lab 접근 권한 체크
  if (!planLimits.hasMixLab) {
    return (
      <div className="mixlab-page">
        <div className="feature-locked">
          <div className="lock-icon">🔒</div>
          <h2>Mix Lab은 Standard 플랜부터 이용 가능합니다</h2>
          <p>실시간 믹싱과 이퀄라이저 기능을 사용하려면 플랜을 업그레이드하세요.</p>
          <button 
            className="upgrade-button"
            onClick={() => showPremiumModal('Mix Lab 전체 기능', 'standard')}
          >
            Standard로 업그레이드
          </button>
        </div>
      </div>
    )
  }

  const mixInsights = useMemo(() => {
    const avgVolume = tracks.reduce((sum, track) => sum + track.volume, 0) / tracks.length
    const spread = tracks.reduce((sum, track) => sum + Math.abs(track.pan), 0) / tracks.length
    const fx = tracks.reduce((sum, track) => sum + track.fx, 0) / tracks.length
    const quality = Math.round((avgVolume * 0.5 + (50 - Math.abs(25 - spread)) * 0.8 + fx * 0.3) / 2)
    return { avgVolume: Math.round(avgVolume), spread: Math.round(spread), fx: Math.round(fx), quality }
  }, [tracks])

  const handleTrackChange = (id: string, key: 'volume' | 'pan' | 'fx', value: number) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, [key]: value } : track)))
  }

  const applyMixPreset = (presetId: string) => {
    const presetIndex = MIX_PRESETS.findIndex(p => p.id === presetId)
    
    // 프리셋 제한 체크
    if (planLimits.mixLabPresets !== null && presetIndex >= planLimits.mixLabPresets) {
      const requiredPlan = presetIndex >= 2 ? 'pro' : 'standard'
      showPremiumModal('고급 Mix Lab 프리셋', requiredPlan)
      return
    }

    setSelectedPresetId(presetId)
    const preset = MIX_PRESETS.find((item) => item.id === presetId)
    if (!preset) return
    setTracks((prev) =>
      prev.map((track) => {
        const patch = preset.values[track.id]
        return patch ? { ...track, ...patch } : track
      }),
    )
  }

  const handleAdvancedControl = (id: string, key: 'volume' | 'pan' | 'fx', value: number) => {
    // FX Send는 Standard 이상 필요
    if (key === 'fx' && !checkFeatureAccess('FX Send 조절', 'standard')) {
      showPremiumModal('FX Send 조절', 'standard')
      return
    }

    handleTrackChange(id, key, value)
  }

  return (
    <div className="mixlab-page">
      <div className="mixlab-header">
        <div>
          <h1>Mix Lab</h1>
          <p>실시간 믹스 실험실</p>
        </div>
        <div className="mix-insight">
          <span className="insight-score">Balance Score · {mixInsights.quality}</span>
          <span className="insight-details">
            Avg Vol {mixInsights.avgVolume}% · Spread {mixInsights.spread}% · FX {mixInsights.fx}%
          </span>
        </div>
      </div>

      <div className="mix-presets">
        {MIX_PRESETS.map((preset, index) => {
          const isLocked = planLimits.mixLabPresets !== null && index >= planLimits.mixLabPresets
          const requiredPlan = index >= 2 ? 'Pro' : 'Standard'
          
          return (
            <button
              key={preset.id}
              onClick={() => applyMixPreset(preset.id)}
              className={`preset-btn ${selectedPresetId === preset.id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
              disabled={isLocked}
            >
              <div className="preset-content">
                <strong>
                  {preset.name}
                  {isLocked && <span className="premium-badge">✨ {requiredPlan}</span>}
                </strong>
                <span>{preset.description}</span>
              </div>
              {isLocked && <div className="lock-overlay">🔒</div>}
            </button>
          )
        })}
      </div>

      <div className="mixlab-grid">
        {tracks.map((track) => (
          <article key={track.id} className="mix-card">
            <div className="mix-card-head">
              <span className="mix-dot" style={{ backgroundColor: track.color }} />
              <div className="mix-track-info">
                <p className="track-name">{track.name}</p>
                <small className="track-role">{track.role}</small>
              </div>
              <span className="mix-value">{track.volume}%</span>
            </div>

            <div className="mix-control">
              <label>
                볼륨
                <div className="slider-display">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={track.volume}
                    onChange={(e) => handleTrackChange(track.id, 'volume', Number(e.target.value))}
                  />
                  <span>{track.volume}</span>
                </div>
              </label>
            </div>

            <div className="mix-control">
              <label>
                팬 (-L / +R)
                <div className="slider-display">
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    value={track.pan}
                    onChange={(e) => handleTrackChange(track.id, 'pan', Number(e.target.value))}
                  />
                  <span>{track.pan > 0 ? `+${track.pan}R` : track.pan < 0 ? `${track.pan}L` : 'C'}</span>
                </div>
              </label>
            </div>

            <div className="mix-control">
              <label>
                FX Send {!checkFeatureAccess('FX Send 조절', 'standard') && <span className="premium-badge">✨ Standard</span>}
                <div className="slider-display">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={track.fx}
                    onChange={(e) => handleAdvancedControl(track.id, 'fx', Number(e.target.value))}
                    disabled={!checkFeatureAccess('FX Send 조절', 'standard')}
                  />
                  <span>{track.fx}</span>
                </div>
              </label>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
