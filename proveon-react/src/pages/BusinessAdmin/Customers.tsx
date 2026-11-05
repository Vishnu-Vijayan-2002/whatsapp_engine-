import React, { useEffect, useState, useMemo } from 'react';
import { useTenant } from '../../context/TenantContext';
import {
  subscribeCustomers,
  subscribeAppointments,
  createCustomerWithMetering,
  createAppointmentWithMetering,
} from '../../firebase/firestoreService';
import type { Customer, Appointment } from '../../types';
import './BusinessAdmin.css';
import '../SuperAdmin/SuperAdmin.css';

const CustomersPage: React.FC = () => {
  const { tenantId, tenant, isOutOfCredits, setRechargeModalOpen } = useTenant();

  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'APPOINTMENTS'>('APPOINTMENTS');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddApptModal, setShowAddApptModal] = useState(false);

  // Customer Form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceInterest, setServiceInterest] = useState('Laser Skin Treatment');
  const [notes, setNotes] = useState('');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Appointment Form
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [apptCustomerName, setApptCustomerName] = useState('');
  const [apptCustomerPhone, setApptCustomerPhone] = useState('');
  const [apptService, setApptService] = useState('Consultation & Skin Analysis');
  const [apptDate, setApptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [apptTime, setApptTime] = useState('11:00');
  const [apptNotes, setApptNotes] = useState('');
  const [isSubmittingAppt, setIsSubmittingAppt] = useState(false);

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

  // Handle Add Customer
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOutOfCredits) {
      setShowAddCustomerModal(false);
      setRechargeModalOpen(true);
      return;
    }

    if (!fullName.trim() || !phone.trim()) {
      showToast('Name and phone number are required.');
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

      showToast(`Saved customer record for "${res.customer.full_name}". Deducted 0.50 cr.`);
      setFullName('');
      setPhone('');
      setEmail('');
      setNotes('');
      setShowAddCustomerModal(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save customer');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  // Handle Create Appointment
  const handleAddApptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOutOfCredits) {
      setShowAddApptModal(false);
      setRechargeModalOpen(true);
      return;
    }

    const cName = selectedCustomerId
      ? customers.find((c) => c.id === selectedCustomerId)?.full_name || apptCustomerName
      : apptCustomerName;
    const cPhone = selectedCustomerId
      ? customers.find((c) => c.id === selectedCustomerId)?.phone || apptCustomerPhone
      : apptCustomerPhone;

    if (!cName.trim()) {
      showToast('Client name is required.');
      return;
    }

    try {
      setIsSubmittingAppt(true);
      const res = await createAppointmentWithMetering(tenantId, {
        tenant_id: tenantId,
        customer_id: selectedCustomerId || undefined,
        customer_name: cName.trim(),
        customer_phone: cPhone.trim(),
        service_name: apptService,
        date: apptDate,
        time: apptTime,
        status: 'CONFIRMED',
        notes: apptNotes.trim(),
      });

      showToast(`Appointment booked for ${res.appointment.customer_name} at ${res.appointment.time}. Deducted 0.50 cr.`);
      setApptCustomerName('');
      setApptCustomerPhone('');
      setApptNotes('');
      setShowAddApptModal(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to book appointment');
    } finally {
      setIsSubmittingAppt(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        !searchQuery ||
        c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(
      (a) =>
        !searchQuery ||
        a.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.service_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [appointments, searchQuery]);

  return (
    <div className="dashstack-overview">
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
          <h1 className="dash-page-title">Client & Appointment Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {tenant?.business_name || 'Business'} • Metered Database Mutations with Live Credit Wallet Updates
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
            + Add New Client (-0.50 cr)
          </button>

          <button
            className="btn-primary-action"
            onClick={() => {
              if (isOutOfCredits) setRechargeModalOpen(true);
              else setShowAddApptModal(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Book Visit (-0.50 cr)
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-input)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              className={`btn-secondary-action ${activeTab === 'APPOINTMENTS' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'APPOINTMENTS' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'APPOINTMENTS' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
              }}
              onClick={() => setActiveTab('APPOINTMENTS')}
            >
              Scheduled Visits ({appointments.length})
            </button>
            <button
              className={`btn-secondary-action ${activeTab === 'CUSTOMERS' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'CUSTOMERS' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'CUSTOMERS' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
              }}
              onClick={() => setActiveTab('CUSTOMERS')}
            >
              Client / Patient Directory ({customers.length})
            </button>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Search records..."
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

        {/* Tab 1: Appointments Table */}
        {activeTab === 'APPOINTMENTS' && (
          <div className="dash-table-responsive">
            <table className="dash-data-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Service Requested</th>
                  <th>Date & Time</th>
                  <th>Contact Phone</th>
                  <th>Status</th>
                  <th>Special Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No appointments found. Click "Book Visit" to schedule a visit!
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>
                          {a.customer_name}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {a.service_name}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>
                          {a.date} at {a.time}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {a.customer_phone || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className="status-pill active">{a.status}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {a.notes || 'None'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Customers Table */}
        {activeTab === 'CUSTOMERS' && (
          <div className="dash-table-responsive">
            <table className="dash-data-table">
              <thead>
                <tr>
                  <th>Client / Patient Name</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>Primary Service Interest</th>
                  <th>Medical / Styling Notes</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No clients found. Click "+ Add New Client" to create the first record!
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>
                          {c.full_name}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {c.phone}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {c.email || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className="vertical-badge clinic">{c.service_interest}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {c.notes || 'None specified'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Add New Customer */}
      {showAddCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Register New Client / Patient</h3>
              <button className="modal-close-btn" onClick={() => setShowAddCustomerModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit}>
              <div className="modal-body">
                <div style={{ background: 'var(--primary-light)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--primary)' }}>
                  <strong>Credit Accounting Notice:</strong> Saving this customer will atomically deduct <strong>0.50 credits</strong> (DB_WRITE_MUTATION) from your wallet balance.
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
                  <label className="form-label">Treatment / Service Interest</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Botox / Fillers, Dental Cleaning, Hair Glossing..."
                    value={serviceInterest}
                    onChange={(e) => setServiceInterest(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Clinical / Styling Notes</label>
                  <textarea
                    rows={2}
                    className="form-textarea"
                    placeholder="Allergies, sensitivities, preferences..."
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

      {/* Modal 2: Book Appointment */}
      {showAddApptModal && (
        <div className="modal-overlay" onClick={() => setShowAddApptModal(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Schedule Appointment Visit</h3>
              <button className="modal-close-btn" onClick={() => setShowAddApptModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddApptSubmit}>
              <div className="modal-body">
                <div style={{ background: 'var(--primary-light)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--primary)' }}>
                  <strong>Credit Accounting Notice:</strong> Booking this appointment slot will deduct <strong>0.50 credits</strong> (DB_WRITE_MUTATION) from your balance.
                </div>

                {customers.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Select Existing Client (Optional)</label>
                    <select
                      className="form-select"
                      value={selectedCustomerId}
                      onChange={(e) => {
                        setSelectedCustomerId(e.target.value);
                        const c = customers.find((cust) => cust.id === e.target.value);
                        if (c) {
                          setApptCustomerName(c.full_name);
                          setApptCustomerPhone(c.phone);
                        }
                      }}
                    >
                      <option value="">-- Choose from registered client list --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Client Full Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Mark Johnson"
                      required
                      value={apptCustomerName}
                      onChange={(e) => setApptCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+1 (555) 123-4567"
                      value={apptCustomerPhone}
                      onChange={(e) => setApptCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Service / Treatment</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Laser Resurfacing Session 1"
                    required
                    value={apptService}
                    onChange={(e) => setApptService(e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={apptDate}
                      onChange={(e) => setApptDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Time</label>
                    <input
                      type="time"
                      className="form-input"
                      required
                      value={apptTime}
                      onChange={(e) => setApptTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Visit Notes / Practitioner</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Room 2, Dr. Mitchell presiding"
                    value={apptNotes}
                    onChange={(e) => setApptNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setShowAddApptModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isSubmittingAppt || isOutOfCredits}
                >
                  {isSubmittingAppt ? 'Booking...' : 'Book Visit (-0.50 cr)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
