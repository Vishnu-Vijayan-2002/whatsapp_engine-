import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';

export const SuperAdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="beacon-dot" style={{ width: '12px', height: '12px' }}></div>
          <span style={{ fontSize: '15px', fontWeight: 700 }}>Verifying Super Admin Authorization...</span>
        </div>
      </div>
    );
  }

  // Not authenticated or not super_admin
  if (!currentUser || currentUser.role !== 'super_admin') {
    return <Navigate to="/super-admin/login" state={{ from: location }} replace />;
  }

  return <SuperAdminLayout>{children}</SuperAdminLayout>;
};

export default SuperAdminGuard;

