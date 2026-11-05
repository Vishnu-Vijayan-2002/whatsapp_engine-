import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestCreditTopUp, subscribeCreditRequests } from '../firebase/firestoreService';
import type { CreditTopUpRequest, Tenant } from '../types';
import './CreditTopUpModal.css';

interface CreditTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  tenantId: string;
}

const PRESET_AMOUNTS = [
  { credits: 50, label: 'Starter', price: '$50.00' },
  { credits: 100, label: 'Growth', price: '$100.00' },
  { credits: 250, label: 'Pro Scale', price: '$250.00' },
  { credits: 500, label: 'Enterprise', price: '$500.00' },
];

export const CreditTopUpModal: React.FC<CreditTopUpModalProps> = ({
  isOpen,
  onClose,
  tenant,
  tenantId,
}) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'REQUEST' | 'HISTORY'>('REQUEST');
  const [selectedCredits, setSelectedCredits] = useState<number>(100);
  const [customCredits, setCustomCredits] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Request history list
  const [history, setHistory] = useState<CreditTopUpRequest[]>([]);

  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const unsub = subscribeCreditRequests((list) => {
      setHistory(list);
    }, tenantId);

    return () => unsub();
  }, [isOpen, tenantId]);

  if (!isOpen) return null;

  const currentAmount = customCredits ? parseFloat(customCredits) || 0 : selectedCredits;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAmount <= 0) {
      setErrorMessage('Please specify a positive credit amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await requestCreditTopUp({
        tenant_id: tenantId,
        business_name: tenant?.business_name || 'Business',
        amount: currentAmount,
        payment_reference: paymentRef,
        notes,
        requested_by_email: currentUser?.email || tenant?.admin_email || 'admin@business.io',
      });

      setSuccessMessage(`Top-up request for ${currentAmount.toFixed(2)} credits submitted! Awaiting Super Admin reconciliation.`);
      setPaymentRef('');
      setNotes('');
      setCustomCredits('');
      setSelectedCredits(100);

      // Switch to history tab after 1.5s
      setTimeout(() => {
        setSuccessMessage(null);
        setActiveTab('HISTORY');
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit credit top-up request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: CreditTopUpRequest['status']) => {
    switch (status) {
      case 'APPROVED':
        return <span className="topup-badge approved">✓ Approved</span>;
      case 'REJECTED':
        return <span className="topup-badge rejected">✕ Rejected</span>;
      default:
        return <span className="topup-badge pending">⏳ Pending Approval</span>;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card topup-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="topup-header-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0 }}>
                Credit Top-Up & Reconciliation
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {tenant?.business_name} • Current Balance: <strong>{(tenant?.credit_wallet?.balance || 0).toFixed(2)} cr</strong>
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="topup-tab-bar">
          <button
            type="button"
            className={`topup-tab-btn ${activeTab === 'REQUEST' ? 'active' : ''}`}
            onClick={() => setActiveTab('REQUEST')}
          >
            New Top-Up Request
          </button>
          <button
            type="button"
            className={`topup-tab-btn ${activeTab === 'HISTORY' ? 'active' : ''}`}
            onClick={() => setActiveTab('HISTORY')}
          >
            Request History ({history.length})
          </button>
        </div>

        {/* Tab 1: New Request Form */}
        {activeTab === 'REQUEST' && (
          <form onSubmit={handleSubmit} className="topup-modal-form">
            <div className="modal-body">
              {successMessage && (
                <div className="topup-alert success">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="topup-alert error">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Package Presets */}
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                Select Credit Package:
              </label>
              <div className="topup-preset-grid">
                {PRESET_AMOUNTS.map((pkg) => {
                  const isSelected = !customCredits && selectedCredits === pkg.credits;
                  return (
                    <button
                      key={pkg.credits}
                      type="button"
                      className={`topup-preset-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setCustomCredits('');
                        setSelectedCredits(pkg.credits);
                      }}
                    >
                      <span className="preset-label">{pkg.label}</span>
                      <strong className="preset-amount">{pkg.credits} cr</strong>
                      <span className="preset-price">{pkg.price}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Amount */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label">Or Custom Credit Quantity</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    placeholder="e.g. 750"
                    className="form-input"
                    value={customCredits}
                    onChange={(e) => setCustomCredits(e.target.value)}
                    style={{ paddingRight: '50px' }}
                  />
                  <span style={{ position: 'absolute', right: '14px', top: '9px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    credits
                  </span>
                </div>
              </div>

              {/* Transaction Ref / Notes */}
              <div className="form-group">
                <label className="form-label">
                  Payment / Bank Wire Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIRE-984210, UTR #5544921, Stripe Inv #33"
                  className="form-input"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                  Helps the Super Admin reconcile and verify your wire or corporate payment quickly.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Reconciliation Notes</label>
                <textarea
                  rows={2}
                  placeholder="Any operational notes or urgency instructions..."
                  className="form-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Summary box */}
              <div className="topup-summary-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Total Credits to Request:
                  </span>
                  <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>
                    +{currentAmount.toFixed(2)} cr
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Est. Value ($1.00 = 1.00 cr):</span>
                  <span>${currentAmount.toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary-action" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary-action"
                disabled={isSubmitting || currentAmount <= 0}
              >
                {isSubmitting ? 'Submitting...' : `Submit Request (+${currentAmount.toFixed(0)} cr)`}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Request History & Live Status Tracking */}
        {activeTab === 'HISTORY' && (
          <div className="modal-body" style={{ padding: '20px' }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '14px' }}>
                  No top-up requests submitted yet
                </strong>
                <span style={{ fontSize: '12px' }}>
                  Use the "New Top-Up Request" tab to request additional platform credits.
                </span>
              </div>
            ) : (
              <div className="topup-history-list">
                {history.map((req) => (
                  <div key={req.id} className="topup-history-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div>
                        <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                          +{req.amount.toFixed(2)} Credits
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                          Ref: {req.payment_reference || 'No reference note'}
                        </span>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>

                    {req.notes && (
                      <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        "{req.notes}"
                      </p>
                    )}

                    {req.rejection_reason && req.status === 'REJECTED' && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '6px 10px', borderRadius: '4px', fontSize: '11.5px', color: '#DC2626', marginTop: '6px' }}>
                        <strong>Rejection Reason:</strong> {req.rejection_reason}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>Submitted: {new Date(req.requested_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {req.resolved_at && (
                        <span>Resolved: {new Date(req.resolved_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

