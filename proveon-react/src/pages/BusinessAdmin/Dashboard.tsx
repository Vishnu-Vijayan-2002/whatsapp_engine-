import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import {
  subscribeTenantAuditLogs,
  subscribeCustomers,
  subscribeAppointments,
  subscribeMediaFiles,
  subscribeCapturedSubmissions,
  translateActionCode,
  generateSimulatedTelemetryEvent,
} from '../../firebase/firestoreService';
import type { UsageAuditLog, Customer, Appointment, MediaFile, CapturedFlowSubmission } from '../../types';
import './BusinessAdmin.css';
import '../SuperAdmin/SuperAdmin.css';

const BusinessDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    tenant,
    tenantId,
    isLowBalance,
    setRechargeModalOpen,
  } = useTenant();

  const [auditLogs, setAuditLogs] = useState<UsageAuditLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [submissions, setSubmissions] = useState<CapturedFlowSubmission[]>([]);
  const [isSimulatingBot, setIsSimulatingBot] = useState(false);

  // Real-time live listener for this tenant's usage audit logs
  useEffect(() => {
    if (!tenantId) return;

    const unsubLogs = subscribeTenantAuditLogs(tenantId, (logs) => {
      setAuditLogs(logs);
    }, 40);

    const unsubCust = subscribeCustomers(tenantId, (list) => {
      setCustomers(list);
    });

    const unsubAppts = subscribeAppointments(tenantId, (list) => {
      setAppointments(list);
    });

    const unsubMedia = subscribeMediaFiles(tenantId, (list) => {
      setMediaFiles(list);
    });

    const unsubSubs = subscribeCapturedSubmissions(tenantId, (list) => {
      setSubmissions(list);
    });

    return () => {
      unsubLogs();
      unsubCust();
      unsubAppts();
      unsubMedia();
      unsubSubs();
    };
  }, [tenantId]);

  const handleSimulateInboundWhatsApp = async () => {
    try {
      setIsSimulatingBot(true);
      await generateSimulatedTelemetryEvent();
    } finally {
      setIsSimulatingBot(false);
    }
  };

  const balance = tenant?.credit_wallet?.balance ?? 0;
  const threshold = tenant?.credit_wallet?.low_balance_threshold ?? 50;

  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    const d = typeof ts === 'number' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    const d = typeof ts === 'number' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="biz-overview-container">
      {/* Top Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">
            {tenant?.business_name || 'Business Admin Dashboard'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {tenant?.vertical || 'Service Business'} Portal • Real-time Metered Operations & WhatsApp Engine
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-secondary-action"
            onClick={handleSimulateInboundWhatsApp}
            disabled={isSimulatingBot || balance <= 0}
            title="Simulate receiving an inbound patient WhatsApp inquiry"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {isSimulatingBot ? 'Simulating...' : 'Simulate Inbound WhatsApp'}
          </button>

          <button
            className="btn-primary-action"
            onClick={() => navigate('/app/customers')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Appointment
          </button>
        </div>
      </div>

      {/* Module A.1: Low Balance Warning Banner */}
      {isLowBalance && (
        <div className="low-balance-banner">
          <div className="low-balance-banner-left">
            <div className="low-balance-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <strong style={{ fontSize: '15px', color: '#B91C1C', display: 'block' }}>
                Low Credit Balance Alert: {balance.toFixed(2)} Credits Remaining
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Your wallet is below the alert threshold ({threshold} cr). When balance reaches 0.00 cr, automated WhatsApp booking responses and media uploads pause.
              </span>
            </div>
          </div>

          <button
            className="btn-primary-action"
            style={{ background: '#EF3826', boxShadow: '0 4px 12px rgba(239, 56, 38, 0.3)' }}
            onClick={() => setRechargeModalOpen(true)}
          >
            Recharge Credits Now
          </button>
        </div>
      )}

      {/* Quick Action Bar */}
      <div className="biz-quick-actions">
        <span className="biz-quick-actions-title">QUICK ACTIONS:</span>
        <button
          className="btn-secondary-action"
          onClick={() => navigate('/app/customers')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          Add Client / Patient (-0.50 cr)
        </button>

        <button
          className="btn-secondary-action"
          onClick={() => navigate('/app/media')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Upload X-Ray / Photo
        </button>

        <button
          className="btn-secondary-action"
          onClick={() => navigate('/app/whatsapp')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Configure WhatsApp Flow
        </button>
      </div>

      {/* 4 KPI Metrics Cards */}
      <section className="biz-kpi-grid">
        {/* Wallet Balance Card */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Current Wallet Balance</span>
              <span
                className="kpi-number"
                style={{ color: isLowBalance ? '#EF3826' : 'var(--text-main)' }}
              >
                {balance.toFixed(2)} <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>cr</span>
              </span>
            </div>
            <div
              className="kpi-icon-bubble"
              style={{
                background: isLowBalance ? 'rgba(239, 56, 38, 0.14)' : 'rgba(72, 128, 255, 0.12)',
                color: isLowBalance ? '#EF3826' : 'var(--primary)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-label">
              Lifetime Consumed: <strong>{(tenant?.credit_wallet?.lifetime_consumed || 0).toFixed(2)} cr</strong>
            </span>
          </div>
        </div>

        {/* Confirmed Appointments */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Scheduled Visits</span>
              <span className="kpi-number">{appointments.length}</span>
            </div>
            <div className="kpi-icon-bubble green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">
              {appointments.filter((a) => a.status === 'CONFIRMED').length} Confirmed
            </span>
            <span className="trend-label">upcoming visits</span>
          </div>
        </div>

        {/* Active Client Profiles */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Registered Clients</span>
              <span className="kpi-number">{customers.length}</span>
            </div>
            <div className="kpi-icon-bubble purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">Metered Writes</span>
            <span className="trend-label">stored in Firestore</span>
          </div>
        </div>

        {/* Media / Files Uploaded */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Media & Cloud Files</span>
              <span className="kpi-number">{mediaFiles.length}</span>
            </div>
            <div className="kpi-icon-bubble yellow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">
              {mediaFiles.reduce((acc, m) => acc + (m.file_size_mb || 0), 0).toFixed(1)} MB
            </span>
            <span className="trend-label">total storage utilized</span>
          </div>
        </div>
      </section>

      {/* Direct In-WhatsApp Captured Leads & Automated Bookings Section */}
      <section className="dash-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="dash-section-title" style={{ margin: 0 }}>
                Direct In-WhatsApp Submissions & Captured Leads
              </h2>
              <span className="live-beacon">
                <span className="beacon-dot"></span>
                BACKEND RULE ENGINE
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
              Data captured directly within WhatsApp conversational flows without external redirects, auto-processed into database records.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn-primary-action"
              style={{ fontSize: '12.5px', padding: '7px 14px' }}
              onClick={() => navigate('/app/whatsapp')}
            >
              🔀 Visual Flow Builder
            </button>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>💬</div>
            <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-main)' }}>
              No in-chat WhatsApp submissions captured yet
            </strong>
            <span style={{ fontSize: '12.5px' }}>
              Open the Visual Flow Builder to test the interactive WhatsApp simulator!
            </span>
          </div>
        ) : (
          <div className="dash-table-responsive">
            <table className="dash-data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Time</th>
                  <th>Patient / Contact</th>
                  <th>Captured In-Chat Data</th>
                  <th>Backend Rule Engine Result</th>
                  <th style={{ textAlign: 'right' }}>Credits</th>
                </tr>
              </thead>
              <tbody>
                {submissions.slice(0, 5).map((sub) => {
                  const data = sub.captured_data || {};
                  return (
                    <tr key={sub.id}>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)' }}>
                          {formatTime(sub.created_at)}
                        </span>
                      </td>

                      <td>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', display: 'block' }}>
                            {sub.customer_name || 'Anonymous Patient'}
                          </strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {sub.customer_phone || '+1 (555) 000-0000'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {data.service_name && (
                            <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>
                              <strong>Service:</strong> {data.service_name}
                            </span>
                          )}
                          {data.appointment_slot && (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <strong>Slot:</strong> {data.appointment_slot}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span className="flow-submission-status-badge executed">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            DB Record Created ✓
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {sub.rule_engine_result?.message || 'Appointment & Customer saved to DB'}
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#EF3826' }}>
                          -{(sub.rule_engine_result?.credits_deducted || 0.50).toFixed(2)} cr
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Module A.3: Plain-Language Recent Usage Activity Feed */}
      <section className="dash-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 className="dash-section-title" style={{ margin: 0 }}>
              Recent Credit Usage Activity
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
              Every appointment saved, media attachment uploaded, and WhatsApp response deducted in real time
            </p>
          </div>
          <div className="live-beacon">
            <span className="beacon-dot"></span>
            LIVE AUDIT METERING
          </div>
        </div>

        <div className="dash-table-responsive">
          <table className="dash-data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Time</th>
                <th>Operation / Activity</th>
                <th>Details</th>
                <th>Credits Deducted</th>
                <th>Remaining Balance</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No recent activity logs for this tenant yet. Try adding a customer or uploading an X-Ray above!
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => {
                  const friendlyAction = translateActionCode(
                    log.operation?.action_code,
                    log.operation?.description
                  );

                  return (
                    <tr key={log.id || log.log_id}>
                      {/* Formatted Time */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                            {formatTime(log.timestamp)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                      </td>

                      {/* Plain-Language Friendly Action */}
                      <td>
                        <div className="friendly-action-badge">
                          <span
                            className="friendly-action-icon"
                            style={{
                              background:
                                log.operation?.action_code === 'STORAGE_INGEST_MB'
                                  ? 'rgba(239, 56, 38, 0.12)'
                                  : log.operation?.action_code.includes('WA')
                                  ? 'rgba(0, 182, 155, 0.12)'
                                  : 'rgba(72, 128, 255, 0.12)',
                              color:
                                log.operation?.action_code === 'STORAGE_INGEST_MB'
                                  ? '#EF3826'
                                  : log.operation?.action_code.includes('WA')
                                  ? '#00B69B'
                                  : 'var(--primary)',
                            }}
                          >
                            {log.operation?.action_code === 'STORAGE_INGEST_MB' ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            ) : log.operation?.action_code.includes('WA') ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            )}
                          </span>
                          <span>{friendlyAction}</span>
                        </div>
                      </td>

                      {/* Technical/business description */}
                      <td>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {log.operation?.description || 'Standard operation'}
                        </span>
                      </td>

                      {/* Deducted Credits */}
                      <td>
                        {log.financials?.credits_deducted > 0 ? (
                          <span className="credits-deducted-pill">
                            -{log.financials.credits_deducted.toFixed(2)} cr
                          </span>
                        ) : (
                          <span className="credits-added-pill">
                            +{Math.abs(log.financials?.credits_deducted || 0).toFixed(2)} cr
                          </span>
                        )}
                      </td>

                      {/* Remaining Balance */}
                      <td>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>
                          {(log.financials?.balance_post ?? 0).toFixed(2)} cr
                        </strong>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default BusinessDashboard;
