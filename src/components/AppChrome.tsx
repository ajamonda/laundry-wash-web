import type { ReactNode } from 'react';
import type { AppStep, StaffSession } from '../types';

const navItems: { step: AppStep; label: string }[] = [
  { step: 'bag-scan', label: '백 스캔' },
  { step: 'order-search', label: '주문 검색' },
  { step: 'queue', label: '처리 대기열' },
  { step: 'step-scan', label: '스텝 스캔' },
  { step: 'packaging', label: '패키징' },
];

const mainSteps: AppStep[] = ['bag-scan', 'bag-items', 'order-search', 'queue', 'step-scan', 'packaging'];

function activeGroup(step: AppStep): AppStep {
  if (step === 'bag-items') return 'bag-scan';
  return step;
}

export function AppChrome({
  children,
  onLogout,
  onNavigate,
  session,
  step,
}: {
  children: ReactNode;
  onLogout: () => void;
  onNavigate: (step: AppStep) => void;
  session: StaffSession | null;
  step: AppStep;
}) {
  const showNav = step !== 'login';

  return (
    <div className="app-shell">
      <div className="promo-banner">
        <span>세탁 서비스</span>
        <strong>WASH</strong>
      </div>

      <nav className="top-nav" aria-label="주요 메뉴">
        <div className="brand-mark">
          <span className="brand-dot" />
          세탁 운영
        </div>

        {showNav && mainSteps.includes(step) ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {navItems.map((item) => {
              const isActive = activeGroup(step) === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  style={{
                    background: isActive ? 'var(--ink-deep)' : 'transparent',
                    border: '1px solid var(--hairline)',
                    borderRadius: 100,
                    color: isActive ? 'var(--canvas)' : 'var(--ink)',
                    cursor: isActive ? 'default' : 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '6px 12px',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => { if (!isActive) onNavigate(item.step); }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="nav-right">
          {session ? (
            <>
              <span className="staff-pill">{session.staff.staffId}</span>
              <button className="logout-button" type="button" onClick={onLogout}>
                로그아웃
              </button>
            </>
          ) : null}
        </div>
      </nav>

      <div className="page-content">{children}</div>
    </div>
  );
}
