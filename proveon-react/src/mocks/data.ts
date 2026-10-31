// src/mocks/data.ts
export const mockKpis = [
  { label: 'Total Tenants', value: '128' },
  { label: 'Active Tenants', value: '112' },
  { label: 'Monthly Recurring Revenue', value: '$45,200' },
  { label: 'Total Revenue', value: '$1.2M' },
  { label: 'Active Subscriptions', value: '115' },
  { label: 'Trial Accounts', value: '8' },
  { label: 'Failed Payments', value: '5' },
];

export const mockRevenueData = [
  { date: '2024-01', mrr: 38000 },
  { date: '2024-02', mrr: 39000 },
  { date: '2024-03', mrr: 41000 },
  { date: '2024-04', mrr: 43000 },
  { date: '2024-05', mrr: 45000 },
];

export const mockTenantGrowth = [
  { month: 'Jan', new: 10, active: 90, churned: 2 },
  { month: 'Feb', new: 12, active: 95, churned: 3 },
  { month: 'Mar', new: 15, active: 108, churned: 4 },
];

export const mockSubscriptionDist = [
  { plan: 'Trial', count: 8 },
  { plan: 'Starter', count: 35 },
  { plan: 'Professional', count: 50 },
  { plan: 'Enterprise', count: 20 },
];

export const mockRecentTenants = [
  { id: 't1', name: 'Nova Dental Clinic', plan: 'Professional', status: 'Active', users: 5, created: '2023-09-12', lastActivity: '2024-09-20' },
  { id: 't2', name: 'Sunrise Salon', plan: 'Starter', status: 'Active', users: 3, created: '2023-10-05', lastActivity: '2024-09-18' },
  { id: 't3', name: 'TechGear Solutions', plan: 'Enterprise', status: 'Suspended', users: 12, created: '2022-07-22', lastActivity: '2024-09-15' },
];

export const mockTenantsTable = [
  { id: 't1', business: 'Nova Dental Clinic', owner: 'Dr. Arjun Menon', plan: 'Professional', status: 'Active', users: 5, created: '2023-09-12', lastActive: '2024-09-20', revenue: '$3,200' },
  { id: 't2', business: 'Sunrise Salon', owner: 'Maria Gomez', plan: 'Starter', status: 'Active', users: 3, created: '2023-10-05', lastActive: '2024-09-18', revenue: '$1,200' },
  { id: 't3', business: 'TechGear Solutions', owner: 'Liam Chen', plan: 'Enterprise', status: 'Suspended', users: 12, created: '2022-07-22', lastActive: '2024-09-15', revenue: '$8,500' },
];

export const mockBusinessKPIs = [
  { label: "Today's Bookings", value: '7' },
  { label: 'Available Slots', value: '14' },
  { label: 'Completed Bookings', value: '45' },
  { label: 'Pending Bookings', value: '3' },
  { label: 'New Customers', value: '5' },
  { label: 'Revenue Today', value: '$350' },
];

export const mockTodaySchedule = [
  { time: '09:00', customer: 'Arjun Menon', service: 'General Consultation', staff: 'Dr. Priya', status: 'Confirmed' },
  { time: '10:30', customer: 'Maria Gomez', service: 'Haircut', staff: 'John', status: 'Pending' },
];
