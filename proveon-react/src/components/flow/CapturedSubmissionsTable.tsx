import React from 'react';
import type { CapturedFlowSubmission } from '../../types';

interface CapturedSubmissionsTableProps {
  submissions: CapturedFlowSubmission[];
  onNavigateAppointments?: () => void;
  onNavigateCustomers?: () => void;
}

export const CapturedSubmissionsTable: React.FC<CapturedSubmissionsTableProps> = ({
  submissions,
  onNavigateAppointments,
  onNavigateCustomers,
}) => {
  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    const d = typeof ts === 'number' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="flow-submissions-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Direct In-WhatsApp Submissions & Captured Leads
            </h3>
            <span className="live-beacon">
              <span className="beacon-dot"></span>
              REAL-TIME RULE ENGINE
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
            Data collected conversational-style directly inside WhatsApp without external redirects, auto-processed into database records.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onNavigateAppointments && (
            <button
              type="button"
              className="btn-secondary-action"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={onNavigateAppointments}
            >
              📅 Scheduled Appointments
            </button>
          )}
          {onNavigateCustomers && (
            <button
              type="button"
              className="btn-secondary-action"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={onNavigateCustomers}
            >
              👥 Client Directory
            </button>
          )}
        </div>
      </div>

      {submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
          <strong style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)' }}>
            No WhatsApp submissions recorded yet
          </strong>
          <span style={{ fontSize: '13px' }}>
            Test the live simulator above or message your WhatsApp number to capture leads directly in chat!
          </span>
        </div>
      ) : (
        <div className="dash-table-responsive">
          <table className="dash-data-table">
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Timestamp</th>
                <th>Patient / Lead</th>
                <th>Captured Field Data</th>
                <th>Backend Rule Engine Result</th>
                <th style={{ textAlign: 'right' }}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const data = sub.captured_data || {};
                return (
                  <tr key={sub.id}>
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {formatTime(sub.created_at)}
                      </span>
                    </td>

                    <td>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', display: 'block' }}>
                          {sub.customer_name || 'Anonymous Lead'}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {sub.customer_phone || '+1 (555) 000-0000'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {data.service_name && (
                          <div style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>
                            <strong>Service:</strong> {data.service_name}
                          </div>
                        )}
                        {data.appointment_slot && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <strong>Slot:</strong> {data.appointment_slot}
                          </div>
                        )}
                        {data.treatment_notes && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            <em>"{data.treatment_notes}"</em>
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="flow-submission-status-badge executed">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Action Executed: DB Record Created
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {sub.rule_engine_result?.message || 'Auto-created Appointment & Patient in DB'}
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
    </div>
  );
};

export default CapturedSubmissionsTable;

