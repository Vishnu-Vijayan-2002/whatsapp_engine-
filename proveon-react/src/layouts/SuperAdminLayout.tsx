import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/design-system.css';
import '../components/Sidebar.css';
import '../components/Header.css';
import '../pages/SuperAdmin/SuperAdmin.css';

const SuperAdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
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
    navigate('/super-admin/login');
  };

  return (
    <div className="dash-app-layout">
      {/* Super Admin Isolated Sidebar */}
      <aside className={`dash-sidebar super-admin ${collapsed ? 'collapsed' : ''}`}>
        <div className="dash-brand">
          <span className="brand-logo-text">
            <span className="brand-dash">Prove</span>
            <span className="brand-stack">on</span>
          </span>
          <span className="brand-badge" style={{ background: '#EF4444', color: '#fff' }}>ROOT</span>
        </div>

        <div className="sidebar-scroll-area">
          <div className="sidebar-group-title" style={{ letterSpacing: '1px' }}>CORE PLATFORM</div>
          <ul className="sidebar-nav-list">
            <li>
              <NavLink
                to="/super-admin/dashboard"
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
                <span className="sidebar-text">Platform Telemetry</span>
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/super-admin/tenants"
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
                <span className="sidebar-text">Tenant Management</span>
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/super-admin/rate-card"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <div className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                    <circle cx="12" cy="15" r="2"></circle>
                  </svg>
                </div>
                <span className="sidebar-text">Credit Rate Card</span>
              </NavLink>
            </li>
          </ul>

          <div className="sidebar-group-title" style={{ marginTop: '24px' }}>ACCESS SECURITY</div>
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
                <span className="sidebar-text">Logout Super Admin</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Area */}
      <div className="dash-main-area">
        {/* Super Admin Isolated Header */}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></span>
              <strong style={{ fontSize: '14px', letterSpacing: '0.5px' }}>
                SUPER ADMIN CONTROL PLANE
              </strong>
            </div>
          </div>

          <div className="header-right">
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

            <div className="user-profile-header">
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                SA
              </div>
              <div className="user-info">
                <span className="user-name">{currentUser?.name || 'Super Admin'}</span>
                <span className="user-role" style={{ color: '#EF4444' }}>super_admin</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="btn-secondary-action"
              style={{ fontSize: '12px', padding: '6px 12px', color: '#EF4444' }}
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
    </div>
  );
};

export default SuperAdminLayout;

