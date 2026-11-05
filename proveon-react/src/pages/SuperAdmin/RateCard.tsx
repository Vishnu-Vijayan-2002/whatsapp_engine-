import React, { useEffect, useState, useMemo } from 'react';
import './SuperAdmin.css';
import { subscribeToRateCard, deployRateCard } from '../../firebase/firestoreService';
import { DEFAULT_RATE_CARD, type RateCardConfig } from '../../types';

const SuperAdminRateCard: React.FC = () => {
  const [rates, setRates] = useState<RateCardConfig>({ ...DEFAULT_RATE_CARD });
  const [formRates, setFormRates] = useState<RateCardConfig>({ ...DEFAULT_RATE_CARD });
  const [isDeploying, setIsDeploying] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Simulation parameters for impact estimation
  const [simDailyAppointments, setSimDailyAppointments] = useState<number>(25);
  const [simInboundMessagesPerAppt, setSimInboundMessagesPerAppt] = useState<number>(4);

  // Subscribe to rate card in Firestore onSnapshot with proper cleanup
  useEffect(() => {
    const unsub = subscribeToRateCard((newRates) => {
      setRates(newRates);
      setFormRates(newRates);
    });

    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRateChange = (key: keyof RateCardConfig, value: number) => {
    setFormRates((prev) => ({
      ...prev,
      [key]: Math.max(0, value),
    }));
  };

  // Reset to system defaults
  const handleResetDefaults = () => {
    setFormRates({ ...DEFAULT_RATE_CARD });
    showToast('Reset form to system default rates. Click "Save & Deploy Rates" to commit.');
  };

  // Deploy rates to Firestore
  const handleDeployConfirm = async () => {
    try {
      setIsDeploying(true);
      await deployRateCard(formRates, 'super-admin@proveon.io');
      setShowConfirmModal(false);
      showToast('Credit Rate Card successfully updated & deployed to Firestore!');
    } catch (err: any) {
      showToast(err.message || 'Failed to deploy rates', 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  // Has changes compared to deployed rates
  const hasChanges = useMemo(() => {
    return (
      formRates.DB_READ_BURST !== rates.DB_READ_BURST ||
      formRates.DB_WRITE_MUTATION !== rates.DB_WRITE_MUTATION ||
      formRates.STORAGE_INGEST_MB !== rates.STORAGE_INGEST_MB ||
      formRates.WA_INBOUND_PROCESS !== rates.WA_INBOUND_PROCESS ||
      formRates.WA_BOT_STATE_TRANS !== rates.WA_BOT_STATE_TRANS ||
      formRates.AUTOMATED_JOB_DISPATCH !== rates.AUTOMATED_JOB_DISPATCH
    );
  }, [formRates, rates]);

  // Live Daily & Monthly Burn Calculator for sample Clinic / Salon
  const simulatedBurn = useMemo(() => {
    // Per appointment cycle:
    // Inbound messages handled: simInboundMessagesPerAppt * WA_INBOUND_PROCESS
    // Bot state transitions: 2 * WA_BOT_STATE_TRANS
    // Calendar DB Writes: 2 * DB_WRITE_MUTATION
    // History DB Reads: 4 * DB_READ_BURST
    // Storage (patient photo): 0.5 * STORAGE_INGEST_MB
    // Automated reminder job: 1 * AUTOMATED_JOB_DISPATCH

    const costPerAppt =
      simInboundMessagesPerAppt * formRates.WA_INBOUND_PROCESS +
      2 * formRates.WA_BOT_STATE_TRANS +
      2 * formRates.DB_WRITE_MUTATION +
      4 * formRates.DB_READ_BURST +
      0.5 * formRates.STORAGE_INGEST_MB +
      1 * formRates.AUTOMATED_JOB_DISPATCH;

    const dailyCredits = costPerAppt * simDailyAppointments;
    const monthlyCredits = dailyCredits * 30;
    const monthlyCostEstimateUsd = monthlyCredits * 0.10; // $0.10 per credit reference

    return {
      costPerAppt: Number(costPerAppt.toFixed(3)),
      dailyCredits: Number(dailyCredits.toFixed(2)),
      monthlyCredits: Number(monthlyCredits.toFixed(2)),
      monthlyCostEstimateUsd: Number(monthlyCostEstimateUsd.toFixed(2)),
    };
  }, [formRates, simDailyAppointments, simInboundMessagesPerAppt]);

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
          <h1 className="dash-page-title">Dynamic Credit Rate Card Configurator</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Configure global telemetry deduction rates for Firestore operations, storage ingest, and WhatsApp automation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary-action" onClick={handleResetDefaults}>
            Reset to Defaults
          </button>
          <button
            className="btn-primary-action"
            onClick={() => setShowConfirmModal(true)}
            disabled={!hasChanges && !isDeploying}
            style={{ opacity: !hasChanges && !isDeploying ? 0.6 : 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save & Deploy Rates
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="beacon-dot"></div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
            Firestore Document Target: <code style={{ color: 'var(--primary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px' }}>system_config/rate_card</code>
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Last deployed: {rates.updated_at ? new Date(rates.updated_at).toLocaleString() : 'System default'} • By: {rates.updated_by || 'system'}
        </div>
      </div>

      {/* Rate Card Grid */}
      <div className="rate-card-grid">
        {/* 1. DB_READ_BURST */}
        <div className="rate-item-card">
          <div className="rate-item-top">
            <div>
              <div className="rate-item-title">Database Read Burst</div>
              <div className="rate-item-code">DB_READ_BURST</div>
            </div>
            <div className="rate-item-icon" style={{ background: 'rgba(72, 128, 255, 0.12)', color: '#4880FF' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
            </div>
          </div>
          <p className="rate-item-desc">
            Charged when fetching appointment history, patient listings, or customer profile caches. Default: 0.10 credits.
          </p>
          <div className="rate-input-row">
            <input
              type="number"
              step="0.01"
              min="0"
              className="rate-input-field"
              value={formRates.DB_READ_BURST}
              onChange={(e) => handleRateChange('DB_READ_BURST', parseFloat(e.target.value) || 0)}
            />
            <span className="rate-unit-label">credits / read burst</span>
          </div>
        </div>

        {/* 2. DB_WRITE_MUTATION */}
        <div className="rate-item-card">
          <div className="rate-item-top">
            <div>
              <div className="rate-item-title">Database Write Mutation</div>
              <div className="rate-item-code">DB_WRITE_MUTATION</div>
            </div>
            <div className="rate-item-icon" style={{ background: 'rgba(255, 159, 67, 0.14)', color: '#FF9F43' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </div>
          </div>
          <p className="rate-item-desc">
            Charged per write, update, or delete on calendar slots, patient intake forms, or service catalogs. Default: 0.50 credits.
          </p>
          <div className="rate-input-row">
            <input
              type="number"
              step="0.01"
              min="0"
              className="rate-input-field"
              value={formRates.DB_WRITE_MUTATION}
              onChange={(e) => handleRateChange('DB_WRITE_MUTATION', parseFloat(e.target.value) || 0)}
            />
            <span className="rate-unit-label">credits / mutation</span>
          </div>
        </div>

        {/* 3. STORAGE_INGEST_MB */}
        <div className="rate-item-card">
          <div className="rate-item-top">
            <div>
              <div className="rate-item-title">Media & Cloud Storage Ingest</div>
              <div className="rate-item-code">STORAGE_INGEST_MB</div>
            </div>
            <div className="rate-item-icon" style={{ background: 'rgba(239, 56, 38, 0.12)', color: '#EF3826' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
          </div>
          <p className="rate-item-desc">
            Charged for customer consultation photos, hair reference images, and clinic X-rays. Default: 1.00 credit / 10MB.
          </p>
          <div className="rate-input-row">
            <input
              type="number"
              step="0.01"
              min="0"
              className="rate-input-field"
              value={formRates.STORAGE_INGEST_MB}
              onChange={(e) => handleRateChange('STORAGE_INGEST_MB', parseFloat(e.target.value) || 0)}
            />
            <span className="rate-unit-label">credits / 10 MB</span>
          </div>
        </div>

        {/* 4. WA_INBOUND_PROCESS */}
        <div className="rate-item-card">
          <div className="rate-item-top">
            <div>
              <div className="rate-item-title">WhatsApp Inbound Webhook</div>
              <div className="rate-item-code">WA_INBOUND_PROCESS</div>
            </div>
            <div className="rate-item-icon" style={{ background: 'rgba(0, 182, 155, 0.12)', color: '#00B69B' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
          </div>
          <p className="rate-item-desc">
            Processing incoming Meta Webhook messages, session dispatch, and natural language intent parsing. Default: 0.25 credits.
          </p>
          <div className="rate-input-row">
            <input
              type="number"
              step="0.01"
              min="0"
              className="rate-input-field"
              value={formRates.WA_INBOUND_PROCESS}
              onChange={(e) => handleRateChange('WA_INBOUND_PROCESS', parseFloat(e.target.value) || 0)}
            />
            <span className="rate-unit-label">credits / message</span>
          </div>
        </div>

        {/* 5. WA_BOT_STATE_TRANS */}
        <div className="rate-item-card">
          <div className="rate-item-top">
            <div>
              <div className="rate-item-title">WhatsApp Bot State Transition</div>
              <div className="rate-item-code">WA_BOT_STATE_TRANS</div>
            </div>
            <div className="rate-item-icon" style={{ background: 'rgba(130, 128, 255, 0.14)', color: '#8280FF' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
          </div>
          <p className="rate-item-desc">
            Automated conversation flow transition (e.g., SELECT_SERVICE → CONFIRM_BOOKING). Default: 0.50 credits.
          </p>
          <div className="rate-input-row">
            <input
              type="number"
              step="0.01"
              min="0"
              className="rate-input-field"
              value={formRates.WA_BOT_STATE_TRANS}
              onChange={(e) => handleRateChange('WA_BOT_STATE_TRANS', parseFloat(e.target.value) || 0)}
            />
            <span className="rate-unit-label">credits / transition</span>
          </div>
        </div>

        {/* 6. AUTOMATED_JOB_DISPATCH */}
        <div className="rate-item-card">
          <div className="rate-item-top">
            <div>
              <div className="rate-item-title">Automated Job / Reminders</div>
              <div className="rate-item-code">AUTOMATED_JOB_DISPATCH</div>
            </div>
            <div className="rate-item-icon" style={{ background: 'rgba(156, 39, 176, 0.12)', color: '#9c27b0' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>
          <p className="rate-item-desc">
            Scheduled cron jobs, 24h & 2h appointment reminder dispatches, and follow-up review prompts. Default: 0.50 credits.
          </p>
          <div className="rate-input-row">
            <input
              type="number"
              step="0.01"
              min="0"
              className="rate-input-field"
              value={formRates.AUTOMATED_JOB_DISPATCH}
              onChange={(e) => handleRateChange('AUTOMATED_JOB_DISPATCH', parseFloat(e.target.value) || 0)}
            />
            <span className="rate-unit-label">credits / dispatch</span>
          </div>
        </div>
      </div>

      {/* Live Impact Estimator */}
      <div className="rate-preview-calc">
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h4>Live Tenant Burn Impact Estimator</h4>
          <p>
            Estimate credit consumption for an average busy clinic or salon based on proposed rates:
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Daily Bookings:
              <input
                type="number"
                min="1"
                max="200"
                value={simDailyAppointments}
                onChange={(e) => setSimDailyAppointments(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '60px',
                  marginLeft: '8px',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-light)',
                  fontFamily: 'inherit',
                  fontWeight: 800,
                }}
              />
            </label>

            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Inbound Msgs / Booking:
              <input
                type="number"
                min="1"
                max="20"
                value={simInboundMessagesPerAppt}
                onChange={(e) => setSimInboundMessagesPerAppt(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '50px',
                  marginLeft: '8px',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-light)',
                  fontFamily: 'inherit',
                  fontWeight: 800,
                }}
              />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Per Booking Cycle</span>
            <strong style={{ fontSize: '18px', color: 'var(--text-main)' }}>~{simulatedBurn.costPerAppt} cr</strong>
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-light)', paddingLeft: '20px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Monthly Projected Burn</span>
            <strong style={{ fontSize: '20px', color: 'var(--primary)' }}>
              ~{simulatedBurn.monthlyCredits.toLocaleString()} cr
            </strong>
            <span style={{ display: 'block', fontSize: '11px', color: '#00B69B', fontWeight: 700 }}>
              ≈ ${simulatedBurn.monthlyCostEstimateUsd} / month
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Deploy Rate Card to Firestore?</h3>
              <button className="modal-close-btn" onClick={() => setShowConfirmModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Deploying these rates will immediately affect credit deduction for all active tenant operations across Meta WhatsApp webhooks, bot transitions, and DB queries.
              </p>
              <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px' }}>
                <div>• DB_READ_BURST: <strong>{formRates.DB_READ_BURST}</strong> cr</div>
                <div>• DB_WRITE_MUTATION: <strong>{formRates.DB_WRITE_MUTATION}</strong> cr</div>
                <div>• STORAGE_INGEST_MB: <strong>{formRates.STORAGE_INGEST_MB}</strong> cr</div>
                <div>• WA_INBOUND_PROCESS: <strong>{formRates.WA_INBOUND_PROCESS}</strong> cr</div>
                <div>• WA_BOT_STATE_TRANS: <strong>{formRates.WA_BOT_STATE_TRANS}</strong> cr</div>
                <div>• AUTOMATED_JOB_DISPATCH: <strong>{formRates.AUTOMATED_JOB_DISPATCH}</strong> cr</div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary-action" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary-action"
                onClick={handleDeployConfirm}
                disabled={isDeploying}
              >
                {isDeploying ? 'Deploying...' : 'Yes, Deploy Rates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminRateCard;

