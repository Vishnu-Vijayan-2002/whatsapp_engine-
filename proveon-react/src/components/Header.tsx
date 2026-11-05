import React, { useState } from 'react';
import './Header.css';
import { useRole } from '../context/RoleContext';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const {
    role,
    setRole,
    activeTenant,
    activeTenantId,
    setActiveTenantId,
    tenants,
    isLowBalance,
    recentDrop,
    dismissDrop,
    showRechargeModal,
    setShowRechargeModal,
  } = useRole();

  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const balance = activeTenant?.credit_wallet?.balance ?? 0;

  return (
    <>
      <header className="dash-header">
        <div className="header-left">
          <button className="menu-toggle-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          {/* Role switcher toggle (PRO Super Admin vs BIZ Business Admin) */}
          <div className="role-switcher-toggle" title="Switch Portal Mode">
            <button
              className={`role-toggle-btn ${role === 'super' ? 'active' : ''}`}
              onClick={() => setRole('super')}
            >
              Super Admin
            </button>
            <button
              className={`role-toggle-btn ${role === 'business' ? 'active' : ''}`}
              onClick={() => setRole('business')}
            >
              Business Admin
            </button>
          </div>

          {/* Active Business Tenant Switcher (Useful when testing multiple clinics/salons) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              {role === 'business' ? 'Tenant:' : 'Active View:'}
            </span>
            <select
              value={activeTenantId}
              onChange={(e) => setActiveTenantId(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'var(--text-main)',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '220px',
              }}
            >
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.business_name} ({t.vertical})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="header-right">
          {/* Module A.1: Persistent Header Wallet Counter (Visible for Business Admin) */}
          <div
            className={`header-wallet-badge ${isLowBalance ? 'low-balance' : ''}`}
            title={`Credit Wallet Balance for ${activeTenant?.business_name || 'Active Business'}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isLowBalance ? '#EF3826' : 'var(--primary)'} strokeWidth="2.2">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
              <span className={`wallet-balance-amount ${isLowBalance ? 'low' : ''}`}>
                {balance.toFixed(2)} cr
              </span>
            </div>

            {isLowBalance && (
              <button
                className="wallet-recharge-btn"
                onClick={() => setShowRechargeModal(true)}
              >
                Recharge Required
              </button>
            )}
          </div>

          {/* Dark/Light mode toggle */}
          <button className="icon-btn theme-toggle-btn" onClick={toggleDarkMode} title={darkMode ? 'Switch to Light' : 'Switch to Dark'}>
            {darkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          {/* User profile */}
          <div className="user-profile-header">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120" 
              alt="Admin" 
              className="user-avatar"
            />
            <div className="user-info">
              <span className="user-name">
                {role === 'business' ? (activeTenant?.admin_name || 'Business Manager') : 'Platform Admin'}
              </span>
              <span className="user-role">
                {role === 'business' ? (activeTenant?.business_name || 'Clinic Admin') : 'Super Admin'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Module A.2: Top-Right Instant Credit Deduction Toast Notification */}
      {recentDrop && (
        <div className="credit-deduction-toast">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="toast-credit-amount">
              -{recentDrop.amount.toFixed(2)} cr
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>{recentDrop.description}</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Wallet balance updated in real time</div>
            </div>
          </div>
          <button
            onClick={dismissDrop}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Low Balance / Insufficient Credits Modal */}
      {showRechargeModal && (
        <div className="modal-overlay" onClick={() => setShowRechargeModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(239, 56, 38, 0.14)', color: '#EF3826', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <h3 className="modal-title">Wallet Recharge Required</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowRechargeModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current Balance:</span>
                  <strong style={{ fontSize: '16px', color: balance <= 0 ? '#EF3826' : '#FF9F43' }}>
                    {balance.toFixed(2)} cr
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Low Balance Threshold:</span>
                  <span>{activeTenant?.credit_wallet?.low_balance_threshold ?? 50} cr</span>
                </div>
              </div>

              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {balance <= 0
                  ? 'Your wallet balance has reached 0.00 cr. Automated WhatsApp replies, patient media uploads, and database writes have been temporarily paused until new credits are credited.'
                  : 'Your business credit wallet is running low. Please contact your Proveon platform administrator or submit a top-up request to ensure uninterrupted WhatsApp bot messaging and customer record saving.'}
              </p>

              <div style={{ background: 'var(--primary-light)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--primary)' }}>
                <strong>Tip:</strong> In this demo environment, switch to <strong>Super Admin ➔ Tenants</strong> to manually top up credits for this clinic or salon!
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary-action" onClick={() => setShowRechargeModal(false)}>
                Dismiss
              </button>
              <button
                className="btn-primary-action"
                onClick={() => {
                  setRole('super');
                  setShowRechargeModal(false);
                }}
              >
                Go to Super Admin Top-Up
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
