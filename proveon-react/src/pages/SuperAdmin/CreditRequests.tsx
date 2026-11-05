import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeCreditRequests,
  approveCreditTopUp,
  rejectCreditTopUp,
} from '../../firebase/firestoreService';
import type { CreditTopUpRequest } from '../../types';
import './SuperAdmin.css';

const SuperAdminCreditRequests: React.FC = () => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<CreditTopUpRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Rejection Modal
  const [rejectModalReq, setRejectModalReq] = useState<CreditTopUpRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const unsub = subscribeCreditRequests((list) => {
      setRequests(list);
    });

    return () => unsub();
  }, []);

  const handleApprove = async (req: CreditTopUpRequest) => {
    const confirmed = window.confirm(
      `Approve ${req.amount.toFixed(2)} credits for "${req.business_name}"?\n\nThis will atomically allocate credits to their balance and log an immutable audit trail.`
    );
    if (!confirmed) return;

    try {
      setProcessingId(req.id);
      const res = await approveCreditTopUp({
        requestId: req.id,
        approverId: currentUser?.email || 'super_admin_root',
      });
      showToast(`Approved ${req.amount} credits for "${req.business_name}". New balance: ${res.newBalance.toFixed(2)} cr`);
    } catch (err: any) {
      showToast(err.message || 'Failed to approve credit request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq) return;

    try {
      setProcessingId(rejectModalReq.id);
      await rejectCreditTopUp({
        requestId: rejectModalReq.id,
        approverId: currentUser?.email || 'super_admin_root',
        rejectionReason: rejectReason.trim() || undefined,
      });

      showToast(`Rejected request #${rejectModalReq.id} for "${rejectModalReq.business_name}".`);
      setRejectModalReq(null);
      setRejectReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to reject request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Metrics
  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const approvedRequests = requests.filter((r) => r.status === 'APPROVED');
  const rejectedRequests = requests.filter((r) => r.status === 'REJECTED');

  const pendingCreditsSum = pendingRequests.reduce((acc, r) => acc + (r.amount || 0), 0);
  const approvedCreditsSum = approvedRequests.reduce((acc, r) => acc + (r.amount || 0), 0);

  // Filtered List
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchesSearch =
        !searchQuery ||
        r.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tenant_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.payment_reference && r.payment_reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.requested_by_email && r.requested_by_email.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, searchQuery]);

  return (
    <div className="super-tenants-container">
      {toastMessage && (
        <div className={`super-toast ${toastMessage.type}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {toastMessage.type === 'success' ? (
              <polyline points="20 6 9 17 4 12" />
            ) : (
              <circle cx="12" cy="12" r="10" />
            )}
          </svg>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="super-page-header">
        <div>
          <h1 className="super-page-title">Credit Approval & Reconciliation</h1>
          <p className="super-page-desc">
            Review, approve, and reconcile incoming tenant credit top-up requests with automated ledger allocation.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="dash-kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Pending Approvals</span>
              <span className="kpi-number" style={{ color: pendingRequests.length > 0 ? '#F59E0B' : 'var(--text-main)' }}>
                {pendingRequests.length}
              </span>
            </div>
            <div className="kpi-icon-bubble orange">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">+{pendingCreditsSum.toFixed(2)} cr</span>
            <span className="trend-label">awaiting allocation</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Total Approved</span>
              <span className="kpi-number" style={{ color: '#10B981' }}>
                {approvedRequests.length}
              </span>
            </div>
            <div className="kpi-icon-bubble green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">+{approvedCreditsSum.toFixed(2)} cr</span>
            <span className="trend-label">granted to tenants</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Rejected / Unreconciled</span>
              <span className="kpi-number" style={{ color: rejectedRequests.length > 0 ? '#EF4444' : 'var(--text-muted)' }}>
                {rejectedRequests.length}
              </span>
            </div>
            <div className="kpi-icon-bubble red">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-label">Invalid references or canceled</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Pending Value (USD)</span>
              <span className="kpi-number">
                ${pendingCreditsSum.toFixed(2)}
              </span>
            </div>
            <div className="kpi-icon-bubble purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-label">At $1.00 standard credit pricing</span>
          </div>
        </div>
      </section>

      {/* Main Table Card */}
      <div className="super-tenants-card">
        {/* Filters and search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px' }}>
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: statusFilter === st ? 'var(--primary)' : 'transparent',
                  color: statusFilter === st ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {st === 'PENDING' ? `Pending (${pendingRequests.length})` : st === 'ALL' ? 'All Requests' : st}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Search by clinic, ref, email..."
              className="form-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

        {/* Requests Table */}
        <div className="dash-table-responsive">
          <table className="dash-data-table">
            <thead>
              <tr>
                <th>Clinic / Business</th>
                <th>Requested Credits</th>
                <th>Payment / Wire Ref</th>
                <th>Requester</th>
                <th>Requested At</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No credit top-up requests found in this view.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id}>
                    {/* Business Name & Tenant ID */}
                    <td>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', display: 'block' }}>
                          {req.business_name}
                        </strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ID: {req.tenant_id}
                        </span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td>
                      <div>
                        <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>
                          +{req.amount.toFixed(2)} cr
                        </strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                          ${req.amount.toFixed(2)} USD
                        </span>
                      </div>
                    </td>

                    {/* Reference & Notes */}
                    <td>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)' }}>
                          {req.payment_reference || 'N/A'}
                        </span>
                        {req.notes && (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block' }}>
                            "{req.notes}"
                          </span>
                        )}
                        {req.rejection_reason && req.status === 'REJECTED' && (
                          <span style={{ fontSize: '11px', color: '#DC2626', display: 'block' }}>
                            Reason: {req.rejection_reason}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Requester */}
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {req.requested_by_email}
                      </span>
                    </td>

                    {/* Time */}
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(req.requested_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td>
                      <span className={`status-pill ${req.status === 'APPROVED' ? 'active' : req.status === 'PENDING' ? 'pending' : 'inactive'}`}>
                        {req.status}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td style={{ textAlign: 'right' }}>
                      {req.status === 'PENDING' ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-primary-action"
                            disabled={processingId === req.id}
                            style={{
                              fontSize: '11.5px',
                              padding: '5px 12px',
                              background: '#10B981',
                              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                            }}
                            onClick={() => handleApprove(req)}
                          >
                            {processingId === req.id ? 'Processing...' : '✓ Approve & Allocate'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary-action"
                            disabled={processingId === req.id}
                            style={{
                              fontSize: '11.5px',
                              padding: '5px 10px',
                              color: '#EF4444',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                            }}
                            onClick={() => {
                              setRejectModalReq(req);
                              setRejectReason('');
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {req.resolved_by ? `By: ${req.resolved_by}` : 'Reconciled'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalReq && (
        <div className="modal-overlay" onClick={() => setRejectModalReq(null)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Reject Credit Request</h3>
              <button className="modal-close-btn" onClick={() => setRejectModalReq(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div className="modal-body">
                <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                  You are rejecting a request of <strong>{rejectModalReq.amount} credits</strong> from{' '}
                  <strong>{rejectModalReq.business_name}</strong>.
                </p>

                <div className="form-group">
                  <label className="form-label">Reason for Rejection</label>
                  <textarea
                    rows={3}
                    className="form-textarea"
                    placeholder="e.g. Unmatched wire reference, payment transaction not received, or duplicate request..."
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setRejectModalReq(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  style={{ background: '#EF4444' }}
                  disabled={processingId === rejectModalReq.id}
                >
                  {processingId === rejectModalReq.id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminCreditRequests;

