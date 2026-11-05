import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { updateTenantProfile } from '../../firebase/firestoreService';
import './BusinessAdmin.css';
import '../SuperAdmin/SuperAdmin.css';

const SettingsPage: React.FC = () => {
  const { tenant, tenantId } = useTenant();

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [facebook, setFacebook] = useState('');

  // Status
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Populate from tenant
  useEffect(() => {
    if (!tenant) return;
    setBusinessName(tenant.business_name || '');
    setContactPhone(tenant.contact_phone || tenant.admin_phone || '');
    setAddress(tenant.address || '');
    setOperatingHours(tenant.operating_hours || 'Mon - Fri: 9:00 AM - 6:00 PM | Sat: 9:00 AM - 1:00 PM');
    setDescription(tenant.description || '');
    setWebsiteUrl(tenant.website_url || '');
    setLogoUrl(tenant.logo_url || '');
    setInstagram(tenant.social_links?.instagram || '');
    setLinkedin(tenant.social_links?.linkedin || '');
    setFacebook(tenant.social_links?.facebook || '');
  }, [tenant]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      setIsSaving(true);
      setErrorMessage(null);

      await updateTenantProfile(tenantId, {
        business_name: businessName.trim(),
        contact_phone: contactPhone.trim(),
        address: address.trim(),
        operating_hours: operatingHours.trim(),
        description: description.trim(),
        website_url: websiteUrl.trim(),
        logo_url: logoUrl.trim(),
        social_links: {
          instagram: instagram.trim(),
          linkedin: linkedin.trim(),
          facebook: facebook.trim(),
        },
      });

      showToast('Practice configuration and profile settings saved successfully!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dashstack-overview">
      {toastMessage && (
        <div className="super-toast success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Clinic & Practice Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {tenant?.business_name || 'Business'} • Granular Profile Management & Operational Configurations
          </p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {errorMessage && (
          <div className="topup-alert error" style={{ marginBottom: '20px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Locked Identity & Credentials */}
        <div className="dash-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                System-Locked Owner Identity
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                These core administrative identity credentials are fixed for tenant compliance and security.
              </p>
            </div>
            <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', padding: '3px 10px', borderRadius: '12px', fontWeight: 800 }}>
              🔒 ARCHITECTURE PROTECTED
            </span>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Doctor / Owner Full Name</label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Read-Only</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  value={tenant?.admin_name || 'Dr. Administrator'}
                  disabled
                  style={{ background: 'var(--bg-input)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
                />
                <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '14px' }}>
                  🔒
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                System-locked identity. Contact Super Admin to request identity transfer.
              </span>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Registered Email Address</label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Super Admin Approval Required</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-input"
                  value={tenant?.admin_email || 'admin@business.io'}
                  disabled
                  style={{ background: 'var(--bg-input)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
                />
                <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '14px' }}>
                  🔒
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Requires platform Super Admin re-verification before email re-assignment.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Editable Clinic & Profile Settings */}
        <div className="dash-card" style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Practice Information & Operational Details
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Configure public practice name, operating hours, direct phone line, and client consultation profile.
            </p>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Clinic / Practice Name <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Apex Aesthetic Dermatology Clinic"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone / Inbound Line</label>
              <input
                type="text"
                className="form-input"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. +1 (555) 234-5678"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Practice Physical Address</label>
            <input
              type="text"
              className="form-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 450 Lexington Ave, Suite 1400, New York, NY 10017"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Operating Hours</label>
            <input
              type="text"
              className="form-input"
              value={operatingHours}
              onChange={(e) => setOperatingHours(e.target.value)}
              placeholder="e.g. Mon - Fri: 8:30 AM - 6:30 PM | Sat: 9:00 AM - 2:00 PM"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
              Displayed to customers across the WhatsApp Helpdesk node and automated welcome greetings.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Practice / Consultation Description</label>
            <textarea
              rows={3}
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of specialty, certifications, and service philosophy..."
            />
          </div>
        </div>

        {/* Section 3: Branding & Digital Presence */}
        <div className="dash-card" style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Branding & Web Presence
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Add your clinic logo URL, official website link, and social profiles.
            </p>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Clinic Logo / Avatar URL</label>
              <input
                type="url"
                className="form-input"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Official Website URL</label>
              <input
                type="url"
                className="form-input"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://apexaesthetics.com"
              />
            </div>
          </div>

          <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Instagram Handle</label>
              <input
                type="text"
                className="form-input"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@clinic_official"
              />
            </div>

            <div className="form-group">
              <label className="form-label">LinkedIn Page</label>
              <input
                type="text"
                className="form-input"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="company/practice-name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Facebook Profile</label>
              <input
                type="text"
                className="form-input"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="facebook.com/practice"
              />
            </div>
          </div>
        </div>

        {/* Action Save Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingBottom: '30px' }}>
          <button
            type="submit"
            className="btn-primary-action"
            disabled={isSaving}
            style={{ padding: '10px 24px', fontSize: '14px' }}
          >
            {isSaving ? 'Saving Configurations...' : 'Save Settings & Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;

