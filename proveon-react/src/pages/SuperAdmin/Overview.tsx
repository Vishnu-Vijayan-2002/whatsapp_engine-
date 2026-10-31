import React from 'react';
import './Overview.css';
import Table from '../../components/Table';
import { mockTenantsTable } from '../../mocks/data';

// Import ChartJS components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const SuperAdminOverview: React.FC = () => {
  // Chart.js configuration for Sales Details graph matching DashStack design
  const chartData = {
    labels: ['5k', '10k', '15k', '20k', '25k', '30k', '35k', '40k', '45k', '50k', '55k', '60k'],
    datasets: [
      {
        fill: true,
        label: 'Sales ($)',
        data: [20, 32, 28, 48, 42, 64.3, 52, 68, 59, 74, 60, 85],
        borderColor: '#4880FF',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 320);
          gradient.addColorStop(0, 'rgba(72, 128, 255, 0.28)');
          gradient.addColorStop(1, 'rgba(72, 128, 255, 0.00)');
          return gradient;
        },
        borderWidth: 3,
        tension: 0.4,
        pointBackgroundColor: '#4880FF',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#4880FF',
        titleFont: { family: 'Nunito', weight: 'bold' },
        bodyFont: { family: 'Nunito' },
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context: any) => `$${context.raw},000.77`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#A0A5BA', font: { family: 'Nunito', size: 12 } },
      },
      y: {
        grid: { color: '#F1F2F7', borderDash: [4, 4] },
        ticks: {
          stepSize: 20,
          callback: (value: any) => `${value}%`,
          color: '#A0A5BA',
          font: { family: 'Nunito', size: 12 },
        },
        min: 0,
        max: 100,
      },
    },
  };

  return (
    <div className="dashstack-overview">
      <div className="dash-page-header">
        <h1 className="dash-page-title">Dashboard</h1>
      </div>

      {/* 4 Top KPI Stat Cards matching screenshot exactly */}
      <section className="dash-kpi-grid">
        {/* Total User */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Total User</span>
              <span className="kpi-number">40,689</span>
            </div>
            <div className="kpi-icon-bubble purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              8.5%
            </span>
            <span className="trend-label">Up from yesterday</span>
          </div>
        </div>

        {/* Total Order */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Total Order</span>
              <span className="kpi-number">10,293</span>
            </div>
            <div className="kpi-icon-bubble yellow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              1.3%
            </span>
            <span className="trend-label">Up from past week</span>
          </div>
        </div>

        {/* Total Sales */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Total Sales</span>
              <span className="kpi-number">$89,000</span>
            </div>
            <div className="kpi-icon-bubble green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat negative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
              4.3%
            </span>
            <span className="trend-label">Down from yesterday</span>
          </div>
        </div>

        {/* Total Pending */}
        <div className="kpi-dash-card">
          <div className="kpi-dash-top">
            <div className="kpi-dash-info">
              <span className="kpi-title">Total Pending</span>
              <span className="kpi-number">2,040</span>
            </div>
            <div className="kpi-icon-bubble orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>
          <div className="kpi-trend">
            <span className="trend-stat positive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              1.8%
            </span>
            <span className="trend-label">Up from yesterday</span>
          </div>
        </div>
      </section>

      {/* Sales Details Chart Section */}
      <section className="dash-card sales-chart-container">
        <div className="chart-header-row">
          <h2 className="dash-section-title">Sales Details</h2>
          <div className="chart-filter-select">
            <select defaultValue="October">
              <option value="October">October</option>
              <option value="November">November</option>
              <option value="December">December</option>
            </select>
          </div>
        </div>

        <div className="chart-canvas-wrapper">
          <Line data={chartData} options={chartOptions} />
        </div>
      </section>

      {/* Deals / Tenants Table Section */}
      <section className="dash-card deals-table-section">
        <div className="deals-header-row">
          <h2 className="dash-section-title">Deals Details</h2>
          <div className="deals-filter-select">
            <select defaultValue="October">
              <option value="October">October</option>
              <option value="September">September</option>
            </select>
          </div>
        </div>

        <Table
          columns={[
            { header: 'Business Name', accessor: 'business' },
            { header: 'Owner / Contact', accessor: 'owner' },
            { header: 'Plan', accessor: 'plan' },
            { header: 'Status', accessor: 'status' },
            { header: 'Users', accessor: 'users' },
            { header: 'Total Revenue', accessor: 'revenue' },
          ]}
          data={mockTenantsTable}
        />
      </section>
    </div>
  );
};

export default SuperAdminOverview;
