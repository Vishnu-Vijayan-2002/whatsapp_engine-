import React, { useState } from 'react';
import { useRole } from '../context/RoleContext';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useRole();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dash-app-layout">
      <Sidebar role={role} collapsed={collapsed} />
      <div className="dash-main-area">
        <Header onToggleSidebar={() => setCollapsed(!collapsed)} />
        <main className="dash-content-container">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
