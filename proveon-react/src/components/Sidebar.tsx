import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

interface SidebarProps {
  role: 'super' | 'business';
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ role, collapsed = false }) => {
  return (
    <aside className={`dash-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand */}
      <div className="dash-brand">
        <span className="brand-logo-text">
          <span className="brand-dash">Dash</span>
          <span className="brand-stack">Stack</span>
        </span>
        <span className="brand-badge">{role === 'super' ? 'PRO' : 'BIZ'}</span>
      </div>

      <div className="sidebar-scroll-area">
        <div className="sidebar-group-title">MAIN MENU</div>
        <ul className="sidebar-nav-list">
          <li>
            <NavLink 
              to={role === 'super' ? '/super/overview' : '/business/dashboard'} 
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

          {role === 'super' ? (
            <>
              <li>
                <NavLink to="/super/tenants" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <div className="sidebar-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                  <span className="sidebar-text">Tenants</span>
                  <span className="nav-pill">PROV</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/super/rate-card" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <div className="sidebar-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                      <line x1="1" y1="10" x2="23" y2="10"></line>
                      <circle cx="12" cy="15" r="2"></circle>
                    </svg>
                  </div>
                  <span className="sidebar-text">Rate Card</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/super/subscriptions" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <div className="sidebar-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                      <line x1="2" y1="10" x2="22" y2="10"></line>
                    </svg>
                  </div>
                  <span className="sidebar-text">Subscriptions</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/super/revenue" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <div className="sidebar-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                  </div>
                  <span className="sidebar-text">Revenue & MRR</span>
                </NavLink>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink to="/business/customers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
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
                <NavLink to="/business/media" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
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
                <NavLink to="/business/whatsapp" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <div className="sidebar-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  <span className="sidebar-text">WhatsApp Flow</span>
                </NavLink>
              </li>
            </>
          )}

          <div className="sidebar-group-title">PAGES & TOOLS</div>

          <li>
            <NavLink to="/super/inbox" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <div className="sidebar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <span className="sidebar-text">Inbox</span>
              <span className="nav-pill blue">8</span>
            </NavLink>
          </li>

          <li>
            <NavLink to="/super/order-lists" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <div className="sidebar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </div>
              <span className="sidebar-text">Order Lists</span>
            </NavLink>
          </li>

          <li>
            <NavLink to="/super/product-stock" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <div className="sidebar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <span className="sidebar-text">Product Stock</span>
            </NavLink>
          </li>

          <div className="sidebar-group-title">SETTINGS</div>

          <li>
            <NavLink to="/super/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <div className="sidebar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <span className="sidebar-text">Settings</span>
            </NavLink>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
