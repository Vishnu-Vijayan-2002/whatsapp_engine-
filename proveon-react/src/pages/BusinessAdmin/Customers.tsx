import React, { useEffect, useState, useMemo } from 'react';
import { useTenant } from '../../context/TenantContext';
import {
  subscribeCustomers,
  subscribeAppointments,
  createCustomerWithMetering,
  updateAppointmentStatus,
} from '../../firebase/firestoreService';
import type { Customer, Appointment, BookingStatus } from '../../types';
import { AdminBookingModal } from '../../components/AdminBookingModal';
import { ClientProfileDrawer } from '../../components/ClientProfileDrawer';
import { BookingDetailsDrawer } from '../../components/BookingDetailsDrawer';
import { AppointmentCalendar } from '../../components/AppointmentCalendar';
import './BusinessAdmin.css';
import '../SuperAdmin/SuperAdmin.css';

type ViewTab = 'TABLE' | 'CALENDAR' | 'TIMELINE' | 'CLIENTS';
type FilterStatus = 'ALL' | 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'NO_SHOW';

const CustomersPage: React.FC = () => {
  const { tenantId, tenant, isOutOfCredits, setRechargeModalOpen } = useTenant();

  const [activeTab, setActiveTab] = useState<ViewTab>('TABLE');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  // Modals & Drawers
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedClientForDrawer, setSelectedClientForDrawer] = useState<Customer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedBookingForDrawer, setSelectedBookingForDrawer] = useState<Appointment | null>(null);
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [bookingTargetClient, setBookingTargetClient] = useState<Customer | null>(null);

  // New Client Form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceInterest, setServiceInterest] = useState('Standard Service Consultation');
  const [notes, setNotes] = useState('');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Quick Action loader
  const [updatingApptId, setUpdatingApptId] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!tenantId) return;

    const unsubCust = subscribeCustomers(tenantId, (list) => {
      setCustomers(list);
    });

    const unsubAppts = subscribeAppointments(tenantId, (list) => {
      setAppointments(list);
    });

    return () => {
      unsubCust();
      unsubAppts();
    };
  }, [tenantId]);

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOutOfCredits) {
      setShowAddCustomerModal(false);
      setRechargeModalOpen(true);
      return;
    }

    if (!fullName.trim() || !phone.trim()) {
      showToast('Client name and phone number are required.');
      return;
    }

    try {
      setIsSubmittingCustomer(true);
      const res = await createCustomerWithMetering(tenantId, {
        tenant_id: tenantId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        service_interest: serviceInterest,
        notes: notes.trim(),
      });

      showToast(`Saved client profile for "${res.customer.full_name}". Deducted 0.50 cr.`);
      setFullName('');
      setPhone('');
      setEmail('');
      setNotes('');
      setShowAddCustomerModal(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save client');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleUpdateStatus = async (apptId: string, newStatus: BookingStatus) => {
    try {
      setUpdatingApptId(apptId);
      await updateAppointmentStatus(tenantId, apptId, newStatus);
      showToast(`Booking marked as ${newStatus}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update status');
    } finally {
      setUpdatingApptId(null);
    }
  };

  const handleOpenClientDrawer = (client: Customer) => {
    setSelectedClientForDrawer(client);
    setIsDrawerOpen(true);
  };

  const handleOpenBookingDrawer = (appt: Appointment) => {
    setSelectedBookingForDrawer(appt);
    setIsBookingDrawerOpen(true);
  };

  const handleScheduleFromDrawer = (client?: Customer) => {
    setIsDrawerOpen(false);
    setIsBookingDrawerOpen(false);
    setBookingTargetClient(client || null);
    setShowBookingModal(true);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (a.id && a.id.toLowerCase().includes(q)) ||
        (a.customer_name && a.customer_name.toLowerCase().includes(q)) ||
        (a.service_name && a.service_name.toLowerCase().includes(q)) ||
        (a.customer_phone && a.customer_phone.includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'TODAY') return a.date === todayStr;
      if (statusFilter === 'UPCOMING') return a.date >= todayStr && a.status !== 'CANCELLED';
      if (statusFilter === 'COMPLETED') return a.status === 'ATTENDED' || a.status === 'COMPLETED';
      return a.status === statusFilter;
    });
  }, [appointments, searchQuery, statusFilter, todayStr]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        !searchQuery ||
        c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  // Chronological Grouping for Timeline / Agenda View
  const groupedTimeline = useMemo(() => {
    const sorted = [...filteredAppointments].sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
    );

    const groups: Record<string, Appointment[]> = {};
    sorted.forEach((appt) => {
      const dateKey = appt.date;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(appt);
    });

    return groups;
  }, [filteredAppointments]);

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'ATTENDED':
      case 'COMPLETED':
        return <span className="status-pill active" style={{ background: 'rgba(16, 185, 129, 0.14)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)' }}>✓ Completed</span>;
      case 'CONFIRMED':
        return <span className="status-pill active">Confirmed</span>;
      case 'NO_SHOW':
        return <span className="status-pill inactive" style={{ background: 'rgba(245, 158, 11, 0.14)', color: '#D97706', borderColor: 'rgba(245, 158, 11, 0.3)' }}>No-Show</span>;
      case 'CANCELLED':
        return <span className="status-pill inactive">Cancelled</span>;
      default:
        return <span className="status-pill pending">Pending</span>;
    }
  };

  return (
    <div className="dashstack-overview" style={{ gap: '24px' }}>
      {toastMessage && (
        <div className="super-toast success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Client Booking & Directory Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {tenant?.business_name || 'Business'} • Spacious Calendar, Real-time Slot Engine & Client Profiles
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-secondary-action"
            onClick={() => {
              if (isOutOfCredits) setRechargeModalOpen(true);
              else setShowAddCustomerModal(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            + Add Client (-0.50 cr)
          </button>

          <button
            className="btn-primary-action"
            onClick={() => {
              if (isOutOfCredits) {
                setRechargeModalOpen(true);
              } else {
                setBookingTargetClient(null);
                setShowBookingModal(true);
              }
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

      {/* Navigation Switcher Bar & Filters */}
      <div className="dash-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* View Modes */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              className={`btn-secondary-action ${activeTab === 'TABLE' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'TABLE' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'TABLE' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
                padding: '7px 14px',
              }}
              onClick={() => setActiveTab('TABLE')}
            >
              🗂 All Bookings ({appointments.length})
            </button>

            <button
              type="button"
              className={`btn-secondary-action ${activeTab === 'CALENDAR' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'CALENDAR' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'CALENDAR' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
                padding: '7px 14px',
              }}
              onClick={() => setActiveTab('CALENDAR')}
            >
              📅 Calendar View
            </button>

            <button
              type="button"
              className={`btn-secondary-action ${activeTab === 'TIMELINE' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'TIMELINE' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'TIMELINE' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
                padding: '7px 14px',
              }}
              onClick={() => setActiveTab('TIMELINE')}
            >
              ⏱ Agenda & Timeline
            </button>

            <button
              type="button"
              className={`btn-secondary-action ${activeTab === 'CLIENTS' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'CLIENTS' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'CLIENTS' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
                padding: '7px 14px',
              }}
              onClick={() => setActiveTab('CLIENTS')}
            >
              👥 Client Directory ({customers.length})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Search by client, ID, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ padding: '8px 12px 8px 34px', fontSize: '13px' }}
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              style={{ position: 'absolute', left: '11px', top: '11px' }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>

        {/* Quick Filter Chips (for table and timeline views) */}
        {(activeTab === 'TABLE' || activeTab === 'TIMELINE') && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>
              FILTER:
            </span>
            {(['ALL', 'TODAY', 'UPCOMING', 'CONFIRMED', 'COMPLETED', 'PENDING', 'NO_SHOW', 'CANCELLED'] as FilterStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  fontSize: '12px',
                  padding: '5px 12px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-light)',
                  background: statusFilter === st ? 'var(--primary)' : 'var(--bg-card)',
                  color: statusFilter === st ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {st === 'ALL' ? 'All Bookings' : st === 'TODAY' ? '📅 Today' : st === 'UPCOMING' ? '⏳ Upcoming' : st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* VIEW 1: Spacious Table Layout */}
      {activeTab === 'TABLE' && (
        <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="dash-table-responsive">
            <table className="dash-data-table">
              <thead>
                <tr>
                  <th style={{ padding: '16px 20px' }}>Client</th>
                  <th>Service Requested</th>
                  <th>Scheduled Slot</th>
                  <th>Source</th>
                  <th>Current Status</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main)', display: 'block' }}>
                        No bookings match your current filter
                      </strong>
                      <span style={{ fontSize: '13px' }}>Click "Schedule Booking" to book a client slot.</span>
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((a) => {
                    const matchingClient = customers.find(
                      (c) =>
                        c.id === a.customer_id ||
                        c.id === a.client_id ||
                        (c.phone && a.customer_phone && c.phone.replace(/[^0-9]/g, '') === a.customer_phone.replace(/[^0-9]/g, ''))
                    );

                    return (
                      <tr
                        key={a.id}
                        style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                        onClick={() => handleOpenBookingDrawer(a)}
                      >
                        {/* Client details with initials avatar */}
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', flexShrink: 0 }}>
                              {(a.customer_name || 'C').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ fontSize: '14px', color: 'var(--text-main)', display: 'block' }}>
                                {a.customer_name || 'Client'}
                              </strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {a.customer_phone || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Service */}
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '13.5px' }}>
                            {a.service_name}
                          </span>
                        </td>

                        {/* Date & Time with modern slot pill */}
                        <td>
                          <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                              {a.date === todayStr ? '⭐ Today' : a.date}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {a.time} ({a.duration_minutes || 45} mins)
                            </span>
                          </div>
                        </td>

                        {/* Source */}
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '3px 9px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              background: a.booking_source === 'whatsapp_bot' ? 'rgba(0, 182, 155, 0.12)' : 'rgba(72, 128, 255, 0.12)',
                              color: a.booking_source === 'whatsapp_bot' ? '#00B69B' : 'var(--primary)',
                            }}
                          >
                            {a.booking_source === 'whatsapp_bot' ? '💬 WhatsApp Bot' : '👤 Admin Manual'}
                          </span>
                        </td>

                        {/* Status Chip */}
                        <td>
                          {getStatusBadge(a.status)}
                        </td>

                        {/* Notes */}
                        <td style={{ maxWidth: '200px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>
                            {a.notes || 'None'}
                          </span>
                        </td>

                        {/* 1-Click Quick Actions */}
                        <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                            {a.status !== 'ATTENDED' && a.status !== 'COMPLETED' && (
                              <button
                                type="button"
                                className="btn-secondary-action"
                                disabled={updatingApptId === a.id}
                                style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)', fontWeight: 700 }}
                                onClick={() => handleUpdateStatus(a.id, 'ATTENDED')}
                                title="Mark attended"
                              >
                                ✓ Attended
                              </button>
                            )}

                            {a.status !== 'CANCELLED' && a.status !== 'ATTENDED' && (
                              <button
                                type="button"
                                className="btn-secondary-action"
                                disabled={updatingApptId === a.id}
                                style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.12)', color: '#DC2626', borderColor: 'rgba(239, 68, 68, 0.3)', fontWeight: 700 }}
                                onClick={() => handleUpdateStatus(a.id, 'CANCELLED')}
                                title="Cancel booking"
                              >
                                Cancel
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn-secondary-action"
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                              onClick={() => {
                                if (matchingClient) handleOpenClientDrawer(matchingClient);
                                else handleOpenBookingDrawer(a);
                              }}
                              title="View details"
                            >
                              Details →
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
      )}

      {/* VIEW 2: Modern Calendar View (Day / Week / Month) */}
      {activeTab === 'CALENDAR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Scheduled Appointments Calendar
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Click on any appointment to open details, client metadata, or update attendance status.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4880FF' }}></span> Confirmed
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }}></span> Completed
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }}></span> Pending
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94A3B8' }}></span> Cancelled
              </span>
            </div>
          </div>

          <AppointmentCalendar
            appointments={filteredAppointments}
            onSelectBooking={(appt) => handleOpenBookingDrawer(appt)}
            onScheduleForDate={() => {
              if (isOutOfCredits) {
                setRechargeModalOpen(true);
              } else {
                setBookingTargetClient(null);
                setShowBookingModal(true);
              }
            }}
          />
        </div>
      )}

      {/* VIEW 3: Chronological Agenda & Timeline View */}
      {activeTab === 'TIMELINE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.keys(groupedTimeline).length === 0 ? (
            <div className="dash-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏱</div>
              <strong style={{ fontSize: '15px', color: 'var(--text-main)', display: 'block' }}>
                No scheduled timeline slots match your filter
              </strong>
            </div>
          ) : (
            Object.entries(groupedTimeline).map(([dateStr, items]) => {
              const isToday = dateStr === todayStr;
              const dateHeading = new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div key={dateStr} className="dash-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '18px' }}>📅</span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {dateHeading} {isToday && <span style={{ fontSize: '12px', background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '12px', marginLeft: '6px' }}>TODAY</span>}
                    </h3>
                    <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {items.length} {items.length === 1 ? 'Booking' : 'Bookings'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                    {items.map((appt) => {
                      const cleanPhone = (appt.customer_phone || '').replace(/[^0-9]/g, '');
                      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

                      return (
                        <div
                          key={appt.id}
                          style={{
                            background: 'var(--bg-input)',
                            border: '1.5px solid var(--border-light)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                          }}
                          onClick={() => handleOpenBookingDrawer(appt)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)' }}>
                                ⏰ {appt.time}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                ({appt.duration_minutes || 45}m)
                              </span>
                            </div>
                            {getStatusBadge(appt.status)}
                          </div>

                          <strong style={{ fontSize: '14.5px', color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>
                            {appt.customer_name}
                          </strong>
                          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'block' }}>
                            {appt.service_name}
                          </span>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              {appt.customer_phone || 'No phone'}
                            </span>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: '11.5px', color: '#00B69B', fontWeight: 700, textDecoration: 'none' }}
                              >
                                💬 WhatsApp Chat
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 4: Client Directory */}
      {activeTab === 'CLIENTS' && (
        <div className="dash-card" style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                No clients found. Click "+ Add Client" to create the first profile!
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

                return (
                  <div
                    key={c.id}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1.5px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px' }}>
                        {(c.full_name || 'C').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '15px', color: 'var(--text-main)', display: 'block' }}>
                          {c.full_name}
                        </strong>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {c.phone}
                        </span>
                      </div>
                      <span className={`status-pill ${c.status === 'vip' ? 'active' : 'pending'}`}>
                        {c.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </div>

                    {/* Metadata & Stats */}
                    <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>{c.total_bookings || 1}</strong> Bookings</span>
                      <span><strong>{c.total_completed_visits || 0}</strong> Attended</span>
                      <span>{c.service_interest ? c.service_interest.slice(0, 16) + '...' : 'General'}</span>
                    </div>

                    {/* Quick Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary-action"
                          style={{ flex: 1, fontSize: '11.5px', padding: '6px', justifyContent: 'center', color: '#00B69B', borderColor: 'rgba(0, 182, 155, 0.3)', textDecoration: 'none' }}
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn-secondary-action"
                        style={{ flex: 1, fontSize: '11.5px', padding: '6px', justifyContent: 'center' }}
                        onClick={() => handleScheduleFromDrawer(c)}
                      >
                        📅 Book Slot
                      </button>
                      <button
                        type="button"
                        className="btn-primary-action"
                        style={{ flex: 1, fontSize: '11.5px', padding: '6px', justifyContent: 'center' }}
                        onClick={() => handleOpenClientDrawer(c)}
                      >
                        Profile →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Add New Customer */}
      {showAddCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Register New Client Profile</h3>
              <button className="modal-close-btn" onClick={() => setShowAddCustomerModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit}>
              <div className="modal-body">
                <div style={{ background: 'var(--primary-light)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--primary)' }}>
                  <strong>Credit Accounting Notice:</strong> Saving this client record will atomically deduct <strong>0.50 credits</strong> (DB_WRITE_MUTATION) from your wallet balance.
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Full Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Jessica Alba"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Phone Number (WhatsApp) <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+1 (555) 000-0000"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="client@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Service / Requirement</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Legal Advisory, Financial Consulting, Premium Styling..."
                    value={serviceInterest}
                    onChange={(e) => setServiceInterest(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Client Notes & Preferences</label>
                  <textarea
                    rows={2}
                    className="form-textarea"
                    placeholder="Special requirements, contact preferences, notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setShowAddCustomerModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isSubmittingCustomer || isOutOfCredits}
                >
                  {isSubmittingCustomer ? 'Saving...' : 'Save Record (-0.50 cr)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Direct Slot Allocation Modal */}
      <AdminBookingModal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setBookingTargetClient(null);
        }}
        tenantId={tenantId}
        preselectedClient={bookingTargetClient}
        onBookingSuccess={() => {
          showToast('Appointment successfully scheduled and metered.');
        }}
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
        onScheduleNewBooking={(client) => handleScheduleFromDrawer(client)}
      />

      {/* Booking Details Slide-Over Drawer */}
      <BookingDetailsDrawer
        booking={selectedBookingForDrawer}
        client={customers.find(
          (c) =>
            selectedBookingForDrawer &&
            (c.id === selectedBookingForDrawer.customer_id ||
              c.id === selectedBookingForDrawer.client_id ||
              (c.phone && selectedBookingForDrawer.customer_phone && c.phone.replace(/[^0-9]/g, '') === selectedBookingForDrawer.customer_phone.replace(/[^0-9]/g, '')))
        )}
        isOpen={isBookingDrawerOpen}
        onClose={() => {
          setIsBookingDrawerOpen(false);
          setSelectedBookingForDrawer(null);
        }}
        tenantId={tenantId}
        onStatusUpdated={() => {
          showToast('Booking status updated.');
        }}
        onOpenClientProfile={(c) => {
          setIsBookingDrawerOpen(false);
          handleOpenClientDrawer(c);
        }}
        onScheduleNew={(c) => {
          setIsBookingDrawerOpen(false);
          handleScheduleFromDrawer(c);
        }}
      />
    </div>
  );
};

export default CustomersPage;
