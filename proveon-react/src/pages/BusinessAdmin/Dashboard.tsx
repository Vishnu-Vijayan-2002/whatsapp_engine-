import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import {
  subscribeTenantAuditLogs,
  subscribeCustomers,
  subscribeAppointments,
  subscribeCapturedSubmissions,
  translateActionCode,
  generateSimulatedTelemetryEvent,
  updateAppointmentStatus,
} from '../../firebase/firestoreService';
import type { UsageAuditLog, Customer, Appointment, CapturedFlowSubmission, BookingStatus } from '../../types';
import { AdminBookingModal } from '../../components/AdminBookingModal';
import { ClientProfileDrawer } from '../../components/ClientProfileDrawer';
import { CreditTopUpModal } from '../../components/CreditTopUpModal';
import './BusinessAdmin.css';
import '../SuperAdmin/SuperAdmin.css';

type DateRangeFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL';
type LedgerActionFilter = 'ALL' | 'WA' | 'DB' | 'STORAGE' | 'TOPUP';

const BusinessDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    tenant,
    tenantId,
    isLowBalance,
    recentDrop,
  } = useTenant();

  const [auditLogs, setAuditLogs] = useState<UsageAuditLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [submissions, setSubmissions] = useState<CapturedFlowSubmission[]>([]);
  const [isSimulatingBot, setIsSimulatingBot] = useState(false);

  // Date range filter for KPIs & Analytics
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('THIS_MONTH');

  // Ledger filter & search
  const [ledgerFilter, setLedgerFilter] = useState<LedgerActionFilter>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Modals & Drawers
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedClientForDrawer, setSelectedClientForDrawer] = useState<Customer | null>(null);
  const [preselectedClientForBooking, setPreselectedClientForBooking] = useState<Customer | null>(null);

  // Status transition loading state
  const [updatingApptId, setUpdatingApptId] = useState<string | null>(null);

  // Real-time live listeners
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

    const unsubSubs = subscribeCapturedSubmissions(tenantId, (list) => {
      setSubmissions(list);
    });

    return () => {
      unsubLogs();
      unsubCust();
      unsubAppts();
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

  const handleUpdateStatus = async (apptId: string, newStatus: BookingStatus) => {
    try {
      setUpdatingApptId(apptId);
      await updateAppointmentStatus(tenantId, apptId, newStatus);
    } finally {
      setUpdatingApptId(null);
    }
  };

  const handleOpenClientDrawer = (client: Customer) => {
    setSelectedClientForDrawer(client);
    setIsDrawerOpen(true);
  };

  const handleScheduleFromDrawer = (client: Customer) => {
    setIsDrawerOpen(false);
    setPreselectedClientForBooking(client);
    setIsBookingModalOpen(true);
  };

  const balance = tenant?.credit_wallet?.balance ?? 0;
  const threshold = tenant?.credit_wallet?.low_balance_threshold ?? 50;
  const todayStr = new Date().toISOString().split('T')[0];

  // Helper date conversions
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

  // Filtered Appointments based on Date Range
  const filteredBookingsByDate = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return appointments.filter((a) => {
      if (dateFilter === 'ALL') return true;
      const apptDate = new Date(a.date);
      if (isNaN(apptDate.getTime())) return true;

      if (dateFilter === 'TODAY') {
        return a.date === todayStr;
      }
      if (dateFilter === 'THIS_WEEK') {
        const firstDayOfWeek = new Date(today);
        firstDayOfWeek.setDate(today.getDate() - today.getDay());
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
        return apptDate >= firstDayOfWeek && apptDate <= lastDayOfWeek;
      }
      if (dateFilter === 'THIS_MONTH') {
        return apptDate.getMonth() === today.getMonth() && apptDate.getFullYear() === today.getFullYear();
      }
      return true;
    });
  }, [appointments, dateFilter, todayStr]);

  // KPIs
  const totalBookingsCount = filteredBookingsByDate.length;
  const attendedCount = filteredBookingsByDate.filter(
    (a) => a.status === 'ATTENDED' || a.status === 'COMPLETED'
  ).length;
  const attendanceRate = totalBookingsCount > 0 
    ? Math.round((attendedCount / totalBookingsCount) * 100) 
    : 100;

  // WhatsApp Active Clients (Last 7 days or interacted recently)
  const recentActiveWhatsAppClients = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return customers.filter((c) => {
      const ts = c.last_interacted_at 
        ? (typeof c.last_interacted_at === 'number' ? c.last_interacted_at : new Date(c.last_interacted_at).getTime())
        : new Date(c.created_at).getTime();
      return ts >= sevenDaysAgo;
    });
  }, [customers]);

  // Today's Queue (today's appointments sorted by time, or next upcoming if today is empty)
  const todaysQueue = useMemo(() => {
    const todays = appointments.filter((a) => a.date === todayStr);
    if (todays.length > 0) {
      return todays.sort((a, b) => a.time.localeCompare(b.time));
    }
    // Fallback: show upcoming appointments
    return appointments
      .filter((a) => a.date >= todayStr)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 6);
  }, [appointments, todayStr]);

  // Itemized Credit Ledger Filtering
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const code = log.operation?.action_code || '';
      const desc = (log.operation?.description || '').toLowerCase();
      const q = ledgerSearch.toLowerCase().trim();

      if (q && !desc.includes(q) && !code.toLowerCase().includes(q)) {
        return false;
      }

      if (ledgerFilter === 'ALL') return true;
      if (ledgerFilter === 'WA') return code.includes('WA');
      if (ledgerFilter === 'DB') return code.includes('DB') || code.includes('MUTATION');
      if (ledgerFilter === 'STORAGE') return code.includes('STORAGE');
      if (ledgerFilter === 'TOPUP') return code.includes('TOPUP') || code.includes('ADJUSTMENT');
      return true;
    });
  }, [auditLogs, ledgerFilter, ledgerSearch]);

  // 30-Day Booking Volume Trend (Visual SVG Sparkline / Area Chart)
  const trendData = useMemo(() => {
    const days: { dateStr: string; label: string; count: number }[] = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const str = d.toISOString().split('T')[0];
      const count = appointments.filter((a) => a.date === str).length;
      days.push({
        dateStr: str,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        count,
      });
    }
    return days;
  }, [appointments]);

  const maxTrendCount = Math.max(...trendData.map((d) => d.count), 4);
  const chartHeight = 120;
  const chartWidth = 560;

  const points = trendData.map((d, index) => {
    const x = (index / (trendData.length - 1)) * (chartWidth - 40) + 20;
    const y = chartHeight - (d.count / maxTrendCount) * (chartHeight - 30) - 15;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${trendData.map((d, index) => {
    const x = (index / (trendData.length - 1)) * (chartWidth - 40) + 20;
    const y = chartHeight - (d.count / maxTrendCount) * (chartHeight - 30) - 15;
    return `${x},${y}`;
  }).join(' ')} ${chartWidth - 20},${chartHeight} 20,${chartHeight}`;

  // Peak Hours Distribution (9 AM to 6 PM)
  const peakHours = useMemo(() => {
    const slots = [
      { label: '9 AM', key: '09' },
      { label: '10 AM', key: '10' },
      { label: '11 AM', key: '11' },
      { label: '12 PM', key: '12' },
      { label: '1 PM', key: '13' },
      { label: '2 PM', key: '14' },
      { label: '3 PM', key: '15' },
      { label: '4 PM', key: '16' },
      { label: '5 PM', key: '17' },
      { label: '6 PM', key: '18' },
    ];

    return slots.map((s) => {
      const count = appointments.filter((a) => {
        const timePart = a.time || '';
        return timePart.startsWith(s.key) || timePart.includes(s.label.split(' ')[0]);
      }).length;
      return { ...s, count };
    });
  }, [appointments]);

  const maxPeakCount = Math.max(...peakHours.map((h) => h.count), 3);

  return (
    <div className="biz-overview-container">
      {/* Top Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">
            {tenant?.business_name || 'Business Admin Dashboard'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {tenant?.vertical || 'Service Business'} Portal • Unified Client CRM, Real-time Slot Engine & WhatsApp Telemetry
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-secondary-action"
            onClick={handleSimulateInboundWhatsApp}
            disabled={isSimulatingBot || balance <= 0}
            title="Simulate receiving an inbound customer WhatsApp inquiry"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {isSimulatingBot ? 'Simulating...' : 'Simulate Inbound WhatsApp'}
          </button>

          <button
            className="btn-primary-action"
            onClick={() => {
              setPreselectedClientForBooking(null);
              setIsBookingModalOpen(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Schedule Booking (-0.50 cr)
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
                Your wallet is below the alert threshold ({threshold} cr). When balance reaches 0.00 cr, automated WhatsApp booking responses and file uploads pause.
              </span>
            </div>
          </div>

          <button
            className="btn-primary-action"
            style={{ background: '#EF3826', boxShadow: '0 4px 12px rgba(239, 56, 38, 0.3)' }}
            onClick={() => setIsTopUpModalOpen(true)}
          >
            Recharge Credits Now
          </button>
        </div>
      )}

      {/* Quick Action Toolbar & Range Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div className="biz-quick-actions" style={{ flex: '1 1 auto', margin: 0 }}>
          <span className="biz-quick-actions-title">OPERATIONS:</span>
          <button
            className="btn-secondary-action"
            onClick={() => {
              setPreselectedClientForBooking(null);
              setIsBookingModalOpen(true);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
            </svg>
            Book Slot with Collision Check
          </button>

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
            Clients & Bookings Directory
          </button>

          <button
            className="btn-secondary-action"
            onClick={() => navigate('/app/whatsapp')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Visual Flow Builder
          </button>
        </div>

        {/* Date Range Selector Pill */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', gap: '4px' }}>
          {(['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL'] as DateRangeFilter[]).map((range) => {
            const labels: Record<DateRangeFilter, string> = {
              TODAY: 'Today',
              THIS_WEEK: 'This Week',
              THIS_MONTH: 'This Month',
              ALL: 'All Time',
            };
            return (
              <button
                key={range}
                type="button"
                onClick={() => setDateFilter(range)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  background: dateFilter === range ? 'var(--primary)' : 'transparent',
                  color: dateFilter === range ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {labels[range]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 KPI Metrics Cards (Dynamic Date Range) */}
      <section className="biz-kpi-grid">
        {/* Total Bookings Card */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Total Bookings ({dateFilter === 'ALL' ? 'All' : dateFilter.replace('_', ' ')})</span>
              <span className="kpi-number">{totalBookingsCount}</span>
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
              {filteredBookingsByDate.filter((b) => b.booking_source === 'whatsapp_bot').length} via WhatsApp
            </span>
            <span className="trend-label">
              • {filteredBookingsByDate.filter((b) => b.booking_source === 'admin_manual').length} manual
            </span>
          </div>
        </div>

        {/* Completed / Attended Visits Rate */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Attended Visits & Rate</span>
              <span className="kpi-number" style={{ color: '#00B69B' }}>
                {attendanceRate}% <small style={{ fontSize: '14px', color: 'var(--text-muted)' }}>({attendedCount})</small>
              </span>
            </div>
            <div className="kpi-icon-bubble" style={{ background: 'rgba(0, 182, 155, 0.14)', color: '#00B69B' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">{attendedCount} completed</span>
            <span className="trend-label">verified client attendance</span>
          </div>
        </div>

        {/* WhatsApp Conversations Active */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Active WhatsApp Clients</span>
              <span className="kpi-number">{recentActiveWhatsAppClients.length}</span>
            </div>
            <div className="kpi-icon-bubble purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">Active last 7 days</span>
            <span className="trend-label">in-chat pipeline</span>
          </div>
        </div>

        {/* Current Wallet Balance with Live Subtraction Animation */}
        <div className={`kpi-dash-card ${recentDrop ? 'wallet-card-pulse' : ''}`}>
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Credit Wallet Balance</span>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  className="kpi-number"
                  style={{ color: isLowBalance ? '#EF3826' : 'var(--text-main)' }}
                >
                  {balance.toFixed(2)} <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>cr</span>
                </span>
                {recentDrop && (
                  <span className="floating-subtraction-bubble" title={recentDrop.description}>
                    -{recentDrop.amount.toFixed(2)} cr
                  </span>
                )}
              </div>
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
          <div className="kpi-trend" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="trend-label">
              Consumed: <strong>{(tenant?.credit_wallet?.lifetime_consumed || 0).toFixed(2)} cr</strong>
            </span>
            <button
              type="button"
              className="btn-secondary-action"
              style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 800, color: 'var(--primary)', borderColor: 'rgba(72, 128, 255, 0.3)' }}
              onClick={() => setIsTopUpModalOpen(true)}
            >
              + Top-Up
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Section 1: Today's Live Schedule & Calendar Queue */}
      <section className="dash-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="dash-section-title" style={{ margin: 0 }}>
                Today's Schedule & Live Queue
              </h2>
              <span className="live-beacon">
                <span className="beacon-dot"></span>
                REAL-TIME QUEUE
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
              One-click attendance tracking, status transitions, and client profile drill-down
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary-action"
              style={{ fontSize: '12.5px', padding: '6px 12px' }}
              onClick={() => navigate('/app/customers')}
            >
              View Full Calendar →
            </button>
          </div>
        </div>

        {todaysQueue.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>📅</div>
            <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-main)' }}>
              No bookings scheduled for today
            </strong>
            <span style={{ fontSize: '12.5px' }}>
              Click "Schedule Booking" to allocate a slot for a walk-in or phone customer!
            </span>
          </div>
        ) : (
          <div className="dash-table-responsive">
            <table className="dash-data-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Time Slot</th>
                  <th>Client Name & WhatsApp</th>
                  <th>Service / Booking Type</th>
                  <th>Source</th>
                  <th>Current Status</th>
                  <th style={{ textAlign: 'right' }}>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {todaysQueue.map((appt) => {
                  const matchingClient = customers.find(
                    (c) =>
                      c.id === appt.customer_id ||
                      c.id === appt.client_id ||
                      (c.phone && appt.customer_phone && c.phone.replace(/[^0-9]/g, '') === appt.customer_phone.replace(/[^0-9]/g, ''))
                  );

                  return (
                    <tr key={appt.id}>
                      {/* Slot time */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>
                            {appt.time}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {appt.date === todayStr ? 'Today' : appt.date}
                          </span>
                        </div>
                      </td>

                      {/* Client Name with Click-to-Drawer */}
                      <td>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              if (matchingClient) {
                                handleOpenClientDrawer(matchingClient);
                              } else {
                                handleOpenClientDrawer({
                                  id: appt.customer_id || appt.client_id || 'temp',
                                  tenant_id: tenantId,
                                  full_name: appt.customer_name || appt.client_name || 'Client',
                                  phone: appt.customer_phone || appt.client_phone || '',
                                  email: '',
                                  status: 'active',
                                  created_at: new Date().toISOString(),
                                });
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                            title="Click to view full client profile & history"
                          >
                            <strong style={{ fontSize: '13.5px', color: 'var(--primary)', textDecoration: 'underline' }}>
                              {appt.customer_name || appt.client_name || 'Anonymous Client'}
                            </strong>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </button>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                            {appt.customer_phone || appt.client_phone || 'No phone'}
                          </span>
                        </div>
                      </td>

                      {/* Service */}
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' }}>
                          {appt.service_name}
                        </span>
                        {appt.notes && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                            {appt.notes}
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            background: appt.booking_source === 'whatsapp_bot' ? 'rgba(0, 182, 155, 0.12)' : 'rgba(72, 128, 255, 0.12)',
                            color: appt.booking_source === 'whatsapp_bot' ? '#00B69B' : 'var(--primary)',
                          }}
                        >
                          {appt.booking_source === 'whatsapp_bot' ? '💬 WhatsApp Bot' : '👤 Admin Manual'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill ${
                          appt.status === 'ATTENDED' || appt.status === 'COMPLETED' ? 'active' :
                          appt.status === 'CONFIRMED' ? 'active' :
                          appt.status === 'NO_SHOW' ? 'inactive' :
                          appt.status === 'CANCELLED' ? 'inactive' : 'pending'
                        }`}>
                          {appt.status}
                        </span>
                      </td>

                      {/* 1-Click Quick Status Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {appt.status !== 'ATTENDED' && appt.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              className="btn-secondary-action"
                              disabled={updatingApptId === appt.id}
                              style={{
                                fontSize: '11px',
                                padding: '4px 8px',
                                background: 'rgba(0, 182, 155, 0.12)',
                                color: '#00B69B',
                                border: '1px solid rgba(0, 182, 155, 0.3)',
                                fontWeight: 700,
                              }}
                              onClick={() => handleUpdateStatus(appt.id, 'ATTENDED')}
                              title="Mark client as attended"
                            >
                              ✓ Attended
                            </button>
                          )}

                          {appt.status !== 'NO_SHOW' && appt.status !== 'ATTENDED' && (
                            <button
                              type="button"
                              className="btn-secondary-action"
                              disabled={updatingApptId === appt.id}
                              style={{
                                fontSize: '11px',
                                padding: '4px 8px',
                                background: 'rgba(255, 159, 67, 0.12)',
                                color: '#FF9F43',
                                border: '1px solid rgba(255, 159, 67, 0.3)',
                                fontWeight: 700,
                              }}
                              onClick={() => handleUpdateStatus(appt.id, 'NO_SHOW')}
                              title="Mark as client no-show"
                            >
                              No-Show
                            </button>
                          )}

                          {appt.status !== 'CANCELLED' && appt.status !== 'ATTENDED' && (
                            <button
                              type="button"
                              className="btn-secondary-action"
                              disabled={updatingApptId === appt.id}
                              style={{
                                fontSize: '11px',
                                padding: '4px 8px',
                                background: 'rgba(239, 56, 38, 0.12)',
                                color: '#EF3826',
                                border: '1px solid rgba(239, 56, 38, 0.3)',
                                fontWeight: 700,
                              }}
                              onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')}
                              title="Cancel booking"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Visual Analytics Grid: 30-Day Trend & Peak Hours Distribution */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Chart 1: 30-Day Booking Volume Trend */}
        <div className="dash-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                30-Day Booking Volume Trend
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Daily client appointment density over time
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
              Volume Trend
            </span>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '140px' }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4880FF" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#4880FF" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="20" y1="20" x2={chartWidth - 20} y2="20" stroke="var(--border-light)" strokeDasharray="3 3" />
              <line x1="20" y1="65" x2={chartWidth - 20} y2="65" stroke="var(--border-light)" strokeDasharray="3 3" />
              <line x1="20" y1={chartHeight - 10} x2={chartWidth - 20} y2={chartHeight - 10} stroke="var(--border-light)" />

              {/* Area fill */}
              <polygon points={areaPoints} fill="url(#trendGradient)" />

              {/* Trend Polyline */}
              <polyline
                fill="none"
                stroke="#4880FF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />

              {/* Data points */}
              {trendData.map((d, index) => {
                if (index % 5 !== 0 && index !== trendData.length - 1) return null;
                const x = (index / (trendData.length - 1)) * (chartWidth - 40) + 20;
                const y = chartHeight - (d.count / maxTrendCount) * (chartHeight - 30) - 15;
                return (
                  <g key={d.dateStr}>
                    <circle cx={x} cy={y} r="4" fill="#fff" stroke="#4880FF" strokeWidth="2.5" />
                    <text x={x} y={chartHeight + 2} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Chart 2: Peak Booking Hours Distribution */}
        <div className="dash-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                Peak Booking Hours Distribution
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Client preferred appointment times across the day
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#00B69B', background: 'rgba(0, 182, 155, 0.12)', padding: '2px 8px', borderRadius: '4px' }}>
              Time Slots
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', height: '140px', padding: '10px 0 0' }}>
            {peakHours.map((slot) => {
              const heightPercent = Math.max(12, Math.round((slot.count / maxPeakCount) * 100));
              const isPeak = slot.count === Math.max(...peakHours.map(s => s.count)) && slot.count > 0;
              return (
                <div
                  key={slot.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: isPeak ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '4px' }}>
                    {slot.count}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '28px',
                      height: `${heightPercent}%`,
                      background: isPeak
                        ? 'linear-gradient(180deg, #4880FF 0%, #00B69B 100%)'
                        : 'var(--bg-input)',
                      border: isPeak ? 'none' : '1px solid var(--border-light)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'all 0.2s ease',
                    }}
                    title={`${slot.label}: ${slot.count} bookings`}
                  />
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                    {slot.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Direct In-WhatsApp Captured Leads & Automated Bookings Section */}
      <section className="dash-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="dash-section-title" style={{ margin: 0 }}>
                Direct In-WhatsApp Submissions & Captured Leads
              </h2>
              <span className="live-beacon">
                <span className="beacon-dot"></span>
                AUTOMATED CONVERSATIONAL CAPTURE
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
              🔀 Open Flow Builder
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
                  <th>Client / Contact</th>
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
                            {sub.customer_name || 'Anonymous Client'}
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

      {/* Module A.3: Plain-Language Recent Usage Activity Feed & Ledger */}
      <section className="dash-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="dash-section-title" style={{ margin: 0 }}>
                Credit Ledger & Balance Analytics
              </h2>
              <div className="live-beacon">
                <span className="beacon-dot"></span>
                LIVE AUDIT METERING
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
              Itemized ledger of all automated WhatsApp responses, database writes, and storage deductions
            </p>
          </div>

          <button
            type="button"
            className="btn-primary-action"
            style={{ fontSize: '12.5px', padding: '6px 14px' }}
            onClick={() => setIsTopUpModalOpen(true)}
          >
            + Request Credit Top-Up
          </button>
        </div>

        {/* Ledger Balance Summary Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: 'var(--bg-input)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Total Allocated</span>
            <strong style={{ fontSize: '16px', color: 'var(--text-main)', display: 'block' }}>
              {(tenant?.credit_wallet?.lifetime_granted || 0).toFixed(2)} cr
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Total Consumed</span>
            <strong style={{ fontSize: '16px', color: '#EF4444', display: 'block' }}>
              {(tenant?.credit_wallet?.lifetime_consumed || 0).toFixed(2)} cr
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Current Remaining</span>
            <strong style={{ fontSize: '16px', color: isLowBalance ? '#EF4444' : '#10B981', display: 'block' }}>
              {balance.toFixed(2)} cr
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Billing Status</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: isLowBalance ? '#EF4444' : '#10B981', display: 'block' }}>
              {isLowBalance ? '⚠️ Low Quota Alert' : '✓ Normal Active'}
            </span>
          </div>
        </div>

        {/* Ledger Filters & Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {([
              { key: 'ALL', label: 'All Operations' },
              { key: 'WA', label: '💬 WhatsApp Bot' },
              { key: 'DB', label: '💾 Database Writes' },
              { key: 'STORAGE', label: '📁 Media & Storage' },
              { key: 'TOPUP', label: '💳 Top-ups & Grants' },
            ] as const).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setLedgerFilter(f.key)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid var(--border-light)',
                  background: ledgerFilter === f.key ? 'var(--primary)' : 'var(--bg-card)',
                  color: ledgerFilter === f.key ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '240px' }}>
            <input
              type="text"
              placeholder="Search ledger..."
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              className="form-input"
              style={{ padding: '6px 10px 6px 30px', fontSize: '12.5px' }}
            />
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              style={{ position: 'absolute', left: '10px', top: '10px' }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
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
              {filteredAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No matching activity logs in this ledger filter.
                  </td>
                </tr>
              ) : (
                filteredAuditLogs.map((log) => {
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

      {/* Admin Direct Slot Allocation Modal */}
      <AdminBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setPreselectedClientForBooking(null);
        }}
        tenantId={tenantId}
        preselectedClient={preselectedClientForBooking}
      />

      {/* Credit Top-Up & Reconciliation Modal */}
      <CreditTopUpModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        tenant={tenant}
        tenantId={tenantId}
      />

      {/* Client Profile & Visit History Slide-Over Drawer */}
      <ClientProfileDrawer
        client={selectedClientForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedClientForDrawer(null);
        }}
        tenantId={tenantId}
        onScheduleNewBooking={handleScheduleFromDrawer}
      />
    </div>
  );
};

export default BusinessDashboard;