import React from 'react';
import Table from '../../components/Table';
import { mockBusinessKPIs, mockTodaySchedule } from '../../mocks/data';

const BusinessDashboard: React.FC = () => {
  return (
    <div className="dashstack-overview">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Business Operations Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Live overview of bookings, staff schedules, and automated WhatsApp responses.
          </p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <section className="dash-kpi-grid">
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Today's Bookings</span>
              <span className="kpi-number">{mockBusinessKPIs[0].value}</span>
            </div>
            <div className="kpi-icon-bubble green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">+12%</span>
            <span className="trend-label">vs last Monday</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Completed Today</span>
              <span className="kpi-number">{mockBusinessKPIs[2].value}</span>
            </div>
            <div className="kpi-icon-bubble purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">98%</span>
            <span className="trend-label">Satisfaction rate</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Pending Confirmation</span>
              <span className="kpi-number">{mockBusinessKPIs[3].value}</span>
            </div>
            <div className="kpi-icon-bubble orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat negative">3 items</span>
            <span className="trend-label">Awaiting reply</span>
          </div>
        </div>

        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Revenue Today</span>
              <span className="kpi-number">{mockBusinessKPIs[5].value}</span>
            </div>
            <div className="kpi-icon-bubble yellow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">+8.4%</span>
            <span className="trend-label">Above target</span>
          </div>
        </div>
      </section>

      {/* Schedule Table */}
      <div className="dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="dash-section-title">Today's Appointment Schedule</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Updated 2 mins ago</span>
        </div>

        <Table
          columns={[
            { header: 'Slot Time', accessor: 'time' },
            { header: 'Customer Name', accessor: 'customer' },
            { header: 'Service Requested', accessor: 'service' },
            { header: 'Assigned Staff', accessor: 'staff' },
            { header: 'Status', accessor: 'status' },
          ]}
          data={mockTodaySchedule}
        />
      </div>
    </div>
  );
};

export default BusinessDashboard;
