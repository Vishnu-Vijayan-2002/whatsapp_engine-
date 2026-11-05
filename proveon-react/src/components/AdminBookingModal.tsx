import React, { useState, useEffect } from 'react';
import type { Customer, Appointment } from '../types';
import {
  getAvailableSlots,
  bookManualAppointmentWithMetering,
  reactiveStore,
} from '../firebase/firestoreService';

interface AdminBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  preselectedClient?: Customer | null;
  onBookingSuccess?: (booking: Appointment) => void;
}

export const AdminBookingModal: React.FC<AdminBookingModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  preselectedClient,
  onBookingSuccess,
}) => {
  const [existingClients, setExistingClients] = useState<Customer[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isNewClient, setIsNewClient] = useState<boolean>(false);

  // Form State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [serviceName, setServiceName] = useState('Comprehensive Consultation');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [notes, setNotes] = useState('');

  // Slot Availability
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync clients list
  useEffect(() => {
    if (!isOpen) return;
    const list = reactiveStore.getCustomers(tenantId);
    setExistingClients(list);

    if (preselectedClient) {
      setSelectedClientId(preselectedClient.id);
      setClientName(preselectedClient.full_name || preselectedClient.name || '');
      setClientPhone(preselectedClient.phone || preselectedClient.phone_number || '');
      setClientEmail(preselectedClient.email || '');
      setIsNewClient(false);
    } else if (list.length > 0 && !selectedClientId) {
      setSelectedClientId(list[0].id);
      setClientName(list[0].full_name || list[0].name || '');
      setClientPhone(list[0].phone || list[0].phone_number || '');
      setClientEmail(list[0].email || '');
    }
  }, [isOpen, tenantId, preselectedClient, selectedClientId]);

  // Handle client selection change
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId === 'NEW') {
      setIsNewClient(true);
      setClientName('');
      setClientPhone('');
      setClientEmail('');
    } else {
      setIsNewClient(false);
      const found = existingClients.find((c) => c.id === clientId);
      if (found) {
        setClientName(found.full_name || found.name || '');
        setClientPhone(found.phone || found.phone_number || '');
        setClientEmail(found.email || '');
      }
    }
  };

  // Fetch real-time available slots when date changes
  useEffect(() => {
    if (!isOpen || !tenantId || !bookingDate) return;
    let isCancelled = false;
    setIsLoadingSlots(true);
    setSelectedSlot('');

    getAvailableSlots(tenantId, bookingDate)
      .then((slots) => {
        if (!isCancelled) {
          const slotTimes = slots
            .filter((s) => s.status === 'available')
            .map((s) => s.time);
          setAvailableSlots(slotTimes);
          if (slotTimes.length > 0) {
            setSelectedSlot(slotTimes[0]);
          }
          setIsLoadingSlots(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Admin slot fetch error:', err);
          setIsLoadingSlots(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, tenantId, bookingDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMessage('Client name and contact phone number are required.');
      return;
    }

    if (!selectedSlot) {
      setErrorMessage('Please select an available time slot.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await bookManualAppointmentWithMetering(tenantId, {
        customer_id: isNewClient ? undefined : selectedClientId,
        customer_name: clientName.trim(),
        customer_phone: clientPhone.trim(),
        customer_email: clientEmail.trim(),
        service_name: serviceName.trim(),
        date: bookingDate,
        time: selectedSlot,
        duration_minutes: Number(durationMinutes),
        notes: notes.trim() || 'Manual booking via Admin Console',
      });

      if (onBookingSuccess) {
        onBookingSuccess(res.appointment);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete manual booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '92%', borderRadius: '12px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📅</span> Admin Manual Booking & Slot Allocation
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Directly reserve a slot for a client • Real-time collision protection (-0.50 cr)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="node-del-subitem-btn"
            style={{ width: '28px', height: '28px', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '12px', color: '#EF4444', marginBottom: '14px' }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Client Selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label className="form-label" style={{ margin: 0 }}>Client / Customer</label>
              {!preselectedClient && (
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => handleClientSelect(isNewClient ? (existingClients[0]?.id || '') : 'NEW')}
                >
                  {isNewClient ? '← Select Existing Client' : '+ Create New Client'}
                </button>
              )}
            </div>

            {!isNewClient ? (
              <select
                className="form-input"
                value={selectedClientId}
                disabled={Boolean(preselectedClient)}
                onChange={(e) => handleClientSelect(e.target.value)}
              >
                {existingClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.name} ({c.phone || c.phone_number})
                  </option>
                ))}
                <option value="NEW">+ Add New Client On-The-Fly</option>
              </select>
            ) : null}
          </div>

          {/* Client Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                value={clientName}
                placeholder="e.g. Liam Rodriguez"
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">WhatsApp Phone *</label>
              <input
                type="text"
                className="form-input"
                value={clientPhone}
                placeholder="+1 (555) 000-0000"
                onChange={(e) => setClientPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={clientEmail}
                placeholder="client@example.com"
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Service Required *</label>
              <select
                className="form-input"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
              >
                <option value="Executive Strategic Consultation">Executive Strategic Consultation</option>
                <option value="Quarterly Advisory Session">Quarterly Advisory Session</option>
                <option value="Comprehensive Onboarding & Review">Comprehensive Onboarding & Review</option>
                <option value="Standard Business Advisory">Standard Business Advisory</option>
                <option value="Follow-up Review Session">Follow-up Review Session</option>
              </select>
            </div>
          </div>

          {/* Date & Real-Time Slot Picker */}
          <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Scheduled Date *</span>
                  <span style={{ fontSize: '11px', color: '#00A884', fontWeight: 700 }}>Live DB</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={bookingDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Duration</label>
                <select
                  className="form-input"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes (Standard)</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={90}>90 Minutes</option>
                </select>
              </div>
            </div>

            {/* Available Slot Chips */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Real-Time Available Slots ({availableSlots.length} Open)
                </span>
                {isLoadingSlots && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Checking slots...</span>}
              </div>

              {isLoadingSlots ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>Loading available slots...</div>
              ) : availableSlots.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: selectedSlot === slot ? '1px solid #00A884' : '1px solid var(--border-light)',
                        background: selectedSlot === slot ? '#00A884' : 'var(--bg-card)',
                        color: selectedSlot === slot ? '#FFFFFF' : 'var(--text-main)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#EF4444', padding: '6px 0' }}>
                  ⚠️ No available slots found for this date. All slots are booked.
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Special Notes / Internal Instructions</label>
            <textarea
              className="form-input"
              rows={2}
              value={notes}
              placeholder="e.g. Client requested conference room with projector"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-action"
              disabled={isSubmitting || !selectedSlot}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmitting ? (
                <span>Confirming Slot...</span>
              ) : (
                <>
                  <span>Confirm & Allocate Slot</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>(-0.50 cr)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AdminBookingModal;
