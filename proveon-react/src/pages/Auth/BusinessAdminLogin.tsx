import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/design-system.css';
import '../SuperAdmin/SuperAdmin.css';

const BusinessAdminLogin: React.FC = () => {
  const { loginBusinessAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('sarah.mitchell@apexaesthetics.com');
  const [password, setPassword] = useState('ApexClinic@123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await loginBusinessAdmin(email, password);
      const destination = (location.state as any)?.from?.pathname || '/app/dashboard';
      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please contact your Super Admin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F1F4F9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '40px 36px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Brand / Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '26px', fontWeight: 900, color: '#1E293B', letterSpacing: '-0.5px' }}>
              Prove<span style={{ color: '#4880FF' }}>on</span>
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                background: 'rgba(72, 128, 255, 0.12)',
                color: '#4880FF',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              BUSINESS PORTAL
            </span>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>
            Welcome to Your Business Workspace
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Client appointment scheduling, media records & Meta WhatsApp automation
          </p>
        </div>

        {/* Provisioning Notice */}
        <div
          style={{
            background: 'rgba(72, 128, 255, 0.08)',
            border: '1px solid rgba(72, 128, 255, 0.2)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#3B82F6',
            marginBottom: '20px',
            lineHeight: 1.45,
          }}
        >
          <strong>Notice:</strong> Business accounts are provisioned exclusively by the platform Super Admin. Public self-registration is closed.
        </div>

        {errorMessage && (
          <div
            style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#DC2626',
              marginBottom: '20px',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="form-group">
            <label className="form-label">Clinic / Salon Admin Email</label>
            <input
              type="email"
              className="form-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sarah.mitchell@apexaesthetics.com"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                onClick={() => alert('Password reset links must be issued by the Proveon Super Admin team (support@proveon.io).')}
                style={{ background: 'transparent', border: 'none', color: '#4880FF', fontSize: '12px', cursor: 'pointer', padding: 0 }}
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              className="form-input"
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
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In to Workspace'}
          </button>
        </form>

        {/* Quick Demo Fill Buttons for Testing */}
        <div style={{ marginTop: '26px', paddingTop: '18px', borderTop: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Instant Demo Account Sign-In:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary-action"
              style={{ justifyContent: 'flex-start', fontSize: '12px', padding: '8px 12px' }}
              onClick={() => {
                setEmail('sarah.mitchell@apexaesthetics.com');
                setPassword('ApexClinic@123');
              }}
            >
              <span className="vertical-badge clinic" style={{ fontSize: '10px', padding: '1px 6px' }}>CLINIC</span>
              Apex Aesthetic Clinic (Dr. Sarah Mitchell)
            </button>

            <button
              type="button"
              className="btn-secondary-action"
              style={{ justifyContent: 'flex-start', fontSize: '12px', padding: '8px 12px' }}
              onClick={() => {
                setEmail('elena@luxeradiance.com');
                setPassword('LuxeSalon@123');
              }}
            >
              <span className="vertical-badge salon" style={{ fontSize: '10px', padding: '1px 6px' }}>SALON</span>
              Luxe Radiance Salon (Elena Rostova)
            </button>

            <button
              type="button"
              className="btn-secondary-action"
              style={{ justifyContent: 'flex-start', fontSize: '12px', padding: '8px 12px' }}
              onClick={() => {
                setEmail('dr.mehta@mehtadental.org');
                setPassword('DentalMehta@123');
              }}
            >
              <span className="vertical-badge dental" style={{ fontSize: '10px', padding: '1px 6px' }}>DENTAL</span>
              Dr. Mehta Dental (Dr. Rajiv Mehta)
            </button>
          </div>
        </div>

        {/* Super Admin Switch */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <a
            href="/super-admin/login"
            style={{ fontSize: '12px', color: '#64748B', textDecoration: 'none' }}
          >
            Looking for Super Admin Portal? ➔
          </a>
        </div>
      </div>
    </div>
  );
};

export default BusinessAdminLogin;

