import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import SuperAdminGuard from './components/guards/SuperAdminGuard';
import BusinessAdminGuard from './components/guards/BusinessAdminGuard';

// Auth Pages
import SuperAdminLogin from './pages/Auth/SuperAdminLogin';
import BusinessAdminLogin from './pages/Auth/BusinessAdminLogin';

// Super Admin Pages
import SuperAdminOverview from './pages/SuperAdmin/Overview';
import SuperAdminTenants from './pages/SuperAdmin/Tenants';
import SuperAdminRateCard from './pages/SuperAdmin/RateCard';

// Business Admin Pages
import BusinessDashboard from './pages/BusinessAdmin/Dashboard';
import CustomersPage from './pages/BusinessAdmin/Customers';
import MediaPage from './pages/BusinessAdmin/Media';
import WhatsAppAutomationPage from './pages/BusinessAdmin/WhatsAppAutomation';

const RootRedirect: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="beacon-dot" style={{ width: '12px', height: '12px' }}></div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>Loading Proveon Engine...</span>
        </div>
      </div>
    );
  }

  if (currentUser?.role === 'super_admin') {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (currentUser?.role === 'business_admin') {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. Public Authentication Routes */}
      <Route path="/super-admin/login" element={<SuperAdminLogin />} />
      <Route path="/login" element={<BusinessAdminLogin />} />
      <Route path="/app/login" element={<BusinessAdminLogin />} />

      {/* 2. Isolated Super Admin Routes (Strictly Role: super_admin) */}
      <Route
        path="/super-admin/dashboard"
        element={
          <SuperAdminGuard>
            <SuperAdminOverview />
          </SuperAdminGuard>
        }
      />
      <Route
        path="/super-admin/overview"
        element={<Navigate to="/super-admin/dashboard" replace />}
      />
      <Route
        path="/super-admin/tenants"
        element={
          <SuperAdminGuard>
            <SuperAdminTenants />
          </SuperAdminGuard>
        }
      />
      <Route
        path="/super-admin/rate-card"
        element={
          <SuperAdminGuard>
            <SuperAdminRateCard />
          </SuperAdminGuard>
        }
      />
      <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
      <Route path="/super/*" element={<Navigate to="/super-admin/dashboard" replace />} />

      {/* 3. Isolated Business Admin Routes (Strictly Role: business_admin & tenant_id bound) */}
      <Route
        path="/app/dashboard"
        element={
          <BusinessAdminGuard>
            <BusinessDashboard />
          </BusinessAdminGuard>
        }
      />
      <Route
        path="/app/customers"
        element={
          <BusinessAdminGuard>
            <CustomersPage />
          </BusinessAdminGuard>
        }
      />
      <Route
        path="/app/media"
        element={
          <BusinessAdminGuard>
            <MediaPage />
          </BusinessAdminGuard>
        }
      />
      <Route
        path="/app/whatsapp"
        element={
          <BusinessAdminGuard>
            <WhatsAppAutomationPage />
          </BusinessAdminGuard>
        }
      />
      <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />

      {/* Legacy /admin/* Aliases for Business Portal */}
      <Route
        path="/admin/dashboard"
        element={
          <BusinessAdminGuard>
            <BusinessDashboard />
          </BusinessAdminGuard>
        }
      />
      <Route
        path="/admin/customers"
        element={
          <BusinessAdminGuard>
            <CustomersPage />
          </BusinessAdminGuard>
        }
      />
      <Route
        path="/admin/media"
        element={
          <BusinessAdminGuard>
            <MediaPage />
          </BusinessAdminGuard>
        }
      />
      <Route
        path="/admin/whatsapp"
        element={
          <BusinessAdminGuard>
            <WhatsAppAutomationPage />
          </BusinessAdminGuard>
        }
      />
      <Route path="/admin" element={<Navigate to="/app/dashboard" replace />} />

      {/* Root & Catch-all Fallbacks */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

export default App;
