import React, { useState, useMemo } from 'react';
import type { Customer, Appointment } from '../types';
import {
  reactiveStore,
  updateAppointmentStatus,
} from '../firebase/firestoreService';

interface ClientProfileDrawerProps {
  client: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onScheduleNewBooking: (client: Customer) => void;
  onRefresh?: () => void;
}

export const ClientProfileDrawer: React.FC<ClientProfileDrawerProps> = ({
  client,
  isOpen,
  onClose,
  tenantId,
  onScheduleNewBooking,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'VISITS' | 'TIMELINE' | 'NOTES'>('VISITS');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const clientAppointments: Appointment[] = useMemo(() => {
    if (!isOpen || !client) return [];

    // Filter appointments for this client
    const appts: Appointment[] = reactiveStore.getAppointments(tenantId).filter(
      (a: Appointment) =>
        a.customer_id === client.id ||
        a.client_id === client.id ||
        (a.customer_phone && client.phone && a.customer_phone.replace(/[^0-9]/g, '') === client.phone.replace(/[^0-9]/g, ''))
    );

    // Sort latest first
    return appts.sort((a, b) => new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime());
  }, [isOpen, client, tenantId, refreshKey]);

  if (!isOpen || !client) return null;

  const totalBookings = client.total_bookings || clientAppointments.length || 1;
  const completedVisits = client.total_completed_visits !== undefined
    ? client.total_completed_visits
    : clientAppointments.filter((a) => a.status === 'ATTENDED' || a.status === 'COMPLETED').length;
  const attendanceRate = totalBookings > 0
    ? Math.min(100, Math.round((completedVisits / totalBookings) * 100))
    : 100;

  const handleStatusChange = async (appointmentId: string, newStatus: Appointment['status']) => {
    try {
      setIsUpdatingStatus(true);
      await updateAppointmentStatus(tenantId, appointmentId, newStatus);
      setRefreshKey((k) => k + 1);
      if (onRefresh) onRefresh();
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const formatChatTime = (ts: any) => {
    if (!ts) return 'Never';
    const d = typeof ts === 'number' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts);
    const diffMins = Math.floor((Date.now() - d.getTime()) / (1000 * 60));
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'ATTENDED':
      case 'COMPLETED':
        return { bg: 'rgba(16, 185, 129, 0.14)', color: '#10B981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'CONFIRMED':
        return { bg: 'rgba(59, 130, 246, 0.14)', color: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' };
      case 'PENDING':
        return { bg: 'rgba(245, 158, 11, 0.14)', color: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' };
      case 'CANCELLED':
        return { bg: 'rgba(239, 68, 68, 0.14)', color: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'NO_SHOW':
        return { bg: 'rgba(107, 114, 128, 0.14)', color: '#6B7280', border: 'rgba(107, 114, 128, 0.3)' };
      default:
        return { bg: 'var(--bg-input)', color: 'var(--text-main)', border: 'var(--border-light)' };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 1050,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          background: 'var(--bg-card)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          animation: 'slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00A884 0%, #0284C7 100%)',
                color: '#fff',
                fontSize: '20px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(0, 168, 132, 0.2)',
              }}
            >
              {(client.full_name || client.name || 'C')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {client.full_name || client.name}
                </h2>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: client.status === 'vip' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 168, 132, 0.15)',
                    color: client.status === 'vip' ? '#D97706' : '#00A884',
                    border: client.status === 'vip' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(0, 168, 132, 0.3)',
                  }}
                >
                  {client.status === 'vip' ? 'VIP Client' : 'Active Client'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#00A884' }}>💬</span> {client.phone || client.phone_number}
                </span>
                <span>•</span>
                <span>{client.email || 'No email registered'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="node-del-subitem-btn"
            style={{ width: '32px', height: '32px', fontSize: '15px' }}
          >
            ✕
          </button>
        </div>

        {/* Engagement Stats Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '16px 24px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Bookings</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{totalBookings}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Attended</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>{completedVisits}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Attendance</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>{attendanceRate}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>WhatsApp Chat</span>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#00A884', marginTop: '4px' }}>{formatChatTime(client.last_interacted_at)}</div>
          </div>
        </div>

        {/* Action Button Bar */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn-primary-action"
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
            onClick={() => onScheduleNewBooking(client)}
          >
            <span>📅</span>
            <span>Schedule New Booking</span>
          </button>
          <a
            href={`https://wa.me/${(client.phone || '').replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary-action"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 16px', color: '#00A884', borderColor: '#00A884' }}
            title="Open direct WhatsApp conversation"
          >
            <span>💬 Open Chat</span>
          </a>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', padding: '0 24px', background: 'var(--bg-card)' }}>
          <button
            type="button"
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: 800,
              color: activeTab === 'VISITS' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'VISITS' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('VISITS')}
          >
            Visit History ({clientAppointments.length})
          </button>
          <button
            type="button"
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: 800,
              color: activeTab === 'TIMELINE' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'TIMELINE' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('TIMELINE')}
          >
            Activity & WhatsApp Logs
          </button>
          <button
            type="button"
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: 800,
              color: activeTab === 'NOTES' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'NOTES' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('NOTES')}
          >
            Client Notes
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {/* Tab 1: Visit History */}
          {activeTab === 'VISITS' && (
            <div>
              {clientAppointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
                  <p style={{ margin: 0, fontWeight: 600 }}>No previous visits recorded for this client.</p>
                  <button
                    type="button"
                    className="btn-secondary-action"
                    style={{ marginTop: '12px' }}
                    onClick={() => onScheduleNewBooking(client)}
                  >
                    + Book First Appointment
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {clientAppointments.map((appt) => {
                    const statusStyle = getStatusColor(appt.status);
                    return (
                      <div
                        key={appt.id}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                              {appt.service_name}
                            </span>
                            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🗓️ {appt.date} at {appt.time}</span>
                              <span>•</span>
                              <span>⏱️ {appt.duration_minutes || 45} mins</span>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: statusStyle.bg,
                              color: statusStyle.color,
                              border: `1px solid ${statusStyle.border}`,
                            }}
                          >
                            {appt.status}
                          </span>
                        </div>

                        {appt.notes && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                            <strong>Note:</strong> {appt.notes}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--border-light)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Source: {appt.booking_source === 'admin_manual' ? '👤 Admin Manual' : '🤖 WhatsApp Bot'}
                          </span>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Update:</span>
                            <select
                              className="node-input-sm"
                              style={{ padding: '2px 6px', fontSize: '11px', height: '24px' }}
                              value={appt.status}
                              disabled={isUpdatingStatus}
                              onChange={(e) => handleStatusChange(appt.id, e.target.value as Appointment['status'])}
                            >
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="ATTENDED">Attended</option>
                              <option value="PENDING">Pending</option>
                              <option value="NO_SHOW">No-Show</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Activity & WhatsApp Logs */}
          {activeTab === 'TIMELINE' && (
            <div style={{ position: 'relative', paddingLeft: '20px' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '6px',
                  bottom: '6px',
                  left: '6px',
                  width: '2px',
                  background: 'var(--border-light)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-20px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#00A884', border: '2px solid var(--bg-card)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>WhatsApp Automation Active</span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Client phone identity is connected to WhatsApp bot engine. Last interaction: {formatChatTime(client.last_interacted_at)}.
                  </p>
                </div>

                {clientAppointments.map((a, i) => (
                  <div key={a.id || i} style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-20px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: a.status === 'ATTENDED' ? '#10B981' : 'var(--primary)', border: '2px solid var(--bg-card)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                      Visit {a.status === 'ATTENDED' ? 'Completed' : 'Scheduled'}: {a.service_name}
                    </span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {a.date} at {a.time} ({a.duration_minutes || 45} mins) • Status: <strong>{a.status}</strong>
                    </p>
                    {a.notes && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "{a.notes}"
                      </p>
                    )}
                  </div>
                ))}

                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-20px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-muted)', border: '2px solid var(--bg-card)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>Client Profile Registered</span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Record established in client database on {new Date(client.created_at).toLocaleDateString()}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Notes */}
          {activeTab === 'NOTES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Client Preferences & Profile Notes
                </span>
                <p style={{ margin: '8px 0 0 0', fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {client.notes || 'No specific notes recorded for this client.'}
                </p>
              </div>

              <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Primary Service Interest
                </span>
                <p style={{ margin: '8px 0 0 0', fontSize: '13.5px', color: 'var(--text-main)' }}>
                  {client.service_interest || 'General Consultation'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ClientProfileDrawer;
