import React from 'react';
import type { Appointment, Customer, BookingStatus } from '../types';
import { updateAppointmentStatus } from '../firebase/firestoreService';

interface BookingDetailsDrawerProps {
  booking: Appointment | null;
  client?: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onStatusUpdated?: (bookingId: string, newStatus: BookingStatus) => void;
  onOpenClientProfile?: (client: Customer) => void;
  onScheduleNew?: (client?: Customer) => void;
}

export const BookingDetailsDrawer: React.FC<BookingDetailsDrawerProps> = ({
  booking,
  client,
  isOpen,
  onClose,
  tenantId,
  onStatusUpdated,
  onOpenClientProfile,
  onScheduleNew,
}) => {
  const [isUpdating, setIsUpdating] = React.useState(false);

  if (!isOpen || !booking) return null;

  const handleUpdate = async (status: BookingStatus) => {
    try {
      setIsUpdating(true);
      await updateAppointmentStatus(tenantId, booking.id, status);
      if (onStatusUpdated) onStatusUpdated(booking.id, status);
    } finally {
      setIsUpdating(false);
    }
  };

  const cleanPhone = (booking.customer_phone || client?.phone || '').replace(/[^0-9]/g, '');
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className={`status-pill ${
                booking.status === 'ATTENDED' || booking.status === 'COMPLETED' ? 'active' :
                booking.status === 'CONFIRMED' ? 'active' :
                booking.status === 'NO_SHOW' ? 'inactive' :
                booking.status === 'CANCELLED' ? 'inactive' : 'pending'
              }`}>
                {booking.status}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ID: {booking.id.slice(0, 10)}
              </span>
            </div>
            <h2 className="drawer-title" style={{ margin: 0, fontSize: '18px' }}>
              Booking Details
            </h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>

        {/* Drawer Content */}
        <div className="drawer-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section A: Client Overview Card */}
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontWeight: 800 }}>
              CLIENT INFORMATION
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px' }}>
                {(booking.customer_name || 'C').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '15px', color: 'var(--text-main)', display: 'block' }}>
                  {booking.customer_name || 'Client'}
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  {booking.customer_phone || 'No phone recorded'}
                </span>
              </div>

              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary-action"
                  style={{ fontSize: '12px', padding: '6px 12px', color: '#00B69B', borderColor: 'rgba(0, 182, 155, 0.3)', textDecoration: 'none' }}
                  title="Chat directly on WhatsApp"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>

            {client && onOpenClientProfile && (
              <button
                type="button"
                onClick={() => onOpenClientProfile(client)}
                style={{
                  marginTop: '12px',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: '12.5px',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                View Full Client Profile & Visit History →
              </button>
            )}
          </div>

          {/* Section B: Appointment Specifics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontWeight: 800 }}>
                SERVICE & SLOT SCHEDULE
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                <div>
                  <strong style={{ fontSize: '16px', color: 'var(--text-main)', display: 'block' }}>
                    {booking.service_name}
                  </strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    📅 {booking.date} at <strong>{booking.time}</strong> ({booking.duration_minutes || 45} mins)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    background: booking.booking_source === 'whatsapp_bot' ? 'rgba(0, 182, 155, 0.12)' : 'rgba(72, 128, 255, 0.12)',
                    color: booking.booking_source === 'whatsapp_bot' ? '#00B69B' : 'var(--primary)',
                  }}
                >
                  {booking.booking_source === 'whatsapp_bot' ? '💬 WhatsApp Bot' : '👤 Admin Manual'}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Notes & Requirements:
              </span>
              <p style={{ margin: 0, fontSize: '13px', color: booking.notes ? 'var(--text-main)' : 'var(--text-muted)' }}>
                {booking.notes || 'No special requirements noted for this booking.'}
              </p>
            </div>
          </div>

          {/* Section C: Quick Status Transitions */}
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontWeight: 800, display: 'block', marginBottom: '10px' }}>
              TRANSITION BOOKING STATUS
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary-action"
                disabled={isUpdating || booking.status === 'ATTENDED' || booking.status === 'COMPLETED'}
                style={{
                  background: booking.status === 'ATTENDED' ? '#10B981' : 'rgba(16, 185, 129, 0.12)',
                  color: booking.status === 'ATTENDED' ? '#fff' : '#059669',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  fontWeight: 700,
                  justifyContent: 'center',
                }}
                onClick={() => handleUpdate('ATTENDED')}
              >
                ✓ Mark Attended
              </button>

              <button
                type="button"
                className="btn-secondary-action"
                disabled={isUpdating || booking.status === 'CONFIRMED'}
                style={{
                  background: booking.status === 'CONFIRMED' ? 'var(--primary)' : 'rgba(72, 128, 255, 0.12)',
                  color: booking.status === 'CONFIRMED' ? '#fff' : 'var(--primary)',
                  borderColor: 'rgba(72, 128, 255, 0.3)',
                  fontWeight: 700,
                  justifyContent: 'center',
                }}
                onClick={() => handleUpdate('CONFIRMED')}
              >
                Confirm Slot
              </button>

              <button
                type="button"
                className="btn-secondary-action"
                disabled={isUpdating || booking.status === 'NO_SHOW'}
                style={{
                  background: booking.status === 'NO_SHOW' ? '#F59E0B' : 'rgba(245, 158, 11, 0.12)',
                  color: booking.status === 'NO_SHOW' ? '#fff' : '#D97706',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  fontWeight: 700,
                  justifyContent: 'center',
                }}
                onClick={() => handleUpdate('NO_SHOW')}
              >
                Mark No-Show
              </button>

              <button
                type="button"
                className="btn-secondary-action"
                disabled={isUpdating || booking.status === 'CANCELLED'}
                style={{
                  background: booking.status === 'CANCELLED' ? '#EF4444' : 'rgba(239, 68, 68, 0.12)',
                  color: booking.status === 'CANCELLED' ? '#fff' : '#DC2626',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  fontWeight: 700,
                  justifyContent: 'center',
                }}
                onClick={() => handleUpdate('CANCELLED')}
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--border-light)' }}>
          {onScheduleNew && (
            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => {
                onClose();
                onScheduleNew(client || undefined);
              }}
            >
              📅 Re-Schedule
            </button>
          )}
          <button type="button" className="btn-primary-action" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

