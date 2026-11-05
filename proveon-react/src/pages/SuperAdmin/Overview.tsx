import React, { useEffect, useState, useMemo } from 'react';
import './Overview.css';
import './SuperAdmin.css';
import {
  subscribeToTenants,
  subscribeToUsageAuditLogs,
  generateSimulatedTelemetryEvent,
  seedInitialData,
} from '../../firebase/firestoreService';
import type { Tenant, UsageAuditLog, ActionCode } from '../../types';

// Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const SuperAdminOverview: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<UsageAuditLog[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to Tenants onSnapshot with proper cleanup
  useEffect(() => {
    const unsubscribeTenants = subscribeToTenants((updatedTenants) => {
      setTenants(updatedTenants);
    });

    return () => {
      if (typeof unsubscribeTenants === 'function') {
        unsubscribeTenants();
      }
    };
  }, []);

  // Subscribe to Usage Audit Logs onSnapshot with proper cleanup
  useEffect(() => {
    if (!isLiveStreaming) return;

    const unsubscribeLogs = subscribeToUsageAuditLogs((updatedLogs) => {
      setAuditLogs(updatedLogs);
    }, 100);

    return () => {
      if (typeof unsubscribeLogs === 'function') {
        unsubscribeLogs();
      }
    };
  }, [isLiveStreaming]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Trigger simulated live telemetry event
  const handleSimulateEvent = async () => {
    try {
      setIsSimulating(true);
      const log = await generateSimulatedTelemetryEvent();
      showToast(`⚡ Telemetry fired: [${log.operation.action_code}] for ${log.business_name || log.tenant_id}`);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Metrics Calculations
  const metrics = useMemo(() => {
    const totalTenantsCount = tenants.length;
    const activeTenants = tenants.filter((t) => t.status === 'Active');
    const clinicsCount = tenants.filter((t) => t.vertical === 'Clinic' || t.vertical === 'Dental Care').length;
    const salonsCount = tenants.filter((t) => t.vertical === 'Salon' || t.vertical === 'Aesthetics Studio').length;

    const lifetimeConsumed = tenants.reduce((acc, t) => acc + (t.credit_wallet?.lifetime_consumed || 0), 0);
    const totalGranted = tenants.reduce((acc, t) => acc + (t.credit_wallet?.lifetime_granted || 0), 0);

    // Approximate this month's consumption from logs or 42% of lifetime
    const thisMonthConsumed = auditLogs
      .filter((l) => l.financials.credits_deducted > 0)
      .reduce((acc, l) => acc + l.financials.credits_deducted, 0) || lifetimeConsumed * 0.42;

    const lowBalanceCount = tenants.filter((t) => (t.credit_wallet?.balance || 0) < (t.credit_wallet?.low_balance_threshold || 50)).length;

    return {
      totalTenantsCount,
      activeCount: activeTenants.length,
      clinicsCount,
      salonsCount,
      lifetimeConsumed: Number(lifetimeConsumed.toFixed(2)),
      thisMonthConsumed: Number(thisMonthConsumed.toFixed(2)),
      totalGranted: Number(totalGranted.toFixed(2)),
      lowBalanceCount,
      revenueUsd: Number((totalGranted * 0.10).toFixed(2)), // e.g. $0.10 per credit unit baseline
    };
  }, [tenants, auditLogs]);

  // Filter audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Search filter
      const matchesSearch =
        !searchFilter ||
        log.tenant_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (log.business_name && log.business_name.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (log.operation?.description && log.operation.description.toLowerCase().includes(searchFilter.toLowerCase()));

      // Action code filter
      const matchesAction =
        actionFilter === 'ALL' || log.operation?.action_code === actionFilter;

      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const logTime = typeof log.timestamp === 'number' ? log.timestamp : (log.timestamp?.toDate ? log.timestamp.toDate().getTime() : 0);
        const threshold = dateFilter === 'TODAY' ? 86400000 : 86400000 * 7;
        const currentRef = auditLogs.length > 0 && typeof auditLogs[0].timestamp === 'number' ? auditLogs[0].timestamp : logTime;
        matchesDate = currentRef - logTime <= threshold;
      }

      return matchesSearch && matchesAction && matchesDate;
    });
  }, [auditLogs, searchFilter, actionFilter, dateFilter]);

  // Format timestamp helper
  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    const date = typeof ts === 'number' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    const date = typeof ts === 'number' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Badge class helper
  const getActionBadgeClass = (code: ActionCode | string) => {
    switch (code) {
      case 'WA_BOT_STATE_TRANS':
        return 'action-code-badge wa-state';
      case 'WA_INBOUND_PROCESS':
        return 'action-code-badge wa-inbound';
      case 'DB_WRITE_MUTATION':
        return 'action-code-badge db-write';
      case 'DB_READ_BURST':
        return 'action-code-badge db-read';
      case 'STORAGE_INGEST_MB':
        return 'action-code-badge storage';
      case 'AUTOMATED_JOB_DISPATCH':
        return 'action-code-badge job';
      case 'MANUAL_TOPUP':
        return 'action-code-badge topup';
      default:
        return 'action-code-badge manual';
    }
  };

  // Chart data for telemetry credit consumption trends
  const chartData = useMemo(() => {
    return {
      labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Live'],
      datasets: [
        {
          fill: true,
          label: 'Credit Burn Rate (cr/hr)',
          data: [45, 28, 62, 185, 240, 310, 265, 190, 275],
          borderColor: '#4880FF',
          backgroundColor: (context: any) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(72, 128, 255, 0.28)');
            gradient.addColorStop(1, 'rgba(72, 128, 255, 0.00)');
            return gradient;
          },
          borderWidth: 3,
          tension: 0.35,
          pointBackgroundColor: '#4880FF',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
        },
      ],
    };
  }, []);

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B',
        titleFont: { family: 'Nunito', weight: 'bold' },
        bodyFont: { family: 'Nunito' },
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context: any) => `${context.raw} credits consumed`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#A0A5BA', font: { family: 'Nunito', size: 12 } },
      },
      y: {
        grid: { color: '#F1F2F7', borderDash: [4, 4] },
        ticks: {
          color: '#A0A5BA',
          font: { family: 'Nunito', size: 12 },
          callback: (value: any) => `${value} cr`,
        },
      },
    },
  };

  return (
    <div className="dashstack-overview">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="super-toast success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Page Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Super Admin Platform Overview</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Multi-Tenant Credit Engine • Live System Telemetry • WhatsApp Meta Automation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn-secondary-action" 
            onClick={() => {
              seedInitialData(true);
              showToast('Demo data re-seeded successfully!');
            }}
            title="Populate or reset demo tenants and audit logs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Seed Demo Data
          </button>
          <button 
            className="btn-primary-action" 
            onClick={handleSimulateEvent}
            disabled={isSimulating}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {isSimulating ? 'Simulating...' : 'Trigger Telemetry Event'}
          </button>
        </div>
      </div>

      {/* 4 Metrics Summary Cards */}
      <section className="dash-kpi-grid">
        {/* Card 1: Total Active Tenants */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Total Active Tenants</span>
              <span className="kpi-number">{metrics.activeCount} <small style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-muted)' }}>/ {metrics.totalTenantsCount}</small></span>
            </div>
            <div className="kpi-icon-bubble purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              {metrics.clinicsCount} Clinics
            </span>
            <span className="trend-label">• {metrics.salonsCount} Salons / MedSpas</span>
          </div>
        </div>

        {/* Card 2: System-Wide Credits Consumed */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Credits Consumed</span>
              <span className="kpi-number">{metrics.lifetimeConsumed.toLocaleString()} <span style={{ fontSize: '15px', color: '#EF3826', fontWeight: 700 }}>cr</span></span>
            </div>
            <div className="kpi-icon-bubble yellow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat" style={{ color: '#FF9F43' }}>
              ~{metrics.thisMonthConsumed.toLocaleString()} cr
            </span>
            <span className="trend-label">Consumed this period</span>
          </div>
        </div>

        {/* Card 3: Revenue / Credits Granted */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Credits Granted / Revenue</span>
              <span className="kpi-number">{metrics.totalGranted.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>cr</span></span>
            </div>
            <div className="kpi-icon-bubble green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">
              ${metrics.revenueUsd.toLocaleString()} USD
            </span>
            <span className="trend-label">Gross value granted</span>
          </div>
        </div>

        {/* Card 4: Platform Health & Webhook Ingestion */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Platform Health Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className="beacon-dot" style={{ width: '10px', height: '10px' }}></span>
                <span className="kpi-number" style={{ fontSize: '22px', color: '#00B69B' }}>99.98%</span>
              </div>
            </div>
            <div className="kpi-icon-bubble green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">
              142 req/min
            </span>
            <span className="trend-label">Active Webhook Ingestion</span>
          </div>
        </div>
      </section>

      {/* Credit Consumption Velocity Graph */}
      <section className="dash-card sales-chart-container">
        <div className="chart-header-row">
          <div>
            <h2 className="dash-section-title">System-Wide Credit Burn Telemetry</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '2px 0 0' }}>
              Aggregated real-time credit deduction rate across WhatsApp webhooks, DB mutations, and AI workflows
            </p>
          </div>
          <div className="chart-filter-select">
            <select defaultValue="Today">
              <option value="Today">Today (Hourly)</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div className="chart-canvas-wrapper">
          <Line data={chartData} options={chartOptions} />
        </div>
      </section>

      {/* Module A.2: Real-time Live Activity Feed (`usage_audit_logs`) */}
      <section className="dash-card deals-table-section">
        <div className="telemetry-live-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <h2 className="dash-section-title" style={{ margin: 0 }}>
              Live Telemetry Audit Feed
            </h2>
            <div className="live-beacon">
              <span className="beacon-dot"></span>
              {isLiveStreaming ? 'LIVE onSnapshot STREAM' : 'STREAM PAUSED'}
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              ({filteredLogs.length} events received)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn-secondary-action"
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            >
              {isLiveStreaming ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  Pause Stream
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Resume Stream
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter and Search Controls */}
        <div className="telemetry-filter-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="telemetry-search-input"
              placeholder="Search by Tenant Name, ID, or operation description..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>

          {/* Action Code Dropdown Filter */}
          <select
            className="telemetry-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="ALL">All Action Codes</option>
            <option value="WA_BOT_STATE_TRANS">WA_BOT_STATE_TRANS</option>
            <option value="WA_INBOUND_PROCESS">WA_INBOUND_PROCESS</option>
            <option value="DB_WRITE_MUTATION">DB_WRITE_MUTATION</option>
            <option value="DB_READ_BURST">DB_READ_BURST</option>
            <option value="STORAGE_INGEST_MB">STORAGE_INGEST_MB</option>
            <option value="AUTOMATED_JOB_DISPATCH">AUTOMATED_JOB_DISPATCH</option>
            <option value="MANUAL_TOPUP">MANUAL_TOPUP</option>
            <option value="MANUAL_ADJUSTMENT">MANUAL_ADJUSTMENT</option>
          </select>

          {/* Date Range Filter */}
          <select
            className="telemetry-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today Only</option>
            <option value="LAST_7D">Last 7 Days</option>
          </select>

          {(searchFilter || actionFilter !== 'ALL' || dateFilter !== 'ALL') && (
            <button
              className="btn-secondary-action"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => {
                setSearchFilter('');
                setActionFilter('ALL');
                setDateFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Streaming Real-Time Table */}
        <div className="dash-table-responsive">
          <table className="dash-data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Timestamp</th>
                <th>Tenant & ID</th>
                <th>Action Code & Details</th>
                <th>Deducted Credits</th>
                <th>Prior → Post Balance</th>
                <th>Latency & Resources</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No audit logs match current filters. Click "Trigger Telemetry Event" above to dispatch live activity!
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isDeduction = log.financials.credits_deducted > 0;
                  const isTopUp = log.financials.credits_deducted < 0;

                  return (
                    <tr key={log.id || log.log_id} style={{ animation: 'modal-fade-in 0.3s ease-out' }}>
                      {/* Timestamp */}
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

                      {/* Tenant Name & ID Badge */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '13.5px' }}>
                            {log.business_name || 'Business Tenant'}
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
                            {log.tenant_id}
                          </span>
                        </div>
                      </td>

                      {/* Action Code & Description */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className={getActionBadgeClass(log.operation?.action_code)}>
                            {log.operation?.action_code}
                          </span>
                          {log.operation?.description && (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {log.operation.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Deducted Credits */}
                      <td>
                        {isDeduction && (
                          <span className="credits-deducted-pill">
                            -{log.financials.credits_deducted.toFixed(2)} cr
                          </span>
                        )}
                        {isTopUp && (
                          <span className="credits-added-pill">
                            +{Math.abs(log.financials.credits_deducted).toFixed(2)} cr
                          </span>
                        )}
                        {!isDeduction && !isTopUp && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>0.00 cr</span>
                        )}
                      </td>

                      {/* Prior Balance -> Post Balance */}
                      <td>
                        <div className="balance-flow">
                          <span>{log.financials.balance_prior?.toFixed(2) ?? '0.00'}</span>
                          <span className="arrow">→</span>
                          <span className="post-balance">
                            {log.financials.balance_post?.toFixed(2) ?? '0.00'}
                          </span>
                        </div>
                      </td>

                      {/* Latency & DB Resource count */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="metric-chip">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 14 14"></polyline>
                              </svg>
                              {log.metrics?.executionTimeMs ?? 0} ms
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Reads: <strong>{log.metrics?.dbReads ?? 0}</strong> • Writes: <strong>{log.metrics?.dbWrites ?? 0}</strong>
                          </span>
                        </div>
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

export default SuperAdminOverview;
