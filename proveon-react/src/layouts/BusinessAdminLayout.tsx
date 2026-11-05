import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import '../styles/design-system.css';
import '../components/Sidebar.css';
import '../components/Header.css';
import '../pages/BusinessAdmin/BusinessAdmin.css';
import '../pages/SuperAdmin/SuperAdmin.css';

const BusinessAdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const {
    tenant,
    balance,
    isLowBalance,
    recentDrop,
    dismissDrop,
    rechargeModalOpen,
    setRechargeModalOpen,
  } = useTenant();

  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dash-app-layout">
      {/* Business Isolated Sidebar */}
      <aside className={`dash-sidebar business-admin ${collapsed ? 'collapsed' : ''}`}>
        <div className="dash-brand">
          <span className="brand-logo-text">
            <span className="brand-dash">Prove</span>
            <span className="brand-stack">on</span>
          </span>
          <span className="brand-badge" style={{ background: '#00B69B', color: '#fff' }}>BIZ</span>
        </div>

        <div className="sidebar-scroll-area">
          <div className="sidebar-group-title">TENANT OPERATIONS</div>
          <ul className="sidebar-nav-list">
            <li>
              <NavLink
                to="/app/dashboard"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <div className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
                    <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
                    <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
                    <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
                  </svg>
                </div>
                <span className="sidebar-text">Dashboard</span>
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/app/customers"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <div className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <span className="sidebar-text">Clients & Visits</span>
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/app/media"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <div className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </div>
                <span className="sidebar-text">Media & X-Rays</span>
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/app/whatsapp"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <div className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <span className="sidebar-text">WhatsApp Flow</span>
              </NavLink>
            </li>
          </ul>

          <div className="sidebar-group-title" style={{ marginTop: '24px' }}>ACCOUNT</div>
          <ul className="sidebar-nav-list">
            <li>
              <button
                onClick={handleLogout}
                className="sidebar-link logout-btn"
              >
                <div className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </div>
                <span className="sidebar-text">Sign Out</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Area */}
      <div className="dash-main-area">
        {/* Business Isolated Header with Persistent Wallet Counter */}
        <header className="dash-header">
          <div className="header-left">
            <button
              className="menu-toggle-btn"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Toggle menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            {/* Active Business Name Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="beacon-dot"></span>
              <strong style={{ fontSize: '14.5px', color: 'var(--text-main)' }}>
                {tenant?.business_name || 'Business Portal'}
              </strong>
              {tenant?.vertical && (
                <span className="vertical-badge clinic" style={{ fontSize: '11px', padding: '2px 8px' }}>
                  {tenant.vertical}
                </span>
              )}
            </div>
          </div>

          <div className="header-right">
            {/* Persistent Header Wallet Counter */}
            <div
              className={`header-wallet-badge ${isLowBalance ? 'low-balance' : ''}`}
              title="Real-time Credit Wallet Balance"
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
                  onClick={() => setRechargeModalOpen(true)}
                >
                  Recharge Required
                </button>
              )}
            </div>

            {/* Dark/Light mode toggle */}
            <button
              className="icon-btn theme-toggle-btn"
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to Light' : 'Switch to Dark'}
            >
              {darkMode ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>

            {/* User Profile */}
            <div className="user-profile-header">
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#00B69B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'BA'}
              </div>
              <div className="user-info">
                <span className="user-name">{currentUser?.name || 'Business Admin'}</span>
                <span className="user-role" style={{ color: '#00B69B' }}>{currentUser?.email}</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="btn-secondary-action"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="dash-content-container">
          {children}
        </main>
      </div>

      {/* Instant Credit Deduction Toast Notification */}
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

      {/* Insufficient Credits / Recharge Modal */}
      {rechargeModalOpen && (
        <div className="modal-overlay" onClick={() => setRechargeModalOpen(false)}>
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
                <h3 className="modal-title">Insufficient Credit Balance</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setRechargeModalOpen(false)}>
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
                  <span>{tenant?.credit_wallet?.low_balance_threshold ?? 50} cr</span>
                </div>
              </div>

              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {balance <= 0
                  ? 'Your wallet balance has reached 0.00 cr. Automated WhatsApp replies, patient media uploads, and database writes have been temporarily paused until new credits are allocated.'
                  : 'Your business credit wallet is running low. Please contact your Proveon platform administrator to top up your balance.'}
              </p>

              <div style={{ background: 'var(--primary-light)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--primary)' }}>
                <strong>Support Contact:</strong> Email <code>support@proveon.io</code> or your account executive for immediate quota extension.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-primary-action" onClick={() => setRechargeModalOpen(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessAdminLayout;

