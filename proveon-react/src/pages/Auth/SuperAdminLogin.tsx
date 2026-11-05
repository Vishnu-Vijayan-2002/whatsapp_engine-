import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/design-system.css';
import '../SuperAdmin/SuperAdmin.css';

const SuperAdminLogin: React.FC = () => {
  const { loginSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('admin@proveon.io');
  const [password, setPassword] = useState('SuperAdmin@123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await loginSuperAdmin(email, password);
      const destination = (location.state as any)?.from?.pathname || '/super-admin/dashboard';
      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B0F19',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#E2E8F0',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#111827',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Brand / Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
              Prove<span style={{ color: '#4880FF' }}>on</span>
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 900,
                background: '#EF4444',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}
            >
              SUPER ADMIN
            </span>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 6px' }}>
            Platform Control Gateway
          </h2>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
            Restricted access for system administrators & telemetry operators
          </p>
        </div>

        {/* Security Warning Notice */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#FCA5A5',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>All administrative access and rate deployments are cryptographically audited.</span>
        </div>

        {errorMessage && (
          <div
            style={{
              background: '#451A1A',
              border: '1px solid #7F1D1D',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#F87171',
              marginBottom: '20px',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="form-group">
            <label className="form-label" style={{ color: '#CBD5E1' }}>
              Super Admin Email
            </label>
            <input
              type="email"
              className="form-input"
              style={{ background: '#1E293B', borderColor: '#334155', color: '#fff' }}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: '#CBD5E1' }}>
              Secret Passphrase
            </label>
            <input
              type="password"
              className="form-input"
              style={{ background: '#1E293B', borderColor: '#334155', color: '#fff' }}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary-action"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 800,
              background: '#EF4444',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Authenticate Super Admin'}
          </button>
        </form>

        {/* Quick Demo Credentials Fill */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #1E293B', textAlign: 'center' }}>
          <span style={{ fontSize: '11.5px', color: '#64748B', display: 'block', marginBottom: '8px' }}>
            DEMO ACCESS ENVIRONMENT
          </span>
          <button
            type="button"
            className="btn-secondary-action"
            style={{ width: '100%', justifyContent: 'center', fontSize: '12px', color: '#94A3B8', borderColor: '#334155' }}
            onClick={() => {
              setEmail('admin@proveon.io');
              setPassword('SuperAdmin@123');
            }}
          >
            Fill Demo Super Admin (admin@proveon.io)
          </button>
        </div>

        {/* Redirect to Business Login */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <a
            href="/login"
            style={{ fontSize: '12px', color: '#60A5FA', textDecoration: 'none' }}
          >
            Switch to Clinic / Salon Business Login ➔
          </a>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;

