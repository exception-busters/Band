import { usePremium } from '../contexts/PremiumContext'

// 개발/테스트용 플랜 전환 컴포넌트
export function PlanSwitcher() {
  const { userPlan, setUserPlan } = usePremium()

  // 프로덕션에서는 숨김
  if (import.meta.env.PROD) return null

  return (
    <div className="plan-switcher">
      <h4>🔧 개발자 도구 - 플랜 전환</h4>
      <div className="plan-buttons">
        <button 
          className={`plan-switch-btn ${userPlan === 'free' ? 'active' : ''}`}
          onClick={() => setUserPlan('free')}
        >
          무료 플랜
        </button>
        <button 
          className={`plan-switch-btn ${userPlan === 'standard' ? 'active' : ''}`}
          onClick={() => setUserPlan('standard')}
        >
          Standard
        </button>
        <button 
          className={`plan-switch-btn ${userPlan === 'pro' ? 'active' : ''}`}
          onClick={() => setUserPlan('pro')}
        >
          Pro
        </button>
      </div>
      <p className="plan-switcher-note">
        현재 플랜: <strong>{userPlan}</strong> (새로고침 시 유지됨)
      </p>
    </div>
  )
}