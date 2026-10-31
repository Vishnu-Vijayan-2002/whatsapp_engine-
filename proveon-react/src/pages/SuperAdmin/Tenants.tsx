import React from 'react';
import Table from '../../components/Table';
import { mockTenantsTable } from '../../mocks/data';

const SuperAdminTenants: React.FC = () => {
  return (
    <div className="dashstack-overview">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Tenant Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Manage registered business tenants, subscription statuses, and WhatsApp engine quotas.
          </p>
        </div>
        <button style={{
          backgroundColor: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add New Tenant
        </button>
      </div>

      <div className="dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="dash-section-title">All Active & Registered Tenants</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Filter tenants..." 
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <Table
          columns={[
            { header: 'Tenant ID', accessor: 'id' },
            { header: 'Business Name', accessor: 'business' },
            { header: 'Account Owner', accessor: 'owner' },
            { header: 'Subscription Plan', accessor: 'plan' },
            { header: 'Status', accessor: 'status' },
            { header: 'Team Seats', accessor: 'users' },
            { header: 'Created Date', accessor: 'created' },
            { header: 'MRR Contribution', accessor: 'revenue' },
          ]}
          data={mockTenantsTable}
        />
      </div>
    </div>
  );
};

export default SuperAdminTenants;
