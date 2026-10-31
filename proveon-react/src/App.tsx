import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import SuperAdminOverview from './pages/SuperAdmin/Overview';
import SuperAdminTenants from './pages/SuperAdmin/Tenants';
import BusinessDashboard from './pages/BusinessAdmin/Dashboard';

import { RoleContext } from './context/RoleContext';
// RoleContext moved to src/context/RoleContext.tsx

const App: React.FC = () => {
  const role: 'super' | 'business' = 'super'; // change to 'business' to test other navigation

  return (
    <RoleContext.Provider value={role}>
      <Router>
        <Layout>
          <Routes>
            {/* Super Admin routes */}
            <Route path="/super/overview" element={<SuperAdminOverview />} />
            <Route path="/super/tenants" element={<SuperAdminTenants />} />
            {/* Business Admin routes */}
            <Route path="/business/dashboard" element={<BusinessDashboard />} />
            {/* Default redirect */}
            <Route path="*" element={<Navigate to={role === 'super' ? '/super/overview' : '/business/dashboard'} replace />} />
          </Routes>
        </Layout>
      </Router>
    </RoleContext.Provider>
  );
};

export default App;

