import React, { useEffect, useState, useMemo } from 'react';
import { useTenant } from '../../context/TenantContext';
import {
  subscribeMediaFiles,
  uploadMediaWithMetering,
} from '../../firebase/firestoreService';
import type { MediaFile } from '../../types';
import './BusinessAdmin.css';
import '../SuperAdmin/SuperAdmin.css';

const MediaPage: React.FC = () => {
  const { tenantId, tenant, isOutOfCredits, setRechargeModalOpen } = useTenant();

  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Upload Form State
  const [fileName, setFileName] = useState('');
  const [fileCategory, setFileCategory] = useState<MediaFile['category']>('DOCUMENT');
  const [fileSizeMb, setFileSizeMb] = useState<number>(4.5);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!tenantId) return;

    const unsub = subscribeMediaFiles(tenantId, (list) => {
      setMediaFiles(list);
    });

    return () => unsub();
  }, [tenantId]);

  // Dynamic credit cost calculator for preview
  const estimatedCost = useMemo(() => {
    return Math.max(0.10, Number(((fileSizeMb / 10) * 1.00).toFixed(2)));
  }, [fileSizeMb]);

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOutOfCredits) {
      setShowUploadModal(false);
      setRechargeModalOpen(true);
      return;
    }

    if (!fileName.trim()) {
      showToast('Please specify a filename.');
      return;
    }

    try {
      setIsUploading(true);

      // Select realistic stock preview depending on category
      let sampleUrl = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=60';
      if (fileCategory === 'PORTFOLIO_IMAGE') {
        sampleUrl = 'https://images.unsplash.com/photo-1512290900672-1f41d3b0c538?w=600&auto=format&fit=crop&q=60';
      } else if (fileCategory === 'CONTRACT') {
        sampleUrl = 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=60';
      }

      const res = await uploadMediaWithMetering(tenantId, {
        file_name: fileName.trim(),
        file_type: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        file_size_mb: Number(fileSizeMb),
        category: fileCategory,
        url: sampleUrl,
      });

      showToast(`Uploaded ${res.media.file_name} (${fileSizeMb}MB). Deducted ${res.creditsMetered} credits.`);
      setFileName('');
      setShowUploadModal(false);
    } catch (err: any) {
      showToast(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredMedia = useMemo(() => {
    return mediaFiles.filter((m) => {
      if (selectedCategory === 'ALL') return true;
      return m.category === selectedCategory;
    });
  }, [mediaFiles, selectedCategory]);

  const totalStorageMb = mediaFiles.reduce((acc, m) => acc + (m.file_size_mb || 0), 0);
  const totalCreditsMetered = mediaFiles.reduce((acc, m) => acc + (m.credits_metered || 0), 0);

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
          <h1 className="dash-page-title">Documents & Media Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {tenant?.business_name || 'Business'} • Dynamic Storage Metering (STORAGE_INGEST_MB = 1.00 cr / 10MB)
          </p>
        </div>

        <button
          className="btn-primary-action"
          onClick={() => {
            if (isOutOfCredits) setRechargeModalOpen(true);
            else setShowUploadModal(true);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Upload Document / File
        </button>
      </div>

      {/* Quick Summary Cards */}
      <section className="dash-kpi-grid">
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Total Files Ingested</span>
              <span className="kpi-number">{mediaFiles.length}</span>
            </div>
            <div className="kpi-icon-bubble purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">Live Storage Metering</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Storage Consumed</span>
              <span className="kpi-number">{totalStorageMb.toFixed(1)} <small style={{ fontSize: '15px', color: 'var(--text-muted)' }}>MB</small></span>
            </div>
            <div className="kpi-icon-bubble yellow">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-label">Metered payload volume</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Storage Credits Billed</span>
              <span className="kpi-number" style={{ color: '#EF3826' }}>
                {totalCreditsMetered.toFixed(2)} <small style={{ fontSize: '15px' }}>cr</small>
              </span>
            </div>
            <div className="kpi-icon-bubble green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-label">Deducted from wallet</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Effective Rate</span>
              <span className="kpi-number">1.00 <small style={{ fontSize: '14px', color: 'var(--text-muted)' }}>cr / 10MB</small></span>
            </div>
            <div className="kpi-icon-bubble orange">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-label">Rate Card Baseline</span>
          </div>
        </div>
      </section>

      {/* Dropzone Upload Section */}
      <div
        className="media-dropzone"
        onClick={() => {
          if (isOutOfCredits) setRechargeModalOpen(true);
          else setShowUploadModal(true);
        }}
      >
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
            Upload Client Contract, Proposal, Portfolio, or Intake Form
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Click to select or drop files. Storage is billed dynamically at <strong>1.00 credit per 10MB</strong>.
          </p>
        </div>
      </div>

      {/* Gallery Section with Category Filter */}
      <div className="dash-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 className="dash-section-title" style={{ margin: 0 }}>
            Uploaded Files & Documents ({filteredMedia.length})
          </h2>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`btn-secondary-action ${selectedCategory === 'ALL' ? 'active' : ''}`}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: selectedCategory === 'ALL' ? 'var(--primary)' : 'var(--bg-input)',
                color: selectedCategory === 'ALL' ? '#fff' : 'var(--text-secondary)',
              }}
              onClick={() => setSelectedCategory('ALL')}
            >
              All Files
            </button>
            <button
              className={`btn-secondary-action ${selectedCategory === 'DOCUMENT' ? 'active' : ''}`}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: selectedCategory === 'DOCUMENT' ? 'var(--primary)' : 'var(--bg-input)',
                color: selectedCategory === 'DOCUMENT' ? '#fff' : 'var(--text-secondary)',
              }}
              onClick={() => setSelectedCategory('DOCUMENT')}
            >
              Documents
            </button>
            <button
              className={`btn-secondary-action ${selectedCategory === 'CONTRACT' ? 'active' : ''}`}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: selectedCategory === 'CONTRACT' ? 'var(--primary)' : 'var(--bg-input)',
                color: selectedCategory === 'CONTRACT' ? '#fff' : 'var(--text-secondary)',
              }}
              onClick={() => setSelectedCategory('CONTRACT')}
            >
              Contracts
            </button>
            <button
              className={`btn-secondary-action ${selectedCategory === 'PORTFOLIO_IMAGE' ? 'active' : ''}`}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: selectedCategory === 'PORTFOLIO_IMAGE' ? 'var(--primary)' : 'var(--bg-input)',
                color: selectedCategory === 'PORTFOLIO_IMAGE' ? '#fff' : 'var(--text-secondary)',
              }}
              onClick={() => setSelectedCategory('PORTFOLIO_IMAGE')}
            >
              Portfolio & Media
            </button>
            <button
              className={`btn-secondary-action ${selectedCategory === 'OTHER' ? 'active' : ''}`}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: selectedCategory === 'OTHER' ? 'var(--primary)' : 'var(--bg-input)',
                color: selectedCategory === 'OTHER' ? '#fff' : 'var(--text-secondary)',
              }}
              onClick={() => setSelectedCategory('OTHER')}
            >
              Other
            </button>
          </div>
        </div>

        {/* Media Grid */}
        <div className="media-gallery-grid">
          {filteredMedia.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              No documents or media found in this category.
            </div>
          ) : (
            filteredMedia.map((m) => (
              <div key={m.id} className="media-card">
                <div className="media-card-preview">
                  <img src={m.url} alt={m.file_name} />
                  <span
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0, 0, 0, 0.75)',
                      color: '#fff',
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    {m.file_size_mb.toFixed(1)} MB
                  </span>
                </div>
                <div className="media-card-info">
                  <span className="media-card-title" title={m.file_name}>
                    {m.file_name}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="media-category-chip portfolio">
                      {m.category.replace('_', ' ')}
                    </span>

                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#EF3826' }}>
                      -{m.credits_metered.toFixed(2)} cr
                    </span>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Uploaded {new Date(m.uploaded_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Media Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Upload & Meter Media Storage</h3>
              <button className="modal-close-btn" onClick={() => setShowUploadModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleFileUploadSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    File Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. client_onboarding_agreement.pdf"
                    required
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={fileCategory}
                    onChange={(e) => setFileCategory(e.target.value as MediaFile['category'])}
                  >
                    <option value="DOCUMENT">Business / Client Document</option>
                    <option value="CONTRACT">Service Contract / Agreement</option>
                    <option value="PORTFOLIO_IMAGE">Portfolio / Photo Attachment</option>
                    <option value="OTHER">Other Attachment</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Payload File Size: <strong>{fileSizeMb} MB</strong>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={fileSizeMb}
                    onChange={(e) => setFileSizeMb(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>1 MB</span>
                    <span>25 MB</span>
                    <span>50 MB</span>
                  </div>
                </div>

                {/* Metering Preview Box */}
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Estimated Credit Deduction:
                    </span>
                    <strong style={{ fontSize: '16px', color: '#EF3826' }}>
                      -{estimatedCost.toFixed(2)} cr
                    </strong>
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Formula: ({fileSizeMb}MB ÷ 10MB) × 1.00 cr = {estimatedCost.toFixed(2)} cr
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isUploading || isOutOfCredits}
                >
                  {isUploading ? 'Uploading...' : `Upload & Ingest (-${estimatedCost.toFixed(2)} cr)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPage;
