import React, { useEffect, useState, useMemo } from 'react';
import './SuperAdmin.css';
import {
  subscribeToTenants,
  subscribeToUsageAuditLogs,
  provisionTenant,
  adjustTenantCredits,
  toggleTenantStatus,
} from '../../firebase/firestoreService';
import { provisionBusinessAdminUser } from '../../firebase/authService';
import type { Tenant, UsageAuditLog, TenantStatus, TenantVertical } from '../../types';

const SuperAdminTenants: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<UsageAuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verticalFilter, setVerticalFilter] = useState<string>('ALL');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTenantForDetails, setSelectedTenantForDetails] = useState<Tenant | null>(null);
  const [selectedTenantForTopUp, setSelectedTenantForTopUp] = useState<Tenant | null>(null);

  // Form states for Create Tenant
  const [businessName, setBusinessName] = useState('');
  const [vertical, setVertical] = useState<TenantVertical>('Clinic');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [initialCredits, setInitialCredits] = useState<number>(500);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState<number>(50);
  const [wabaPhoneId, setWabaPhoneId] = useState('');
  const [wabaAccountId, setWabaAccountId] = useState('');
  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);

  // Form states for Credit Top-Up / Adjustment
  const [creditAdjustmentType, setCreditAdjustmentType] = useState<'TOP_UP' | 'DEDUCT'>('TOP_UP');
  const [creditAmount, setCreditAmount] = useState<number>(100);
  const [adminNote, setAdminNote] = useState('');
  const [isSubmittingCredit, setIsSubmittingCredit] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Subscribe to Tenants onSnapshot with proper cleanup
  useEffect(() => {
    const unsubTenants = subscribeToTenants((data) => {
      setTenants(data);
    });

    return () => {
      if (typeof unsubTenants === 'function') {
        unsubTenants();
      }
    };
  }, []);

  // Subscribe to Usage Audit Logs for detail viewing
  useEffect(() => {
    const unsubLogs = subscribeToUsageAuditLogs((logs) => {
      setAuditLogs(logs);
    }, 150);

    return () => {
      if (typeof unsubLogs === 'function') {
        unsubLogs();
      }
    };
  }, []);

  // Filtered tenants list
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tenant_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.admin_name && t.admin_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.admin_email && t.admin_email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || t.status === statusFilter;

      const matchesVertical =
        verticalFilter === 'ALL' || t.vertical === verticalFilter;

      return matchesSearch && matchesStatus && matchesVertical;
    });
  }, [tenants, searchQuery, statusFilter, verticalFilter]);

  // Handle Create Tenant
  const handleCreateTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !adminEmail.trim() || !adminPhone.trim()) {
      showToast('Please fill out all required fields', 'error');
      return;
    }

    try {
      setIsSubmittingTenant(true);
      const created = await provisionTenant({
        business_name: businessName.trim(),
        vertical,
        admin_name: adminName.trim() || 'Administrator',
        admin_email: adminEmail.trim(),
        admin_phone: adminPhone.trim(),
        initial_credits: Number(initialCredits) || 500,
        low_balance_threshold: Number(lowBalanceThreshold) || 50,
        phone_number_id: wabaPhoneId.trim() || undefined,
        waba_account_id: wabaAccountId.trim() || undefined,
      });

      // Automatically provision Business Admin user login profile
      try {
        await provisionBusinessAdminUser({
          email: adminEmail.trim(),
          name: adminName.trim() || 'Administrator',
          tenant_id: created.tenant_id,
        });
      } catch (authErr) {
        console.warn('Failed to auto-provision user profile:', authErr);
      }

      showToast(`Tenant "${created.business_name}" provisioned successfully with ${initialCredits} credits! Admin access generated for ${adminEmail.trim()}.`);
      // Reset form
      setBusinessName('');
      setAdminName('');
      setAdminEmail('');
      setAdminPhone('');
      setWabaPhoneId('');
      setWabaAccountId('');
      setInitialCredits(500);
      setLowBalanceThreshold(50);
      setShowCreateModal(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to provision tenant', 'error');
    } finally {
      setIsSubmittingTenant(false);
    }
  };

  // Handle Credit Adjustment
  const handleAdjustCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForTopUp) return;

    if (!adminNote.trim()) {
      showToast('An Admin Note / Reason is required for audit logs compliance', 'error');
      return;
    }

    if (!creditAmount || creditAmount <= 0) {
      showToast('Please enter a valid credit amount', 'error');
      return;
    }

    try {
      setIsSubmittingCredit(true);
      const delta = creditAdjustmentType === 'TOP_UP' ? creditAmount : -creditAmount;
      const res = await adjustTenantCredits({
        tenant_id: selectedTenantForTopUp.tenant_id,
        amount: delta,
        note: adminNote.trim(),
        adminId: 'super-admin@proveon.io',
      });

      showToast(
        `Successfully ${delta > 0 ? 'added' : 'deducted'} ${Math.abs(delta)} credits. New balance: ${res.newBalance.toFixed(2)} cr`
      );
      setSelectedTenantForTopUp(null);
      setAdminNote('');
      setCreditAmount(100);
    } catch (err: any) {
      showToast(err.message || 'Failed to adjust credits', 'error');
    } finally {
      setIsSubmittingCredit(false);
    }
  };

  // Handle Status Toggle (Suspend / Reactivate)
  const handleToggleStatus = async (tenant: Tenant) => {
    const nextStatus: TenantStatus = tenant.status === 'Suspended' ? 'Active' : 'Suspended';
    try {
      await toggleTenantStatus(tenant.tenant_id, nextStatus);
      showToast(`Tenant "${tenant.business_name}" marked as ${nextStatus}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Helpers for vertical badge styling
  const getVerticalClass = (v: string) => {
    switch (v) {
      case 'Clinic':
        return 'vertical-badge clinic';
      case 'Salon':
        return 'vertical-badge salon';
      case 'Dental Care':
        return 'vertical-badge dental';
      case 'Wellness Center':
        return 'vertical-badge wellness';
      case 'Aesthetics Studio':
        return 'vertical-badge aesthetics';
      default:
        return 'vertical-badge clinic';
    }
  };

  return (
    <div className="dashstack-overview">
      {/* Toast */}
      {toastMessage && (
        <div className={`super-toast ${toastMessage.type}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {toastMessage.type === 'success' ? (
              <polyline points="20 6 9 17 4 12"></polyline>
            ) : (
              <circle cx="12" cy="12" r="10"></circle>
            )}
          </svg>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Tenant Management Engine</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Provision clinics & salons, manage credit wallets, and oversee WhatsApp Business API integrations
          </p>
        </div>
        <button
          className="btn-primary-action"
          onClick={() => setShowCreateModal(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Provision New Tenant
        </button>
      </div>

      {/* Tenant Table Section */}
      <div className="dash-card">
        {/* Search & Filter Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                style={{ position: 'absolute', left: '12px', top: '11px' }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search by business name, tenant ID, or admin email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 14px 9px 36px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontFamily: 'inherit',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status Filter */}
            <select
              className="telemetry-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Low Balance">Low Balance</option>
              <option value="Suspended">Suspended</option>
            </select>

            {/* Vertical Filter */}
            <select
              className="telemetry-select"
              value={verticalFilter}
              onChange={(e) => setVerticalFilter(e.target.value)}
            >
              <option value="ALL">All Verticals</option>
              <option value="Clinic">Clinic</option>
              <option value="Salon">Salon</option>
              <option value="Dental Care">Dental Care</option>
              <option value="Wellness Center">Wellness Center</option>
              <option value="Aesthetics Studio">Aesthetics Studio</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="dash-table-responsive">
          <table className="dash-data-table">
            <thead>
              <tr>
                <th>Tenant Name & ID</th>
                <th>Vertical</th>
                <th>Status</th>
                <th>Current Wallet Balance</th>
                <th>Lifetime Consumed</th>
                <th>Meta WhatsApp (WABA)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No tenants found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isLow = (t.credit_wallet?.balance || 0) < (t.credit_wallet?.low_balance_threshold || 50);

                  return (
                    <tr key={t.id || t.tenant_id} className={isLow ? 'table-row-low-balance' : ''}>
                      {/* Tenant Name & ID */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                            {t.business_name}
                          </span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              color: 'var(--primary)',
                              background: 'var(--primary-light)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              width: 'fit-content',
                            }}
                          >
                            {t.tenant_id}
                          </span>
                          {t.admin_email && (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              {t.admin_name} • {t.admin_email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Vertical */}
                      <td>
                        <span className={getVerticalClass(t.vertical)}>
                          {t.vertical}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`status-pill ${
                            t.status === 'Active'
                              ? 'active'
                              : t.status === 'Low Balance'
                              ? 'pending'
                              : 'suspended'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      {/* Wallet Balance with Low Balance alert indicator */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '15px',
                              fontWeight: 800,
                              color: isLow ? '#EF3826' : 'var(--text-main)',
                            }}
                          >
                            {(t.credit_wallet?.balance || 0).toFixed(2)} cr
                          </span>
                          {isLow && (
                            <span className="low-balance-alert" title={`Below threshold of ${t.credit_wallet?.low_balance_threshold} cr`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              LOW
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Alert limit: {t.credit_wallet?.low_balance_threshold ?? 50} cr
                        </span>
                      </td>

                      {/* Lifetime Consumed */}
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {(t.credit_wallet?.lifetime_consumed || 0).toFixed(2)} cr
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Granted: {(t.credit_wallet?.lifetime_granted || 0).toFixed(2)} cr
                        </div>
                      </td>

                      {/* Meta WhatsApp Integration */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: t.waba_integration?.status === 'CONNECTED' ? '#00B69B' : '#EF3826',
                              }}
                            ></span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {t.waba_integration?.status || 'CONNECTED'}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {t.waba_integration?.phone_number_id ? `ID: ${t.waba_integration.phone_number_id.slice(0, 10)}...` : 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {/* Details / Logs */}
                          <button
                            className="btn-secondary-action"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            onClick={() => setSelectedTenantForDetails(t)}
                            title="View Tenant Audit Logs & Meta Details"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="16" x2="12" y2="12"></line>
                              <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            History
                          </button>

                          {/* Manual Top-up / Adjustment */}
                          <button
                            className="btn-secondary-action"
                            style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--primary)', borderColor: 'var(--primary-border)' }}
                            onClick={() => setSelectedTenantForTopUp(t)}
                            title="Adjust or Top-Up Credits"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Credits
                          </button>

                          {/* Pause / Reactivate status toggle */}
                          <button
                            className="btn-secondary-action"
                            style={{
                              padding: '6px 10px',
                              fontSize: '12px',
                              color: t.status === 'Suspended' ? '#00B69B' : '#EF3826',
                            }}
                            onClick={() => handleToggleStatus(t)}
                            title={t.status === 'Suspended' ? 'Reactivate Tenant' : 'Suspend Tenant'}
                          >
                            {t.status === 'Suspended' ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                                Activate
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="6" y="4" width="4" height="16"></rect>
                                  <rect x="14" y="4" width="4" height="16"></rect>
                                </svg>
                                Suspend
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create / Provision New Tenant */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Provision New Business Tenant</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTenantSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Business / Clinic Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. PureSkin Laser & Dermatology"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Industry Vertical <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={vertical}
                      onChange={(e) => setVertical(e.target.value as TenantVertical)}
                    >
                      <option value="Clinic">Medical Clinic</option>
                      <option value="Salon">Hair & Beauty Salon</option>
                      <option value="Dental Care">Dental Clinic</option>
                      <option value="Wellness Center">Wellness & Spa</option>
                      <option value="Aesthetics Studio">Aesthetics Studio</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Admin Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dr. Emily Chen"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Admin Email Address <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="admin@pureskin.com"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Phone Number <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+1 (555) 987-6543"
                      required
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Initial Free Credits <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={initialCredits}
                      onChange={(e) => setInitialCredits(Number(e.target.value))}
                    />
                    <span className="form-help">Default allocation for newly provisioned businesses</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Low Balance Threshold <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={lowBalanceThreshold}
                      onChange={(e) => setLowBalanceThreshold(Number(e.target.value))}
                    />
                    <span className="form-help">Trigger amber warning below this credit level</span>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                    Meta WhatsApp Integration (Optional)
                  </span>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>Phone Number ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Leave blank for auto-generated ID"
                        value={wabaPhoneId}
                        onChange={(e) => setWabaPhoneId(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>WABA Account ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Leave blank for auto-generated ID"
                        value={wabaAccountId}
                        onChange={(e) => setWabaAccountId(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isSubmittingTenant}
                >
                  {isSubmittingTenant ? 'Provisioning...' : 'Provision Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Manual Credit Top-Up / Adjustment */}
      {selectedTenantForTopUp && (
        <div className="modal-overlay" onClick={() => setSelectedTenantForTopUp(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Manual Credit Adjustment</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {selectedTenantForTopUp.business_name} ({selectedTenantForTopUp.tenant_id})
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedTenantForTopUp(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleAdjustCreditSubmit}>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn-secondary-action ${creditAdjustmentType === 'TOP_UP' ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      background: creditAdjustmentType === 'TOP_UP' ? 'rgba(0, 182, 155, 0.15)' : 'var(--bg-input)',
                      borderColor: creditAdjustmentType === 'TOP_UP' ? '#00B69B' : 'var(--border-light)',
                      color: creditAdjustmentType === 'TOP_UP' ? '#00B69B' : 'var(--text-main)',
                      fontWeight: 800,
                    }}
                    onClick={() => setCreditAdjustmentType('TOP_UP')}
                  >
                    + Grant / Top-Up Credits
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary-action ${creditAdjustmentType === 'DEDUCT' ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      background: creditAdjustmentType === 'DEDUCT' ? 'rgba(239, 56, 38, 0.15)' : 'var(--bg-input)',
                      borderColor: creditAdjustmentType === 'DEDUCT' ? '#EF3826' : 'var(--border-light)',
                      color: creditAdjustmentType === 'DEDUCT' ? '#EF3826' : 'var(--text-main)',
                      fontWeight: 800,
                    }}
                    onClick={() => setCreditAdjustmentType('DEDUCT')}
                  >
                    - Deduct Credits
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Credit Amount <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    className="form-input"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                    required
                  />
                  <span className="form-help">
                    Current Balance: <strong>{selectedTenantForTopUp.credit_wallet.balance.toFixed(2)} cr</strong> • 
                    Projected Balance: <strong style={{ color: 'var(--primary)' }}>
                      {(
                        creditAdjustmentType === 'TOP_UP'
                          ? selectedTenantForTopUp.credit_wallet.balance + creditAmount
                          : selectedTenantForTopUp.credit_wallet.balance - creditAmount
                      ).toFixed(2)} cr
                    </strong>
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Admin Note / Compliance Reason <span className="required">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className="form-textarea"
                    placeholder="Provide mandatory business reason for this adjustment (e.g., 'Monthly complimentary allowance', 'Refund for gateway outage')..."
                    required
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                  />
                  <span className="form-help">
                    This reason will be permanently recorded in the immutable `usage_audit_logs` collection.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setSelectedTenantForTopUp(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isSubmittingCredit}
                >
                  {isSubmittingCredit ? 'Processing...' : 'Apply Wallet Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Tenant Details & Activity History Drawer */}
      {selectedTenantForDetails && (
        <div className="modal-overlay" onClick={() => setSelectedTenantForDetails(null)}>
          <div className="modal-card" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedTenantForDetails.business_name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Tenant ID: {selectedTenantForDetails.tenant_id} • {selectedTenantForDetails.vertical}
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedTenantForDetails(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Wallet Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>WALLET BALANCE</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                    {selectedTenantForDetails.credit_wallet.balance.toFixed(2)} cr
                  </div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>LIFETIME GRANTED</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#00B69B', marginTop: '4px' }}>
                    {selectedTenantForDetails.credit_wallet.lifetime_granted.toFixed(2)} cr
                  </div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>LIFETIME CONSUMED</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#EF3826', marginTop: '4px' }}>
                    {selectedTenantForDetails.credit_wallet.lifetime_consumed.toFixed(2)} cr
                  </div>
                </div>
              </div>

              {/* Meta WhatsApp Integration specs */}
              <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                  Meta WhatsApp Business Integration
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12.5px' }}>
                  <div><strong>Phone Number ID:</strong> {selectedTenantForDetails.waba_integration?.phone_number_id || 'N/A'}</div>
                  <div><strong>WABA Account ID:</strong> {selectedTenantForDetails.waba_integration?.waba_account_id || 'N/A'}</div>
                  <div><strong>Verified Name:</strong> {selectedTenantForDetails.waba_integration?.verified_name || selectedTenantForDetails.business_name}</div>
                  <div><strong>Status:</strong> <span style={{ color: '#00B69B', fontWeight: 800 }}>{selectedTenantForDetails.waba_integration?.status || 'CONNECTED'}</span></div>
                </div>
              </div>

              {/* Activity History for this tenant */}
              <div>
                <h4 style={{ margin: '14px 0 10px', fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Tenant Credit Audit History
                </h4>
                <div className="dash-table-responsive" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  <table className="dash-data-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Credits</th>
                        <th>Balance (Prior → Post)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs
                        .filter((l) => l.tenant_id === selectedTenantForDetails.tenant_id)
                        .slice(0, 20)
                        .map((l) => (
                          <tr key={l.id || l.log_id}>
                            <td style={{ fontSize: '12px' }}>
                              {l.timestamp
                                ? new Date(typeof l.timestamp === 'number' ? l.timestamp : (l.timestamp.toDate ? l.timestamp.toDate() : l.timestamp)).toLocaleTimeString()
                                : 'Just now'}
                            </td>
                            <td>
                              <span style={{ fontWeight: 700, fontSize: '12px' }}>{l.operation?.action_code}</span>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.operation?.description}</div>
                            </td>
                            <td>
                              {l.financials.credits_deducted > 0 ? (
                                <span style={{ color: '#EF3826', fontWeight: 700 }}>-{l.financials.credits_deducted.toFixed(2)} cr</span>
                              ) : (
                                <span style={{ color: '#00B69B', fontWeight: 700 }}>+{Math.abs(l.financials.credits_deducted).toFixed(2)} cr</span>
                              )}
                            </td>
                            <td style={{ fontSize: '12px' }}>
                              {l.financials.balance_prior?.toFixed(2)} → <strong>{l.financials.balance_post?.toFixed(2)}</strong>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary-action" onClick={() => setSelectedTenantForDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminTenants;
