import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { TenantProvider } from '../../context/TenantContext';
import BusinessAdminLayout from '../../layouts/BusinessAdminLayout';

export const BusinessAdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="beacon-dot" style={{ width: '12px', height: '12px' }}></div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>
            Authenticating Business Portal Access...
          </span>
        </div>
      </div>
    );
  }

  // Not authenticated or not business_admin
  if (!currentUser || currentUser.role !== 'business_admin' || !currentUser.tenant_id) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <TenantProvider>
      <BusinessAdminLayout>{children}</BusinessAdminLayout>
    </TenantProvider>
  );
};

export default BusinessAdminGuard;

