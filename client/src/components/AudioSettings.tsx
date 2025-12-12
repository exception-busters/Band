import { useState, useEffect } from 'react'
import { useAudioSettings, AudioPreset } from '../contexts/AudioSettingsContext'
import './AudioSettings.css'

interface AudioSettingsProps {
  onClose?: () => void
  isModal?: boolean
}

// 설정 비교 표시 컴포넌트
function SettingComparison({ label, requested, actual, match }: {
  label: string
  requested: string
  actual: string
  match: boolean | null
}) {
  const getStatusIcon = () => {
    if (match === null || actual === '알 수 없음') return '❓'
    return match ? '✅' : '⚠️'
  }

  return (
    <div className={`setting-comparison ${match === false ? 'mismatch' : ''}`}>
      <span className="setting-label">{label}</span>
      <div className="setting-values">
        <span className="setting-value requested" title="요청한 값">
          {requested}
        </span>
        <span className="setting-arrow">→</span>
        <span className="setting-value actual" title="실제 적용된 값">
          {actual}
        </span>
        <span className="setting-status">{getStatusIcon()}</span>
      </div>
    </div>
  )
}

export function AudioSettings({ onClose, isModal = false }: AudioSettingsProps) {
  const {
    inputDevices,
    outputDevices,
    settings,
    actualSettings,
    setInputDevice,
    setOutputDevice,
    setSampleRate,
    setChannelCount,
    setEchoCancellation,
    setNoiseSuppression,
    setAutoGainControl,
    applyPreset,
    refreshDevices,
    testInput,
    stopTest,
    inputLevel,
    isInitialized,
    permissionStatus,
    requestPermission,
  } = useAudioSettings()

  const [selectedPreset, setSelectedPreset] = useState<AudioPreset>('custom')
  const [isTesting, setIsTesting] = useState(false)

  // 권한이 없으면 요청
  useEffect(() => {
    if (permissionStatus === 'prompt') {
      // 권한 요청 대기
    }
  }, [permissionStatus])

  const handlePresetChange = (preset: AudioPreset) => {
    setSelectedPreset(preset)
    applyPreset(preset)
  }

  const handleTestToggle = async () => {
    if (isTesting) {
      stopTest()
      setIsTesting(false)
    } else {
      const stream = await testInput()
      if (stream) {
        setIsTesting(true)
      }
    }
  }

  const handlePermissionRequest = async () => {
    const granted = await requestPermission()
    if (granted) {
      await refreshDevices()
    }
  }

  // 권한 요청 화면
  if (permissionStatus === 'denied') {
    return (
      <div className={`audio-settings ${isModal ? 'modal' : ''}`}>
        <div className="audio-settings-content">
          <h2>오디오 설정</h2>
          <div className="permission-denied">
            <div className="permission-icon">🎤</div>
            <h3>마이크 권한이 필요합니다</h3>
            <p>오디오 장치를 사용하려면 브라우저에서 마이크 권한을 허용해주세요.</p>
            <p className="permission-hint">
              브라우저 주소창의 자물쇠 아이콘을 클릭하여 마이크 권한을 허용할 수 있습니다.
            </p>
          </div>
          {onClose && (
            <div className="settings-actions">
              <button onClick={onClose} className="btn-secondary">닫기</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (permissionStatus === 'prompt' || !isInitialized) {
    return (
      <div className={`audio-settings ${isModal ? 'modal' : ''}`}>
        <div className="audio-settings-content">
          <h2>오디오 설정</h2>
          <div className="permission-request">
            <div className="permission-icon">🎤</div>
            <h3>오디오 장치 접근 허용</h3>
            <p>오디오 인터페이스와 마이크를 사용하려면 권한이 필요합니다.</p>
            <button onClick={handlePermissionRequest} className="btn-primary">
              권한 허용하기
            </button>
          </div>
          {onClose && (
            <div className="settings-actions">
              <button onClick={onClose} className="btn-secondary">닫기</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`audio-settings ${isModal ? 'modal' : ''}`}>
      {isModal && <div className="modal-backdrop" onClick={onClose} />}
      <div className="audio-settings-content">
        <div className="settings-header">
          <h2>오디오 설정</h2>
          {onClose && (
            <button onClick={onClose} className="close-btn">×</button>
          )}
        </div>

        {/* 프리셋 선택 */}
        <section className="settings-section">
          <h3>악기 프리셋</h3>
          <div className="preset-grid">
            {[
              { id: 'vocal', label: '보컬', icon: '🎤' },
              { id: 'guitar', label: '기타', icon: '🎸' },
              { id: 'bass', label: '베이스', icon: '🎸' },
              { id: 'keyboard', label: '키보드', icon: '🎹' },
              { id: 'drums', label: '드럼', icon: '🥁' },
              { id: 'custom', label: '커스텀', icon: '⚙️' },
            ].map(preset => (
              <button
                key={preset.id}
                className={`preset-btn ${selectedPreset === preset.id ? 'active' : ''}`}
                onClick={() => handlePresetChange(preset.id as AudioPreset)}
              >
                <span className="preset-icon">{preset.icon}</span>
                <span className="preset-label">{preset.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 입력 장치 선택 */}
        <section className="settings-section">
          <h3>입력 장치 (오디오 인터페이스/마이크)</h3>
          <select
            value={settings.inputDeviceId || ''}
            onChange={(e) => setInputDevice(e.target.value)}
            className="device-select"
          >
            <option value="">기본 장치</option>
            {inputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          <button onClick={refreshDevices} className="refresh-btn">
            새로고침
          </button>
        </section>

        {/* 출력 장치 선택 */}
        <section className="settings-section">
          <h3>출력 장치 (스피커/헤드폰)</h3>
          <select
            value={settings.outputDeviceId || ''}
            onChange={(e) => setOutputDevice(e.target.value)}
            className="device-select"
          >
            <option value="">기본 장치</option>
            {outputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </section>

        {/* 오디오 품질 설정 */}
        <section className="settings-section">
          <h3>오디오 품질</h3>
          <div className="settings-row">
            <label>샘플레이트</label>
            <select
              value={settings.sampleRate}
              onChange={(e) => setSampleRate(Number(e.target.value))}
            >
              <option value={44100}>44.1 kHz (CD 품질)</option>
              <option value={48000}>48 kHz (권장)</option>
              <option value={96000}>96 kHz (고음질)</option>
            </select>
          </div>
          <div className="settings-row">
            <label>입력 채널</label>
            <select
              value={settings.channelCount}
              onChange={(e) => setChannelCount(Number(e.target.value))}
            >
              <option value={1}>모노 (1채널) - 입력 1번만 사용</option>
              <option value={2}>스테레오 (2채널) - 입력 1+2번 사용</option>
            </select>
          </div>
        </section>

        {/* 신호 처리 설정 */}
        <section className="settings-section">
          <h3>신호 처리</h3>
          <p className="settings-hint">악기 녹음 시에는 모두 OFF 권장</p>
          <div className="settings-toggle">
            <label>
              <input
                type="checkbox"
                checked={settings.echoCancellation}
                onChange={(e) => setEchoCancellation(e.target.checked)}
              />
              <span>에코 캔슬레이션</span>
            </label>
          </div>
          <div className="settings-toggle">
            <label>
              <input
                type="checkbox"
                checked={settings.noiseSuppression}
                onChange={(e) => setNoiseSuppression(e.target.checked)}
              />
              <span>노이즈 억제</span>
            </label>
          </div>
          <div className="settings-toggle">
            <label>
              <input
                type="checkbox"
                checked={settings.autoGainControl}
                onChange={(e) => setAutoGainControl(e.target.checked)}
              />
              <span>자동 게인 컨트롤</span>
            </label>
          </div>
        </section>

        {/* 입력 테스트 */}
        <section className="settings-section">
          <h3>입력 테스트</h3>
          <div className="test-section">
            <button
              onClick={handleTestToggle}
              className={`test-btn ${isTesting ? 'testing' : ''}`}
            >
              {isTesting ? '테스트 중지' : '입력 테스트'}
            </button>
            <div className="level-meter">
              <div className="level-bar">
                <div
                  className="level-fill"
                  style={{ width: `${inputLevel}%` }}
                />
              </div>
              <span className="level-value">{Math.round(inputLevel)}%</span>
            </div>
          </div>
          {isTesting && (
            <p className="test-hint">
              악기나 마이크에 소리를 입력하면 레벨 미터가 움직입니다.
            </p>
          )}
        </section>

        {/* 실제 적용된 설정 표시 */}
        {actualSettings && isTesting && (
          <section className="settings-section actual-settings-section">
            <h3>실제 적용된 설정</h3>
            <p className="settings-hint">브라우저가 실제로 적용한 오디오 설정입니다. 요청한 값과 다를 수 있습니다.</p>
            <div className="actual-settings-grid">
              <SettingComparison
                label="샘플레이트"
                requested={`${settings.sampleRate / 1000} kHz`}
                actual={actualSettings.sampleRate ? `${actualSettings.sampleRate / 1000} kHz` : '알 수 없음'}
                match={settings.sampleRate === actualSettings.sampleRate}
              />
              <SettingComparison
                label="채널 수"
                requested={settings.channelCount === 1 ? '모노' : '스테레오'}
                actual={actualSettings.channelCount === 1 ? '모노' : actualSettings.channelCount === 2 ? '스테레오' : '알 수 없음'}
                match={settings.channelCount === actualSettings.channelCount}
              />
              <SettingComparison
                label="에코 캔슬레이션"
                requested={settings.echoCancellation ? 'ON' : 'OFF'}
                actual={actualSettings.echoCancellation === null ? '알 수 없음' : actualSettings.echoCancellation ? 'ON' : 'OFF'}
                match={settings.echoCancellation === actualSettings.echoCancellation}
              />
              <SettingComparison
                label="노이즈 억제"
                requested={settings.noiseSuppression ? 'ON' : 'OFF'}
                actual={actualSettings.noiseSuppression === null ? '알 수 없음' : actualSettings.noiseSuppression ? 'ON' : 'OFF'}
                match={settings.noiseSuppression === actualSettings.noiseSuppression}
              />
              <SettingComparison
                label="자동 게인"
                requested={settings.autoGainControl ? 'ON' : 'OFF'}
                actual={actualSettings.autoGainControl === null ? '알 수 없음' : actualSettings.autoGainControl ? 'ON' : 'OFF'}
                match={settings.autoGainControl === actualSettings.autoGainControl}
              />
              {actualSettings.latency !== null && (
                <div className="setting-comparison">
                  <span className="setting-label">레이턴시</span>
                  <span className="setting-value actual">{(actualSettings.latency * 1000).toFixed(1)} ms</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 저장 안내 */}
        <div className="settings-footer">
          <p className="auto-save-notice">설정은 자동으로 저장됩니다</p>
          {onClose && (
            <button onClick={onClose} className="btn-primary">
              완료
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
