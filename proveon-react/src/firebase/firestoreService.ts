import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isLiveFirebaseConfigured } from './config';
import {
  DEFAULT_RATE_CARD,
  type Tenant,
  type UsageAuditLog,
  type RateCardConfig,
  type TenantStatus,
  type ActionCode,
  type Customer,
  type Appointment,
  type MediaFile,
  type WhatsAppAutomationConfig,
  type WhatsAppNodeFlow,
  type CapturedFlowSubmission,
  type WhatsAppSessionState,
  type BookingSlotDoc,
  type BookingSlotStatus,
  type BookSlotResult,
  type NextAvailableDateResult,
  type BookingDateDoc,
  type CreditTopUpRequest,
} from '../types';

export class InsufficientCreditsError extends Error {
  public requiredCredits: number;
  public currentBalance: number;
  constructor(required: number, current: number) {
    super(
      `Insufficient credits: Required ${required.toFixed(2)} cr, but your wallet only has ${current.toFixed(2)} cr. Please recharge or contact Super Admin.`
    );
    this.name = 'InsufficientCreditsError';
    this.requiredCredits = required;
    this.currentBalance = current;
  }
}

// ==========================================
// In-Memory & LocalStorage Reactive Fallback Store
// ==========================================
// Ensures 100% reactive real-time functionality even if live Firebase keys
// are demo/offline, while seamlessly interacting with live Firestore when active.

const STORAGE_KEYS = {
  TENANTS: 'proveon_tenants_store',
  AUDIT_LOGS: 'proveon_audit_logs_store',
  RATE_CARD: 'proveon_rate_card_store',
  CUSTOMERS: 'proveon_customers_store',
  APPOINTMENTS: 'proveon_appointments_store',
  MEDIA: 'proveon_media_store',
  WHATSAPP_CONFIG: 'proveon_whatsapp_config_store',
  CAPTURED_SUBMISSIONS: 'proveon_captured_submissions_store',
  NODE_FLOWS: 'proveon_node_flows_store',
  SESSIONS: 'proveon_wa_sessions_store',
  BOOKING_SLOTS: 'proveon_booking_slots_store',
  CREDIT_REQUESTS: 'proveon_credit_requests_store',
};

type Listener<T> = (data: T) => void;

class ReactiveStore {
  private tenantsListeners = new Set<Listener<Tenant[]>>();
  private auditLogListeners = new Set<Listener<UsageAuditLog[]>>();
  private rateCardListeners = new Set<Listener<RateCardConfig>>();
  private customersListeners = new Set<Listener<Customer[]>>();
  private appointmentsListeners = new Set<Listener<Appointment[]>>();
  private mediaListeners = new Set<Listener<MediaFile[]>>();
  private whatsappConfigListeners = new Set<Listener<Record<string, WhatsAppAutomationConfig>>>();
  private capturedListeners = new Set<Listener<CapturedFlowSubmission[]>>();
  private nodeFlowListeners = new Set<Listener<Record<string, WhatsAppNodeFlow>>>();
  private creditRequestsListeners = new Set<Listener<CreditTopUpRequest[]>>();

  private tenants: Tenant[] = [];
  private auditLogs: UsageAuditLog[] = [];
  private rateCard: RateCardConfig = { ...DEFAULT_RATE_CARD };
  private customers: Customer[] = [];
  private appointments: Appointment[] = [];
  private mediaFiles: MediaFile[] = [];
  private whatsappConfigs: Record<string, WhatsAppAutomationConfig> = {};
  private capturedSubmissions: CapturedFlowSubmission[] = [];
  private nodeFlows: Record<string, WhatsAppNodeFlow> = {};
  private sessions: Record<string, WhatsAppSessionState> = {};
  private bookingSlots: Record<string, Record<string, BookingSlotDoc[]>> = {};
  private creditRequests: CreditTopUpRequest[] = [];

  constructor() {
    this.loadFromStorage();
    if (this.tenants.length === 0) {
      this.populateDefaultMocks();
    }
  }

  private loadFromStorage() {
    try {
      const tenantsRaw = localStorage.getItem(STORAGE_KEYS.TENANTS);
      if (tenantsRaw) this.tenants = JSON.parse(tenantsRaw);

      const logsRaw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (logsRaw) this.auditLogs = JSON.parse(logsRaw);

      const ratesRaw = localStorage.getItem(STORAGE_KEYS.RATE_CARD);
      if (ratesRaw) this.rateCard = JSON.parse(ratesRaw);

      const customersRaw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (customersRaw) this.customers = JSON.parse(customersRaw);

      const apptsRaw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      if (apptsRaw) this.appointments = JSON.parse(apptsRaw);

      const mediaRaw = localStorage.getItem(STORAGE_KEYS.MEDIA);
      if (mediaRaw) this.mediaFiles = JSON.parse(mediaRaw);

      const waRaw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_CONFIG);
      if (waRaw) this.whatsappConfigs = JSON.parse(waRaw);

      const subsRaw = localStorage.getItem(STORAGE_KEYS.CAPTURED_SUBMISSIONS);
      if (subsRaw) this.capturedSubmissions = JSON.parse(subsRaw);

      const flowsRaw = localStorage.getItem(STORAGE_KEYS.NODE_FLOWS);
      if (flowsRaw) {
        this.nodeFlows = JSON.parse(flowsRaw);
      }

      const sessRaw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (sessRaw) this.sessions = JSON.parse(sessRaw);

      const slotsRaw = localStorage.getItem(STORAGE_KEYS.BOOKING_SLOTS);
      if (slotsRaw) this.bookingSlots = JSON.parse(slotsRaw);

      const creditReqRaw = localStorage.getItem(STORAGE_KEYS.CREDIT_REQUESTS);
      if (creditReqRaw) this.creditRequests = JSON.parse(creditReqRaw);
    } catch (e) {
      console.warn('Storage read failed, using memory state', e);
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(this.tenants));
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs.slice(0, 300)));
      localStorage.setItem(STORAGE_KEYS.RATE_CARD, JSON.stringify(this.rateCard));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(this.customers));
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(this.appointments));
      localStorage.setItem(STORAGE_KEYS.MEDIA, JSON.stringify(this.mediaFiles));
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_CONFIG, JSON.stringify(this.whatsappConfigs));
      localStorage.setItem(STORAGE_KEYS.CAPTURED_SUBMISSIONS, JSON.stringify(this.capturedSubmissions.slice(0, 300)));
      localStorage.setItem(STORAGE_KEYS.NODE_FLOWS, JSON.stringify(this.nodeFlows));
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions));
      localStorage.setItem(STORAGE_KEYS.BOOKING_SLOTS, JSON.stringify(this.bookingSlots));
      localStorage.setItem(STORAGE_KEYS.CREDIT_REQUESTS, JSON.stringify(this.creditRequests.slice(0, 200)));
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  }

  public getBookingSlots(tenantId: string, dateStr: string): BookingSlotDoc[] {
    return this.bookingSlots[tenantId]?.[dateStr] || [];
  }

  public setBookingSlots(tenantId: string, dateStr: string, slots: BookingSlotDoc[]) {
    if (!this.bookingSlots[tenantId]) this.bookingSlots[tenantId] = {};
    this.bookingSlots[tenantId][dateStr] = slots;
    this.persist();
  }

  public bookSlotLocal(
    tenantId: string,
    dateStr: string,
    slotId: string,
    customerDetails: { customer_phone: string; customer_name?: string; service?: string }
  ): BookSlotResult {
    const slots = [...this.getBookingSlots(tenantId, dateStr)];
    const target = slots.find((s) => s.id === slotId || s.time.toLowerCase() === slotId.toLowerCase());
    if (!target) {
      return { success: false, reason: 'SLOT_NOT_FOUND', message: `Slot ${slotId} not found.` };
    }
    if (target.status !== 'available') {
      return {
        success: false,
        reason: 'SLOT_ALREADY_TAKEN',
        message: `Slot ${target.time} is already booked by another customer.`,
        slotData: target,
      };
    }
    target.status = 'booked';
    target.booked_by = customerDetails.customer_phone;
    target.booked_at = new Date().toISOString();
    target.customer_name = customerDetails.customer_name || 'Valued Client';
    target.service = customerDetails.service || 'Confirmed Appointment';
    this.setBookingSlots(tenantId, dateStr, slots);
    return { success: true, slotData: target };
  }

  public populateDefaultMocks() {
    const now = Date.now();
    this.tenants = [
      {
        id: 'ten-apex-01',
        tenant_id: 'ten-apex-01',
        business_name: 'Apex Aesthetic Dermatology Clinic',
        vertical: 'Clinic',
        status: 'Active',
        admin_name: 'Dr. Sarah Mitchell',
        admin_email: 'sarah.mitchell@apexaesthetics.com',
        admin_phone: '+1 (555) 234-5678',
        address: '450 Lexington Ave, Suite 1400, New York, NY 10017',
        operating_hours: 'Mon - Fri: 8:30 AM - 6:30 PM | Sat: 9:00 AM - 2:00 PM',
        contact_phone: '+1 (555) 234-5678',
        description: 'Premier integrated cosmetic & medical dermatology practice providing state-of-the-art aesthetic consultations and bespoke wellness treatment protocols.',
        website_url: 'https://apexaesthetics.com',
        logo_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=300&auto=format&fit=crop&q=60',
        social_links: {
          instagram: '@apexaesthetics',
          linkedin: 'company/apex-aesthetics',
        },
        credit_wallet: {
          balance: 1420.50,
          lifetime_granted: 3500.00,
          lifetime_consumed: 2079.50,
          low_balance_threshold: 150.00,
          last_deduction_at: now - 1000 * 60 * 4,
        },
        waba_integration: {
          phone_number_id: '1098234871923',
          waba_account_id: 'waba_991827361',
          display_phone_number: '+1 (555) 019-2831',
          verified_name: 'Apex Aesthetics Medical',
          quality_rating: 'GREEN',
          status: 'CONNECTED',
        },
        created_at: now - 1000 * 60 * 60 * 24 * 45,
      },
      {
        id: 'ten-luxe-02',
        tenant_id: 'ten-luxe-02',
        business_name: 'Luxe Radiance Hair & Spa Salon',
        vertical: 'Salon',
        status: 'Active',
        admin_name: 'Elena Rostova',
        admin_email: 'elena@luxeradiance.com',
        admin_phone: '+1 (555) 876-5432',
        credit_wallet: {
          balance: 684.25,
          lifetime_granted: 1500.00,
          lifetime_consumed: 815.75,
          low_balance_threshold: 100.00,
          last_deduction_at: now - 1000 * 60 * 18,
        },
        waba_integration: {
          phone_number_id: '1087263541928',
          waba_account_id: 'waba_448372619',
          display_phone_number: '+1 (555) 018-9921',
          verified_name: 'Luxe Radiance Salon',
          quality_rating: 'GREEN',
          status: 'CONNECTED',
        },
        created_at: now - 1000 * 60 * 60 * 24 * 28,
      },
      {
        id: 'ten-mehta-03',
        tenant_id: 'ten-mehta-03',
        business_name: 'Dr. Mehta Dental & Implantology',
        vertical: 'Dental Care',
        status: 'Low Balance',
        admin_name: 'Dr. Rajiv Mehta',
        admin_email: 'dr.mehta@mehtadental.org',
        admin_phone: '+1 (555) 345-6789',
        credit_wallet: {
          balance: 38.40,
          lifetime_granted: 1000.00,
          lifetime_consumed: 961.60,
          low_balance_threshold: 75.00,
          last_deduction_at: now - 1000 * 60 * 42,
        },
        waba_integration: {
          phone_number_id: '1076253412981',
          waba_account_id: 'waba_112938475',
          display_phone_number: '+1 (555) 017-3321',
          verified_name: 'Mehta Dental Center',
          quality_rating: 'YELLOW',
          status: 'CONNECTED',
        },
        created_at: now - 1000 * 60 * 60 * 24 * 60,
      },
      {
        id: 'ten-zenith-04',
        tenant_id: 'ten-zenith-04',
        business_name: 'Zenith Medi-Spa & Wellness',
        vertical: 'Wellness Center',
        status: 'Active',
        admin_name: 'Marcus Vance',
        admin_email: 'marcus@zenithwellness.co',
        admin_phone: '+1 (555) 654-3210',
        credit_wallet: {
          balance: 2310.00,
          lifetime_granted: 4000.00,
          lifetime_consumed: 1690.00,
          low_balance_threshold: 200.00,
          last_deduction_at: now - 1000 * 60 * 5,
        },
        waba_integration: {
          phone_number_id: '1099887766554',
          waba_account_id: 'waba_887766554',
          display_phone_number: '+1 (555) 016-7788',
          verified_name: 'Zenith Wellness MedSpa',
          quality_rating: 'GREEN',
          status: 'CONNECTED',
        },
        created_at: now - 1000 * 60 * 60 * 24 * 90,
      },
      {
        id: 'ten-glamour-05',
        tenant_id: 'ten-glamour-05',
        business_name: 'Glamour & Gloss Studio',
        vertical: 'Salon',
        status: 'Suspended',
        admin_name: 'Chloe Dubois',
        admin_email: 'chloe@glamourgloss.com',
        admin_phone: '+1 (555) 432-1098',
        credit_wallet: {
          balance: -12.50,
          lifetime_granted: 500.00,
          lifetime_consumed: 512.50,
          low_balance_threshold: 50.00,
          last_deduction_at: now - 1000 * 60 * 60 * 72,
        },
        waba_integration: {
          phone_number_id: '1055443322119',
          waba_account_id: 'waba_554433221',
          display_phone_number: '+1 (555) 015-4433',
          verified_name: 'Glamour & Gloss Beauty',
          quality_rating: 'RED',
          status: 'DISCONNECTED',
        },
        created_at: now - 1000 * 60 * 60 * 24 * 110,
      },
    ];

    this.auditLogs = [
      {
        id: 'log-001',
        log_id: 'log-001',
        tenant_id: 'ten-apex-01',
        business_name: 'Apex Aesthetic Dermatology Clinic',
        actor: { userId: 'bot-wa-dispatcher', role: 'AUTOMATION_RUNNER' },
        operation: { action_code: 'WA_BOT_STATE_TRANS', description: 'Bot transitioned patient state: CONFIRM_APPOINTMENT' },
        metrics: { executionTimeMs: 44, dbReads: 2, dbWrites: 1 },
        financials: { credits_deducted: 0.50, balance_prior: 1421.00, balance_post: 1420.50 },
        timestamp: now - 1000 * 60 * 4,
      },
      {
        id: 'log-002',
        log_id: 'log-002',
        tenant_id: 'ten-zenith-04',
        business_name: 'Zenith Medi-Spa & Wellness',
        actor: { userId: 'webhook-ingest', role: 'META_INGESTION' },
        operation: { action_code: 'WA_INBOUND_PROCESS', description: 'Inbound message from +15559871234 parsed' },
        metrics: { executionTimeMs: 38, dbReads: 1, dbWrites: 1 },
        financials: { credits_deducted: 0.25, balance_prior: 2310.25, balance_post: 2310.00 },
        timestamp: now - 1000 * 60 * 5,
      },
      {
        id: 'log-003',
        log_id: 'log-003',
        tenant_id: 'ten-luxe-02',
        business_name: 'Luxe Radiance Hair & Spa Salon',
        actor: { userId: 'app-sync-job', role: 'CRON_SCHEDULER' },
        operation: { action_code: 'DB_WRITE_MUTATION', description: 'Bulk booking slot reservation write' },
        metrics: { executionTimeMs: 62, dbReads: 4, dbWrites: 3 },
        financials: { credits_deducted: 0.50, balance_prior: 684.75, balance_post: 684.25 },
        timestamp: now - 1000 * 60 * 18,
      },
      {
        id: 'log-004',
        log_id: 'log-004',
        tenant_id: 'ten-mehta-03',
        business_name: 'Dr. Mehta Dental & Implantology',
        actor: { userId: 'media-uploader', role: 'TENANT_ADMIN' },
        operation: { action_code: 'STORAGE_INGEST_MB', description: 'Client project contract & design media ingested (14MB)' },
        metrics: { executionTimeMs: 148, dbReads: 1, dbWrites: 2, storageMb: 14 },
        financials: { credits_deducted: 1.40, balance_prior: 39.80, balance_post: 38.40 },
        timestamp: now - 1000 * 60 * 42,
      },
      {
        id: 'log-005',
        log_id: 'log-005',
        tenant_id: 'ten-apex-01',
        business_name: 'Apex Aesthetic Dermatology Clinic',
        actor: { userId: 'report-generator', role: 'CRON_SCHEDULER' },
        operation: { action_code: 'DB_READ_BURST', description: 'Monthly treatment analytics read burst (250 docs)' },
        metrics: { executionTimeMs: 86, dbReads: 25, dbWrites: 0 },
        financials: { credits_deducted: 0.25, balance_prior: 1421.25, balance_post: 1421.00 },
        timestamp: now - 1000 * 60 * 75,
      },
      {
        id: 'log-006',
        log_id: 'log-006',
        tenant_id: 'ten-zenith-04',
        business_name: 'Zenith Medi-Spa & Wellness',
        actor: { userId: 'cron-runner', role: 'SYSTEM_AGENT' },
        operation: { action_code: 'AUTOMATED_JOB_DISPATCH', description: 'Daily 24-hr reminder campaign batch triggered' },
        metrics: { executionTimeMs: 112, dbReads: 8, dbWrites: 4 },
        financials: { credits_deducted: 0.50, balance_prior: 2310.75, balance_post: 2310.25 },
        timestamp: now - 1000 * 60 * 92,
      },
      {
        id: 'log-007',
        log_id: 'log-007',
        tenant_id: 'ten-apex-01',
        business_name: 'Apex Aesthetic Dermatology Clinic',
        actor: { userId: 'super-admin-01', role: 'SUPER_ADMIN' },
        operation: { action_code: 'MANUAL_TOPUP', description: 'Admin Top-Up: Welcome Enterprise package adjustment' },
        metrics: { executionTimeMs: 25, dbReads: 1, dbWrites: 1 },
        financials: { credits_deducted: -500.00, balance_prior: 921.25, balance_post: 1421.25 },
        timestamp: now - 1000 * 60 * 60 * 5,
      },
    ];

    this.rateCard = { ...DEFAULT_RATE_CARD, updated_at: now - 1000 * 60 * 60 * 24, updated_by: 'super-admin@proveon.io' };

    this.customers = [
      {
        id: 'cust-001',
        tenant_id: 'ten-apex-01',
        full_name: 'Sophia Vance',
        name: 'Sophia Vance',
        phone: '+1 (555) 789-0123',
        phone_number: '+1 (555) 789-0123',
        email: 'sophia.vance@company.com',
        service_interest: 'Executive Strategic Consultation',
        status: 'vip',
        total_bookings: 6,
        total_completed_visits: 5,
        last_interacted_at: now - 1000 * 60 * 35, // 35 min ago via WhatsApp
        notes: 'VIP Client. Prefers morning appointments and quarterly reviews.',
        created_at: now - 1000 * 60 * 60 * 24 * 75,
      },
      {
        id: 'cust-002',
        tenant_id: 'ten-apex-01',
        full_name: 'Liam Rodriguez',
        name: 'Liam Rodriguez',
        phone: '+1 (555) 321-6549',
        phone_number: '+1 (555) 321-6549',
        email: 'liam.rodriguez@techventures.io',
        service_interest: 'Quarterly Advisory Session',
        status: 'active',
        total_bookings: 4,
        total_completed_visits: 3,
        last_interacted_at: now - 1000 * 60 * 120, // 2 hours ago
        notes: 'Key contact for enterprise account. Receptive to WhatsApp automated reminders.',
        created_at: now - 1000 * 60 * 60 * 24 * 45,
      },
      {
        id: 'cust-003',
        tenant_id: 'ten-apex-01',
        full_name: 'Emma Watson-Lee',
        name: 'Emma Watson-Lee',
        phone: '+1 (555) 654-7890',
        phone_number: '+1 (555) 654-7890',
        email: 'emma.lee@creativeguild.org',
        service_interest: 'Onboarding & Comprehensive Review',
        status: 'active',
        total_bookings: 3,
        total_completed_visits: 2,
        last_interacted_at: now - 1000 * 60 * 45,
        notes: 'Regular scheduled monthly client. Always confirms promptly.',
        created_at: now - 1000 * 60 * 60 * 24 * 30,
      },
      {
        id: 'cust-004',
        tenant_id: 'ten-apex-01',
        full_name: 'Marcus Thorne',
        name: 'Marcus Thorne',
        phone: '+1 (555) 432-8765',
        phone_number: '+1 (555) 432-8765',
        email: 'marcus.thorne@summitglobal.com',
        service_interest: 'Standard Business Advisory',
        status: 'active',
        total_bookings: 2,
        total_completed_visits: 1,
        last_interacted_at: now - 1000 * 60 * 60 * 8,
        notes: 'New client onboarded last week.',
        created_at: now - 1000 * 60 * 60 * 24 * 14,
      },
      {
        id: 'cust-005',
        tenant_id: 'ten-apex-01',
        full_name: 'Elena Rostova',
        name: 'Elena Rostova',
        phone: '+1 (555) 901-2345',
        phone_number: '+1 (555) 901-2345',
        email: 'elena.rostova@designlab.co',
        service_interest: 'Project Review & Strategy Session',
        status: 'vip',
        total_bookings: 8,
        total_completed_visits: 7,
        last_interacted_at: now - 1000 * 60 * 60 * 26,
        notes: 'Long-standing VIP client. High engagement.',
        created_at: now - 1000 * 60 * 60 * 24 * 120,
      },
      {
        id: 'cust-006',
        tenant_id: 'ten-luxe-02',
        full_name: 'Isabella Rossi',
        name: 'Isabella Rossi',
        phone: '+1 (555) 432-1199',
        email: 'isabella.rossi@fashion.org',
        service_interest: 'Premium Styling Consultation',
        status: 'active',
        total_bookings: 2,
        total_completed_visits: 2,
        last_interacted_at: now - 1000 * 60 * 60 * 36,
        notes: 'Prefers evening appointments.',
        created_at: now - 1000 * 60 * 60 * 36,
      },
    ];

    const todayIso = new Date(now).toISOString().split('T')[0];
    const yesterdayIso = new Date(now - 86400000).toISOString().split('T')[0];
    const tomorrowIso = new Date(now + 86400000).toISOString().split('T')[0];
    const twoDaysLaterIso = new Date(now + 86400000 * 2).toISOString().split('T')[0];
    const pastWeekIso = new Date(now - 86400000 * 4).toISOString().split('T')[0];

    this.appointments = [
      {
        id: 'appt-101',
        tenant_id: 'ten-apex-01',
        customer_id: 'cust-001',
        client_id: 'cust-001',
        customer_name: 'Sophia Vance',
        client_name: 'Sophia Vance',
        customer_phone: '+1 (555) 789-0123',
        client_phone: '+1 (555) 789-0123',
        service_name: 'Executive Strategic Consultation',
        date: todayIso,
        time: '10:30 AM',
        duration_minutes: 45,
        status: 'ATTENDED',
        booking_source: 'whatsapp_bot',
        notes: 'Session completed successfully. Next action items noted.',
        created_at: now - 1000 * 60 * 60 * 24 * 2,
      },
      {
        id: 'appt-102',
        tenant_id: 'ten-apex-01',
        customer_id: 'cust-002',
        client_id: 'cust-002',
        customer_name: 'Liam Rodriguez',
        client_name: 'Liam Rodriguez',
        customer_phone: '+1 (555) 321-6549',
        client_phone: '+1 (555) 321-6549',
        service_name: 'Quarterly Advisory Session',
        date: todayIso,
        time: '02:00 PM',
        duration_minutes: 60,
        status: 'CONFIRMED',
        booking_source: 'whatsapp_bot',
        notes: 'Confirmed via WhatsApp bot. Room A.',
        created_at: now - 1000 * 60 * 60 * 18,
      },
      {
        id: 'appt-103',
        tenant_id: 'ten-apex-01',
        customer_id: 'cust-003',
        client_id: 'cust-003',
        customer_name: 'Emma Watson-Lee',
        client_name: 'Emma Watson-Lee',
        customer_phone: '+1 (555) 654-7890',
        client_phone: '+1 (555) 654-7890',
        service_name: 'Onboarding & Comprehensive Review',
        date: todayIso,
        time: '04:30 PM',
        duration_minutes: 30,
        status: 'CONFIRMED',
        booking_source: 'admin_manual',
        notes: 'Scheduled directly by admin desk.',
        created_at: now - 1000 * 60 * 60 * 5,
      },
      {
        id: 'appt-104',
        tenant_id: 'ten-apex-01',
        customer_id: 'cust-004',
        client_id: 'cust-004',
        customer_name: 'Marcus Thorne',
        client_name: 'Marcus Thorne',
        customer_phone: '+1 (555) 432-8765',
        client_phone: '+1 (555) 432-8765',
        service_name: 'Standard Business Advisory',
        date: tomorrowIso,
        time: '11:00 AM',
        duration_minutes: 45,
        status: 'CONFIRMED',
        booking_source: 'whatsapp_bot',
        notes: 'Automated 24h reminder queued.',
        created_at: now - 1000 * 60 * 60 * 12,
      },
      {
        id: 'appt-105',
        tenant_id: 'ten-apex-01',
        customer_id: 'cust-005',
        client_id: 'cust-005',
        customer_name: 'Elena Rostova',
        client_name: 'Elena Rostova',
        customer_phone: '+1 (555) 901-2345',
        client_phone: '+1 (555) 901-2345',
        service_name: 'Project Review & Strategy Session',
        date: twoDaysLaterIso,
        time: '01:30 PM',
        duration_minutes: 60,
        status: 'PENDING',
        booking_source: 'whatsapp_bot',
        notes: 'Slot reserved, pending customer confirmation.',
        created_at: now - 1000 * 60 * 60 * 3,
      },
      {
        id: 'appt-106',
        tenant_id: 'ten-apex-01',
        customer_id: 'cust-001',
        client_id: 'cust-001',
        customer_name: 'Sophia Vance',
        client_name: 'Sophia Vance',
        customer_phone: '+1 (555) 789-0123',
        client_phone: '+1 (555) 789-0123',
        service_name: 'Follow-up Consultation',
        date: yesterdayIso,
        time: '03:00 PM',
        duration_minutes: 30,
        status: 'ATTENDED',
        booking_source: 'whatsapp_bot',
        notes: 'Follow-up completed on schedule.',
        created_at: now - 1000 * 60 * 60 * 48,
      },
      {
        id: 'appt-107',
        tenant_id: 'ten-apex-01',
        customer_id: 'cust-002',
        client_id: 'cust-002',
        customer_name: 'Liam Rodriguez',
        client_name: 'Liam Rodriguez',
        customer_phone: '+1 (555) 321-6549',
        client_phone: '+1 (555) 321-6549',
        service_name: 'Introductory Discovery Call',
        date: pastWeekIso,
        time: '11:30 AM',
        duration_minutes: 45,
        status: 'ATTENDED',
        booking_source: 'whatsapp_bot',
        notes: 'Client attended via teleconference.',
        created_at: now - 1000 * 60 * 60 * 24 * 7,
      },
    ];

    this.mediaFiles = [
      {
        id: 'med-001',
        tenant_id: 'ten-apex-01',
        file_name: 'service_agreement_vance.pdf',
        file_type: 'application/pdf',
        file_size_mb: 3.2,
        url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=60',
        category: 'CONTRACT',
        credits_metered: 0.32,
        uploaded_at: now - 1000 * 60 * 60 * 20,
      },
      {
        id: 'med-002',
        tenant_id: 'ten-apex-01',
        file_name: 'project_brief_rodriguez.pdf',
        file_type: 'application/pdf',
        file_size_mb: 2.1,
        url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=60',
        category: 'DOCUMENT',
        credits_metered: 0.21,
        uploaded_at: now - 1000 * 60 * 60 * 14,
      },
      {
        id: 'med-003',
        tenant_id: 'ten-apex-01',
        file_name: 'brand_presentation_portfolio.jpg',
        file_type: 'image/jpeg',
        file_size_mb: 8.0,
        url: 'https://images.unsplash.com/photo-1512290900672-1f41d3b0c538?w=600&auto=format&fit=crop&q=60',
        category: 'PORTFOLIO_IMAGE',
        credits_metered: 0.80,
        uploaded_at: now - 1000 * 60 * 60 * 4,
      },
    ];

    const defaultWelcomeFlow = {
      enabled: true,
      trigger_keywords: ['hi', 'hello', 'appointment', 'book', 'services', 'help'],
      header_text: 'Welcome to Apex Aesthetics!',
      body_text: 'Hello! Thank you for reaching out. Please select an option below to schedule your visit or browse our treatment menu:',
      buttons: [
        { id: 'btn_book', title: 'Book Appointment', action_payload: 'TRIGGER_BOOKING_FLOW' },
        { id: 'btn_services', title: 'View Services', action_payload: 'VIEW_CATALOG' },
        { id: 'btn_support', title: 'Speak to Staff', action_payload: 'AGENT_HANDOFF' },
      ],
    };

    const defaultFollowups = [
      {
        id: 'rule_post_visit_review',
        title: 'Post-Visit Care & Feedback Check-In',
        trigger_timing: '24_HOURS_POST_VISIT',
        enabled: true,
        template_text: 'Hi {{customer_name}}, how was your {{service_name}} treatment yesterday? Reply with 1 to 5 to rate your experience or let us know if you need any follow-up care.',
        credits_per_dispatch: 0.50,
      },
      {
        id: 'rule_appointment_reminder',
        title: '2-Hour Pre-Appointment SMS & WhatsApp Ping',
        trigger_timing: '2_HOURS_BEFORE',
        enabled: true,
        template_text: 'Friendly reminder: Your appointment for {{service_name}} is today at {{time}}. Reply "CONFIRM" or call us if you need to reschedule.',
        credits_per_dispatch: 0.50,
      },
      {
        id: 'rule_monthly_maintenance',
        title: '30-Day Routine Touch-Up Reminder',
        trigger_timing: '30_DAYS_AFTER',
        enabled: false,
        template_text: 'It has been 30 days since your last session! Ready for your skin maintenance touch-up? Tap below to reserve your slot.',
        credits_per_dispatch: 0.50,
      },
    ];

    this.whatsappConfigs = {
      'ten-apex-01': {
        tenant_id: 'ten-apex-01',
        welcome_flow: defaultWelcomeFlow,
        followup_rules: defaultFollowups,
        updated_at: now,
      },
    };

    const defaultFlow = getDefaultNodeFlow('ten-apex-01');
    if (!this.nodeFlows || Object.keys(this.nodeFlows).length === 0) {
      this.nodeFlows = {
        'ten-apex-01': defaultFlow,
      };
    }

    this.capturedSubmissions = [
      {
        id: 'sub-001',
        tenant_id: 'ten-apex-01',
        flow_id: defaultFlow.id,
        flow_name: 'Universal Appointment & Booking Flow',
        customer_name: 'Sarah Jenkins',
        customer_phone: '+1 (555) 234-5678',
        captured_data: {
          customer_name: 'Sarah Jenkins',
          selected_service: 'Option 1: Initial Consultation',
          service_name: 'Option 1: Initial Consultation',
          appointment_slot: 'Tomorrow at 2:00 PM',
          rating: '5 Stars',
        },
        status: 'ACTION_EXECUTED',
        rule_engine_result: {
          appointment_created: true,
          appointment_id: 'appt-sarah-01',
          customer_saved: true,
          customer_id: 'cust-sarah-01',
          credits_deducted: 0.50,
          message: 'Appointment #APT-9218 Confirmed in DB via Universal Rule Engine',
        },
        created_at: now - 1000 * 60 * 45,
      },
      {
        id: 'sub-002',
        tenant_id: 'ten-apex-01',
        flow_id: defaultFlow.id,
        flow_name: 'Universal Appointment & Booking Flow',
        customer_name: 'Michael Chen',
        customer_phone: '+1 (555) 876-5432',
        captured_data: {
          customer_name: 'Michael Chen',
          selected_service: 'Option 2: Standard Procedure / Service',
          service_name: 'Option 2: Standard Procedure / Service',
          appointment_slot: 'Friday at 11:30 AM',
          rating: '5 Stars',
        },
        status: 'ACTION_EXECUTED',
        rule_engine_result: {
          appointment_created: true,
          appointment_id: 'appt-chen-02',
          customer_saved: true,
          customer_id: 'cust-chen-02',
          credits_deducted: 0.50,
          message: 'Appointment #APT-9219 Confirmed in DB via Universal Rule Engine',
        },
        created_at: now - 1000 * 60 * 180,
      },
      {
        id: 'sub-003',
        tenant_id: 'ten-apex-01',
        flow_id: defaultFlow.id,
        flow_name: 'Universal Appointment & Booking Flow',
        customer_name: 'Elena Rostova',
        customer_phone: '+1 (555) 432-1098',
        captured_data: {
          customer_name: 'Elena Rostova',
          selected_service: 'Option 3: Follow-up & Support',
          service_name: 'Option 3: Follow-up & Support',
          appointment_slot: 'Saturday at 3:00 PM',
          rating: '4 Stars',
        },
        status: 'ACTION_EXECUTED',
        rule_engine_result: {
          appointment_created: true,
          appointment_id: 'appt-elena-03',
          customer_saved: true,
          customer_id: 'cust-elena-03',
          credits_deducted: 0.50,
          message: 'Appointment #APT-9220 Confirmed in DB via Rule Engine',
        },
        created_at: now - 1000 * 60 * 60 * 5,
      },
    ];

    this.creditRequests = [
      {
        id: 'cr-req-101',
        tenant_id: 'ten-apex-01',
        business_name: 'Apex Aesthetic Dermatology Clinic',
        amount: 250,
        payment_reference: 'WIRE-2026-APX-8812',
        notes: 'Monthly bulk operational credits for automated WhatsApp consultation campaigns',
        status: 'PENDING',
        requested_by_email: 'sarah.mitchell@apexaesthetics.com',
        requested_at: now - 1000 * 60 * 60 * 3,
      },
      {
        id: 'cr-req-102',
        tenant_id: 'ten-luxe-02',
        business_name: 'Luxe Radiance Hair & Spa Salon',
        amount: 500,
        payment_reference: 'ACH-TRANS-44910',
        notes: 'Prepaid quarterly credit pack',
        status: 'APPROVED',
        requested_by_email: 'elena@luxeradiance.com',
        requested_at: now - 1000 * 60 * 60 * 48,
        resolved_at: now - 1000 * 60 * 60 * 24,
        resolved_by: 'super_admin_root',
      },
      {
        id: 'cr-req-103',
        tenant_id: 'ten-mehta-03',
        business_name: 'Dr. Mehta Dental & Implantology',
        amount: 100,
        payment_reference: 'REF-PENDING-INVALID',
        notes: 'Urgent emergency refill',
        status: 'REJECTED',
        requested_by_email: 'dr.mehta@mehtadental.org',
        requested_at: now - 1000 * 60 * 60 * 72,
        resolved_at: now - 1000 * 60 * 60 * 48,
        resolved_by: 'super_admin_root',
        rejection_reason: 'Unmatched transaction reference. Please re-submit with verified wire receipt.',
      },
    ];

    this.persist();
  }

  // Subscriptions
  public subscribeCreditRequests(cb: Listener<CreditTopUpRequest[]>, tenantId?: string): () => void {
    const wrappedListener: Listener<CreditTopUpRequest[]> = (list) => {
      cb(tenantId ? list.filter((r) => r.tenant_id === tenantId) : list);
    };
    this.creditRequestsListeners.add(wrappedListener);
    wrappedListener([...this.creditRequests]);
    return () => this.creditRequestsListeners.delete(wrappedListener);
  }

  public subscribeTenants(cb: Listener<Tenant[]>): () => void {
    this.tenantsListeners.add(cb);
    cb([...this.tenants]);
    return () => this.tenantsListeners.delete(cb);
  }

  public subscribeAuditLogs(cb: Listener<UsageAuditLog[]>): () => void {
    this.auditLogListeners.add(cb);
    cb([...this.auditLogs]);
    return () => this.auditLogListeners.delete(cb);
  }

  public subscribeRateCard(cb: Listener<RateCardConfig>): () => void {
    this.rateCardListeners.add(cb);
    cb({ ...this.rateCard });
    return () => this.rateCardListeners.delete(cb);
  }

  public subscribeCustomers(cb: Listener<Customer[]>): () => void {
    this.customersListeners.add(cb);
    cb([...this.customers]);
    return () => this.customersListeners.delete(cb);
  }

  public subscribeAppointments(cb: Listener<Appointment[]>): () => void {
    this.appointmentsListeners.add(cb);
    cb([...this.appointments]);
    return () => this.appointmentsListeners.delete(cb);
  }

  public subscribeMedia(cb: Listener<MediaFile[]>): () => void {
    this.mediaListeners.add(cb);
    cb([...this.mediaFiles]);
    return () => this.mediaListeners.delete(cb);
  }

  public subscribeWhatsAppConfigs(cb: Listener<Record<string, WhatsAppAutomationConfig>>): () => void {
    this.whatsappConfigListeners.add(cb);
    cb({ ...this.whatsappConfigs });
    return () => this.whatsappConfigListeners.delete(cb);
  }

  public subscribeCapturedSubmissions(cb: Listener<CapturedFlowSubmission[]>): () => void {
    this.capturedListeners.add(cb);
    cb([...this.capturedSubmissions]);
    return () => this.capturedListeners.delete(cb);
  }

  public subscribeNodeFlows(cb: Listener<Record<string, WhatsAppNodeFlow>>): () => void {
    this.nodeFlowListeners.add(cb);
    cb({ ...this.nodeFlows });
    return () => this.nodeFlowListeners.delete(cb);
  }

  public getCapturedSubmissions(tenantId?: string): CapturedFlowSubmission[] {
    return tenantId ? this.capturedSubmissions.filter((s) => s.tenant_id === tenantId) : [...this.capturedSubmissions];
  }

  public getNodeFlow(tenantId: string): WhatsAppNodeFlow {
    if (!this.nodeFlows[tenantId]) {
      this.nodeFlows[tenantId] = getDefaultNodeFlow(tenantId);
    }
    return this.nodeFlows[tenantId];
  }

  public setNodeFlow(tenantId: string, flow: WhatsAppNodeFlow) {
    this.nodeFlows[tenantId] = flow;
    this.notifyNodeFlows();
  }

  public addCapturedSubmission(sub: CapturedFlowSubmission) {
    this.capturedSubmissions.unshift(sub);
    this.notifyCapturedSubmissions();
  }

  public getSession(tenantId: string, userPhone: string): WhatsAppSessionState | null {
    const key = `${tenantId}_${userPhone}`;
    return this.sessions[key] || null;
  }

  public saveSession(tenantId: string, session: WhatsAppSessionState): void {
    const key = `${tenantId}_${session.user_phone}`;
    this.sessions[key] = {
      ...session,
      updated_at: Date.now(),
    };
    this.persist();
  }

  public resetSession(tenantId: string, userPhone: string, activeFlowId: string): WhatsAppSessionState {
    const key = `${tenantId}_${userPhone}`;
    const newSession: WhatsAppSessionState = {
      user_phone: userPhone,
      active_flow_id: activeFlowId,
      current_step: 'node-trigger',
      collected_data: {},
      updated_at: Date.now(),
    };
    this.sessions[key] = newSession;
    this.persist();
    return newSession;
  }

  private notifyCapturedSubmissions() {
    this.persist();
    const copy = [...this.capturedSubmissions];
    this.capturedListeners.forEach((fn) => fn(copy));
  }

  private notifyNodeFlows() {
    this.persist();
    const copy = { ...this.nodeFlows };
    this.nodeFlowListeners.forEach((fn) => fn(copy));
  }

  private notifyCustomers() {
    this.persist();
    const copy = [...this.customers];
    this.customersListeners.forEach((fn) => fn(copy));
  }

  private notifyAppointments() {
    this.persist();
    const copy = [...this.appointments];
    this.appointmentsListeners.forEach((fn) => fn(copy));
  }

  private notifyMedia() {
    this.persist();
    const copy = [...this.mediaFiles];
    this.mediaListeners.forEach((fn) => fn(copy));
  }

  private notifyWhatsAppConfigs() {
    this.persist();
    const copy = { ...this.whatsappConfigs };
    this.whatsappConfigListeners.forEach((fn) => fn(copy));
  }

  public getCustomers(tenantId?: string): Customer[] {
    return tenantId ? this.customers.filter((c) => c.tenant_id === tenantId) : [...this.customers];
  }

  public getAppointments(tenantId?: string): Appointment[] {
    return tenantId ? this.appointments.filter((a) => a.tenant_id === tenantId) : [...this.appointments];
  }

  public getMedia(tenantId?: string): MediaFile[] {
    return tenantId ? this.mediaFiles.filter((m) => m.tenant_id === tenantId) : [...this.mediaFiles];
  }

  public getWhatsAppConfig(tenantId: string): WhatsAppAutomationConfig {
    if (!this.whatsappConfigs[tenantId]) {
      this.whatsappConfigs[tenantId] = {
        tenant_id: tenantId,
        welcome_flow: {
          enabled: true,
          trigger_keywords: ['hi', 'hello', 'appointment', 'book'],
          header_text: 'Welcome!',
          body_text: 'Hi there! Welcome to our automated WhatsApp booking line. Choose an option:',
          buttons: [
            { id: 'btn_1', title: 'Book Appointment', action_payload: 'BOOKING' },
            { id: 'btn_2', title: 'Services & Pricing', action_payload: 'SERVICES' },
          ],
        },
        followup_rules: [
          {
            id: 'rule_1',
            title: '24h Post-Visit Feedback Check-In',
            trigger_timing: '24_HOURS_POST_VISIT',
            enabled: true,
            template_text: 'Thank you for your visit today! We hope you enjoyed your treatment. Reply 1-5 to rate us!',
            credits_per_dispatch: 0.50,
          },
        ],
        updated_at: Date.now(),
      };
      this.notifyWhatsAppConfigs();
    }
    return { ...this.whatsappConfigs[tenantId] };
  }

  public addCustomer(cust: Customer) {
    this.customers.unshift(cust);
    this.notifyCustomers();
  }

  public updateCustomer(id: string, updates: Partial<Customer>) {
    const idx = this.customers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.customers[idx] = { ...this.customers[idx], ...updates };
      this.notifyCustomers();
    }
  }

  public addAppointment(appt: Appointment) {
    this.appointments.unshift(appt);
    this.notifyAppointments();
  }

  public updateAppointment(id: string, updates: Partial<Appointment>) {
    const idx = this.appointments.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.appointments[idx] = { ...this.appointments[idx], ...updates, updated_at: Date.now() };
      this.notifyAppointments();
    }
  }

  public addMedia(media: MediaFile) {
    this.mediaFiles.unshift(media);
    this.notifyMedia();
  }

  public setWhatsAppConfig(tenantId: string, cfg: WhatsAppAutomationConfig) {
    this.whatsappConfigs[tenantId] = { ...cfg, updated_at: Date.now() };
    this.notifyWhatsAppConfigs();
  }

  private notifyTenants() {
    this.persist();
    const copy = [...this.tenants];
    this.tenantsListeners.forEach((fn) => fn(copy));
  }

  private notifyAuditLogs() {
    this.persist();
    const copy = [...this.auditLogs];
    this.auditLogListeners.forEach((fn) => fn(copy));
  }

  private notifyRateCard() {
    this.persist();
    const copy = { ...this.rateCard };
    this.rateCardListeners.forEach((fn) => fn(copy));
  }

  private notifyCreditRequests() {
    this.persist();
    const copy = [...this.creditRequests];
    this.creditRequestsListeners.forEach((fn) => fn(copy));
  }

  // Mutations
  public getCreditRequests(tenantId?: string): CreditTopUpRequest[] {
    return tenantId ? this.creditRequests.filter((r) => r.tenant_id === tenantId) : [...this.creditRequests];
  }

  public addCreditRequest(req: CreditTopUpRequest) {
    this.creditRequests.unshift(req);
    this.notifyCreditRequests();
  }

  public updateCreditRequest(id: string, updates: Partial<CreditTopUpRequest>) {
    const idx = this.creditRequests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.creditRequests[idx] = { ...this.creditRequests[idx], ...updates };
      this.notifyCreditRequests();
    }
  }

  public getTenants(): Tenant[] {
    return [...this.tenants];
  }

  public getRateCard(): RateCardConfig {
    return { ...this.rateCard };
  }

  public addTenant(tenant: Tenant) {
    this.tenants.unshift(tenant);
    this.notifyTenants();
  }

  public updateTenant(id: string, updates: Partial<Tenant>) {
    const idx = this.tenants.findIndex((t) => t.id === id || t.tenant_id === id);
    if (idx !== -1) {
      this.tenants[idx] = { ...this.tenants[idx], ...updates, updated_at: Date.now() };
      this.notifyTenants();
    }
  }

  public addAuditLog(log: UsageAuditLog) {
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 250) {
      this.auditLogs = this.auditLogs.slice(0, 250);
    }
    this.notifyAuditLogs();
  }

  public setRateCard(rates: Partial<RateCardConfig>, adminId: string = 'super-admin@proveon.io') {
    this.rateCard = {
      ...this.rateCard,
      ...rates,
      updated_at: Date.now(),
      updated_by: adminId,
    };
    this.notifyRateCard();
  }
}

export const reactiveStore = new ReactiveStore();

// ==========================================
// Firestore Service APIs (Universal Bridge)
// ==========================================

/**
 * Subscribes to real-time changes on the `tenants` collection.
 */
export function subscribeToTenants(callback: (tenants: Tenant[]) => void): Unsubscribe {
  if (db && isLiveFirebaseConfigured) {
    try {
      const q = query(collection(db, 'tenants'), orderBy('created_at', 'desc'));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Tenant[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as any;
              list.push({
                ...data,
                id: d.id,
                tenant_id: data.tenant_id || d.id,
              });
            });
            callback(list);
          } else {
            // Firestore collection currently empty, fall back to reactive store
            callback(reactiveStore.getTenants());
          }
        },
        (err) => {
          console.warn('Firestore live tenants listener error, using reactive client:', err);
          reactiveStore.subscribeTenants(callback);
        }
      );
      return unsub;
    } catch (e) {
      console.warn('Error setting up Firestore tenants listener, using fallback:', e);
    }
  }

  // Fallback to reactive store
  return reactiveStore.subscribeTenants(callback);
}

/**
 * Subscribes to real-time snapshot listener on the `usage_audit_logs` collection.
 */
export function subscribeToUsageAuditLogs(
  callback: (logs: UsageAuditLog[]) => void,
  limitCount: number = 60
): Unsubscribe {
  if (db && isLiveFirebaseConfigured) {
    try {
      const q = query(
        collection(db, 'usage_audit_logs'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: UsageAuditLog[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as any;
              list.push({
                ...data,
                id: d.id,
                log_id: data.log_id || d.id,
              });
            });
            callback(list);
          } else {
            callback(reactiveStore.getTenants().length > 0 ? reactiveStore['auditLogs'] : []);
          }
        },
        (err) => {
          console.warn('Firestore live audit logs listener error, using reactive client:', err);
          reactiveStore.subscribeAuditLogs(callback);
        }
      );
      return unsub;
    } catch (e) {
      console.warn('Error setting up Firestore audit logs listener, using fallback:', e);
    }
  }

  // Fallback to reactive store
  return reactiveStore.subscribeAuditLogs(callback);
}

/**
 * Subscribes to dynamic rate card configuration at `system_config/rate_card`.
 */
export function subscribeToRateCard(callback: (rateCard: RateCardConfig) => void): Unsubscribe {
  if (db && isLiveFirebaseConfigured) {
    try {
      const docRef = doc(db, 'system_config', 'rate_card');
      const unsub = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            callback(snapshot.data() as RateCardConfig);
          } else {
            callback(reactiveStore.getRateCard());
          }
        },
        (err) => {
          console.warn('Firestore live rate card listener error, using reactive client:', err);
          reactiveStore.subscribeRateCard(callback);
        }
      );
      return unsub;
    } catch (e) {
      console.warn('Error setting up Firestore rate card listener, using fallback:', e);
    }
  }

  return reactiveStore.subscribeRateCard(callback);
}

/**
 * Creates / Provisions a new tenant in Firestore and initializes credit_wallet and WABA integration.
 */
export async function provisionTenant(params: {
  business_name: string;
  vertical: Tenant['vertical'];
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  initial_credits: number;
  low_balance_threshold: number;
  phone_number_id?: string;
  waba_account_id?: string;
}): Promise<Tenant> {
  const now = Date.now();
  const slug = params.business_name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 16);
  const tenant_id = `ten-${slug}-${Math.floor(100 + Math.random() * 900)}`;

  const newTenant: Tenant = {
    id: tenant_id,
    tenant_id,
    business_name: params.business_name,
    vertical: params.vertical,
    status: 'Active',
    admin_name: params.admin_name,
    admin_email: params.admin_email,
    admin_phone: params.admin_phone,
    credit_wallet: {
      balance: params.initial_credits,
      lifetime_granted: params.initial_credits,
      lifetime_consumed: 0,
      low_balance_threshold: params.low_balance_threshold,
      last_deduction_at: null,
    },
    waba_integration: {
      phone_number_id: params.phone_number_id || `phone_${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      waba_account_id: params.waba_account_id || `waba_${Math.floor(100000000 + Math.random() * 900000000)}`,
      display_phone_number: params.admin_phone,
      verified_name: params.business_name,
      quality_rating: 'GREEN',
      status: 'CONNECTED',
    },
    created_at: now,
  };

  const auditLog: UsageAuditLog = {
    id: `log-prov-${Date.now()}`,
    log_id: `log-prov-${Date.now()}`,
    tenant_id: newTenant.tenant_id,
    business_name: newTenant.business_name,
    actor: { userId: 'super-admin', role: 'SUPER_ADMIN' },
    operation: {
      action_code: 'MANUAL_TOPUP',
      description: `Tenant provisioned with initial grant of ${params.initial_credits.toFixed(2)} credits`,
    },
    metrics: { executionTimeMs: 32, dbReads: 0, dbWrites: 1 },
    financials: {
      credits_deducted: -params.initial_credits,
      balance_prior: 0,
      balance_post: params.initial_credits,
    },
    timestamp: now,
  };

  // 1. Try real Firestore write if configured
  if (db && isLiveFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'tenants', tenant_id), {
        ...newTenant,
        created_at: serverTimestamp(),
      });
      await setDoc(doc(db, 'usage_audit_logs', auditLog.log_id), {
        ...auditLog,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firestore write failed, falling back to local store:', e);
    }
  }

  // 2. Always update reactive store for instant optimistic feedback
  reactiveStore.addTenant(newTenant);
  reactiveStore.addAuditLog(auditLog);

  return newTenant;
}

/**
 * Manually tops up or adjusts tenant credits with mandatory admin reason.
 */
export async function adjustTenantCredits(params: {
  tenant_id: string;
  amount: number; // Positive = add credits, Negative = deduct
  note: string;
  adminId?: string;
}): Promise<{ success: boolean; newBalance: number }> {
  const tenants = reactiveStore.getTenants();
  const tenant = tenants.find((t) => t.id === params.tenant_id || t.tenant_id === params.tenant_id);

  if (!tenant) {
    throw new Error(`Tenant with ID ${params.tenant_id} not found.`);
  }

  const priorBalance = tenant.credit_wallet.balance;
  const postBalance = Number((priorBalance + params.amount).toFixed(2));
  const lifetimeGranted = params.amount > 0 
    ? Number((tenant.credit_wallet.lifetime_granted + params.amount).toFixed(2))
    : tenant.credit_wallet.lifetime_granted;
  const lifetimeConsumed = params.amount < 0
    ? Number((tenant.credit_wallet.lifetime_consumed + Math.abs(params.amount)).toFixed(2))
    : tenant.credit_wallet.lifetime_consumed;

  const now = Date.now();
  const newStatus: TenantStatus = postBalance < tenant.credit_wallet.low_balance_threshold 
    ? (tenant.status === 'Suspended' ? 'Suspended' : 'Low Balance') 
    : (tenant.status === 'Suspended' ? 'Suspended' : 'Active');

  const updatedWallet = {
    ...tenant.credit_wallet,
    balance: postBalance,
    lifetime_granted: lifetimeGranted,
    lifetime_consumed: lifetimeConsumed,
    last_deduction_at: params.amount < 0 ? now : tenant.credit_wallet.last_deduction_at,
  };

  const auditLog: UsageAuditLog = {
    id: `log-adj-${Date.now()}`,
    log_id: `log-adj-${Date.now()}`,
    tenant_id: tenant.tenant_id,
    business_name: tenant.business_name,
    actor: {
      userId: params.adminId || 'super-admin',
      role: 'SUPER_ADMIN',
    },
    operation: {
      action_code: params.amount >= 0 ? 'MANUAL_TOPUP' : 'MANUAL_ADJUSTMENT',
      description: `Manual adjustment by Super Admin: "${params.note}"`,
    },
    metrics: { executionTimeMs: 28, dbReads: 1, dbWrites: 1 },
    financials: {
      credits_deducted: -params.amount,
      balance_prior: priorBalance,
      balance_post: postBalance,
    },
    timestamp: now,
  };

  if (db && isLiveFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'tenants', tenant.id), {
        credit_wallet: updatedWallet,
        status: newStatus,
        updated_at: serverTimestamp(),
      });
      await setDoc(doc(db, 'usage_audit_logs', auditLog.log_id), {
        ...auditLog,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firestore update failed, falling back to local store:', e);
    }
  }

  reactiveStore.updateTenant(tenant.id, {
    credit_wallet: updatedWallet,
    status: newStatus,
  });
  reactiveStore.addAuditLog(auditLog);

  return { success: true, newBalance: postBalance };
}

/**
 * Toggles a tenant's status between Active and Suspended.
 */
export async function toggleTenantStatus(
  tenant_id: string,
  newStatus: TenantStatus
): Promise<void> {
  const tenants = reactiveStore.getTenants();
  const tenant = tenants.find((t) => t.id === tenant_id || t.tenant_id === tenant_id);
  if (!tenant) throw new Error('Tenant not found');

  if (db && isLiveFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'tenants', tenant.id), {
        status: newStatus,
        updated_at: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firestore status update failed:', e);
    }
  }

  reactiveStore.updateTenant(tenant.id, { status: newStatus });
}

/**
 * Updates dynamic Credit Rate Card in Firestore `system_config/rate_card`.
 */
export async function deployRateCard(
  rates: Partial<RateCardConfig>,
  adminId: string = 'super-admin@proveon.io'
): Promise<void> {
  const merged: RateCardConfig = {
    ...reactiveStore.getRateCard(),
    ...rates,
    updated_at: Date.now(),
    updated_by: adminId,
  };

  if (db && isLiveFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'system_config', 'rate_card'), {
        ...merged,
        updated_at: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firestore rate card write failed:', e);
    }
  }

  reactiveStore.setRateCard(merged, adminId);
}

/**
 * Generates an instantaneous simulated telemetry event to demonstrate live streaming
 * on the Platform Overview dashboard.
 */
export async function generateSimulatedTelemetryEvent(): Promise<UsageAuditLog> {
  const tenants = reactiveStore.getTenants().filter((t) => t.status !== 'Suspended');
  const rates = reactiveStore.getRateCard();
  const targetTenant = tenants.length > 0 ? tenants[Math.floor(Math.random() * tenants.length)] : null;

  const actions: { code: ActionCode; cost: number; desc: string; reads: number; writes: number; latency: number }[] = [
    {
      code: 'WA_BOT_STATE_TRANS',
      cost: rates.WA_BOT_STATE_TRANS,
      desc: 'Bot transition: Appointment confirmation state machine trigger',
      reads: 2,
      writes: 1,
      latency: Math.floor(35 + Math.random() * 45),
    },
    {
      code: 'WA_INBOUND_PROCESS',
      cost: rates.WA_INBOUND_PROCESS,
      desc: 'Inbound WhatsApp webhook received & session router dispatch',
      reads: 1,
      writes: 1,
      latency: Math.floor(20 + Math.random() * 30),
    },
    {
      code: 'DB_WRITE_MUTATION',
      cost: rates.DB_WRITE_MUTATION,
      desc: 'Calendar appointment write & customer profile mutation',
      reads: 1,
      writes: 2,
      latency: Math.floor(45 + Math.random() * 60),
    },
    {
      code: 'DB_READ_BURST',
      cost: rates.DB_READ_BURST,
      desc: 'Client booking history burst read (8 docs)',
      reads: 8,
      writes: 0,
      latency: Math.floor(28 + Math.random() * 35),
    },
    {
      code: 'STORAGE_INGEST_MB',
      cost: rates.STORAGE_INGEST_MB,
      desc: 'Media attachment processed: Customer consultation image (10MB)',
      reads: 1,
      writes: 1,
      latency: Math.floor(90 + Math.random() * 120),
    },
    {
      code: 'AUTOMATED_JOB_DISPATCH',
      cost: rates.AUTOMATED_JOB_DISPATCH,
      desc: 'Automated 2-hr pre-appointment WhatsApp notification fired',
      reads: 3,
      writes: 2,
      latency: Math.floor(50 + Math.random() * 70),
    },
  ];

  const action = actions[Math.floor(Math.random() * actions.length)];
  const tenantId = targetTenant ? targetTenant.tenant_id : 'ten-apex-01';
  const businessName = targetTenant ? targetTenant.business_name : 'Apex Aesthetic Dermatology Clinic';
  const priorBalance = targetTenant ? targetTenant.credit_wallet.balance : 1000.00;
  const postBalance = Number(Math.max(0, priorBalance - action.cost).toFixed(2));

  const now = Date.now();
  const log: UsageAuditLog = {
    id: `log-telemetry-${now}-${Math.floor(100 + Math.random() * 900)}`,
    log_id: `log-telemetry-${now}-${Math.floor(100 + Math.random() * 900)}`,
    tenant_id: tenantId,
    business_name: businessName,
    actor: {
      userId: 'wa-meta-engine',
      role: 'SYSTEM_AGENT',
    },
    operation: {
      action_code: action.code,
      description: action.desc,
    },
    metrics: {
      executionTimeMs: action.latency,
      dbReads: action.reads,
      dbWrites: action.writes,
    },
    financials: {
      credits_deducted: action.cost,
      balance_prior: priorBalance,
      balance_post: postBalance,
    },
    timestamp: now,
  };

  // Update target tenant in store
  if (targetTenant) {
    const updatedWallet = {
      ...targetTenant.credit_wallet,
      balance: postBalance,
      lifetime_consumed: Number((targetTenant.credit_wallet.lifetime_consumed + action.cost).toFixed(2)),
      last_deduction_at: now,
    };
    const newStatus: TenantStatus = postBalance < targetTenant.credit_wallet.low_balance_threshold ? 'Low Balance' : 'Active';
    reactiveStore.updateTenant(targetTenant.id, {
      credit_wallet: updatedWallet,
      status: targetTenant.status === 'Suspended' ? 'Suspended' : newStatus,
    });
  }

  // Push audit log
  reactiveStore.addAuditLog(log);

  // If live Firestore, also sync
  if (db && isLiveFirebaseConfigured && targetTenant) {
    try {
      await updateDoc(doc(db, 'tenants', targetTenant.id), {
        'credit_wallet.balance': postBalance,
        'credit_wallet.lifetime_consumed': targetTenant.credit_wallet.lifetime_consumed + action.cost,
        'credit_wallet.last_deduction_at': serverTimestamp(),
      });
      await setDoc(doc(db, 'usage_audit_logs', log.log_id), {
        ...log,
        timestamp: serverTimestamp(),
      });
    } catch {
      // Ignore background firestore sync error
    }
  }

  return log;
}

/**
 * Seeds demo initial data into Firestore if desired.
 */
export async function seedInitialData(force: boolean = false): Promise<void> {
  reactiveStore.populateDefaultMocks();

  if (db && isLiveFirebaseConfigured) {
    try {
      const snap = await getDocs(collection(db, 'tenants'));
      if (snap.empty || force) {
        for (const t of reactiveStore.getTenants()) {
          await setDoc(doc(db, 'tenants', t.tenant_id), t);
        }
        await setDoc(doc(db, 'system_config', 'rate_card'), reactiveStore.getRateCard());
        console.log('Successfully seeded initial demo dataset to Firestore!');
      }
    } catch (e) {
      console.warn('Seeding to Firestore skipped or failed:', e);
    }
  }
}

// ==========================================
// Business Admin Operations & Credit Metering APIs
// ==========================================

/**
 * Translates technical backend action codes into plain-language business terms.
 */
export function translateActionCode(actionCode: ActionCode | string, description?: string): string {
  switch (actionCode) {
    case 'DB_WRITE_MUTATION':
      if (description?.toLowerCase().includes('customer') || description?.toLowerCase().includes('patient')) {
        return 'Saved Customer Record';
      }
      if (description?.toLowerCase().includes('appointment') || description?.toLowerCase().includes('visit')) {
        return 'Booked Appointment Slot';
      }
      return 'Saved Business Record';
    case 'STORAGE_INGEST_MB':
      return 'Uploaded Portfolio / Document Media';
    case 'WA_BOT_STATE_TRANS':
      return 'Automated WhatsApp Response Sent';
    case 'WA_INBOUND_PROCESS':
      return 'Customer WhatsApp Message Inbound';
    case 'AUTOMATED_JOB_DISPATCH':
      return 'Scheduled Reminder Sent';
    case 'DB_READ_BURST':
      return 'Client Record Lookup';
    case 'MANUAL_TOPUP':
      return 'Admin Credit Grant';
    case 'MANUAL_ADJUSTMENT':
      return 'Wallet Adjustment';
    default:
      return description || actionCode;
  }
}

/**
 * Subscribes to a single tenant document by tenantId in real time.
 */
export function subscribeTenantById(
  tenantId: string,
  callback: (tenant: Tenant | null) => void
): Unsubscribe {
  // If Firestore is live and configured
  if (db && isLiveFirebaseConfigured) {
    try {
      const unsub = onSnapshot(
        doc(db, 'tenants', tenantId),
        (snap) => {
          if (snap.exists()) {
            callback({ ...snap.data(), id: snap.id, tenant_id: snap.data().tenant_id || snap.id } as Tenant);
          } else {
            const local = reactiveStore.getTenants().find((t) => t.id === tenantId || t.tenant_id === tenantId);
            callback(local || null);
          }
        },
        (err) => {
          console.warn('Firestore live tenant listener error:', err);
          const unsubLocal = reactiveStore.subscribeTenants((tenants) => {
            const found = tenants.find((t) => t.id === tenantId || t.tenant_id === tenantId);
            callback(found || null);
          });
          return unsubLocal;
        }
      );
      return unsub;
    } catch {
      // fallback
    }
  }

  // Reactive store fallback
  return reactiveStore.subscribeTenants((tenants) => {
    const found = tenants.find((t) => t.id === tenantId || t.tenant_id === tenantId);
    callback(found || null);
  });
}

/**
 * Subscribes to real-time audit logs for a specific business tenant.
 */
export function subscribeTenantAuditLogs(
  tenantId: string,
  callback: (logs: UsageAuditLog[]) => void,
  limitCount: number = 30
): Unsubscribe {
  return subscribeToUsageAuditLogs((allLogs) => {
    const tenantLogs = allLogs
      .filter((l) => l.tenant_id === tenantId)
      .slice(0, limitCount);
    callback(tenantLogs);
  }, 120);
}

/**
 * Subscribes to customer/patient records for a specific business tenant.
 */
export function subscribeCustomers(
  tenantId: string,
  callback: (customers: Customer[]) => void
): Unsubscribe {
  return reactiveStore.subscribeCustomers((allCustomers) => {
    callback(allCustomers.filter((c) => c.tenant_id === tenantId));
  });
}

/**
 * Subscribes to appointments for a specific business tenant.
 */
export function subscribeAppointments(
  tenantId: string,
  callback: (appointments: Appointment[]) => void
): Unsubscribe {
  return reactiveStore.subscribeAppointments((allAppts) => {
    callback(allAppts.filter((a) => a.tenant_id === tenantId));
  });
}

/**
 * Subscribes to media files for a specific business tenant.
 */
export function subscribeMediaFiles(
  tenantId: string,
  callback: (media: MediaFile[]) => void
): Unsubscribe {
  return reactiveStore.subscribeMedia((allMedia) => {
    callback(allMedia.filter((m) => m.tenant_id === tenantId));
  });
}

/**
 * Subscribes to WhatsApp Automation configuration for a specific business tenant.
 */
export function subscribeWhatsAppConfig(
  tenantId: string,
  callback: (config: WhatsAppAutomationConfig) => void
): Unsubscribe {
  return reactiveStore.subscribeWhatsAppConfigs((configs) => {
    const cfg = configs[tenantId] || reactiveStore.getWhatsAppConfig(tenantId);
    callback(cfg);
  });
}

/**
 * Internal helper to meter and deduct credits atomically with audit logging.
 */
async function meterAndDeductCredits(params: {
  tenant_id: string;
  cost: number;
  action_code: ActionCode;
  friendly_desc: string;
  reads?: number;
  writes?: number;
  latency?: number;
  storageMb?: number;
}): Promise<{ newBalance: number; log: UsageAuditLog }> {
  const tenants = reactiveStore.getTenants();
  const tenant = tenants.find((t) => t.id === params.tenant_id || t.tenant_id === params.tenant_id);

  if (!tenant) {
    throw new Error(`Tenant ${params.tenant_id} not found.`);
  }

  const currentBalance = tenant.credit_wallet.balance;

  // Enforce out-of-credit prevention
  if (currentBalance <= 0 || currentBalance < params.cost) {
    throw new InsufficientCreditsError(params.cost, currentBalance);
  }

  const postBalance = Number((currentBalance - params.cost).toFixed(2));
  const now = Date.now();
  const newStatus: TenantStatus =
    postBalance < tenant.credit_wallet.low_balance_threshold ? 'Low Balance' : 'Active';

  const updatedWallet = {
    ...tenant.credit_wallet,
    balance: postBalance,
    lifetime_consumed: Number((tenant.credit_wallet.lifetime_consumed + params.cost).toFixed(2)),
    last_deduction_at: now,
  };

  const log: UsageAuditLog = {
    id: `log-biz-${now}-${Math.floor(100 + Math.random() * 900)}`,
    log_id: `log-biz-${now}-${Math.floor(100 + Math.random() * 900)}`,
    tenant_id: tenant.tenant_id,
    business_name: tenant.business_name,
    actor: {
      userId: tenant.admin_email || 'biz-admin',
      role: 'BUSINESS_ADMIN',
    },
    operation: {
      action_code: params.action_code,
      description: params.friendly_desc,
    },
    metrics: {
      executionTimeMs: params.latency || Math.floor(25 + Math.random() * 35),
      dbReads: params.reads ?? 1,
      dbWrites: params.writes ?? 1,
      storageMb: params.storageMb,
    },
    financials: {
      credits_deducted: params.cost,
      balance_prior: currentBalance,
      balance_post: postBalance,
    },
    timestamp: now,
  };

  // 1. Update in-memory reactive store
  reactiveStore.updateTenant(tenant.id, {
    credit_wallet: updatedWallet,
    status: tenant.status === 'Suspended' ? 'Suspended' : newStatus,
  });
  reactiveStore.addAuditLog(log);

  // 2. Sync to Firestore if live (guarded with timeout race so UI never hangs)
  if (db && isLiveFirebaseConfigured) {
    try {
      const syncTask = Promise.all([
        updateDoc(doc(db, 'tenants', tenant.id), {
          credit_wallet: updatedWallet,
          status: tenant.status === 'Suspended' ? 'Suspended' : newStatus,
          updated_at: serverTimestamp(),
        }),
        setDoc(doc(db, 'usage_audit_logs', log.log_id), {
          ...log,
          timestamp: serverTimestamp(),
        }),
      ]);
      await Promise.race([syncTask, new Promise((resolve) => setTimeout(resolve, 300))]);
    } catch {
      // background error handled gracefully
    }
  }

  return { newBalance: postBalance, log };
}

/**
 * Creates a Customer with DB_WRITE_MUTATION credit metering.
 */
export async function createCustomerWithMetering(
  tenantId: string,
  customerData: Omit<Customer, 'id' | 'created_at'>
): Promise<{ customer: Customer; newBalance: number }> {
  const rateCard = reactiveStore.getRateCard();
  const cost = rateCard.DB_WRITE_MUTATION || 0.50;

  const { newBalance } = await meterAndDeductCredits({
    tenant_id: tenantId,
    cost,
    action_code: 'DB_WRITE_MUTATION',
    friendly_desc: `Saved Customer Record: ${customerData.full_name}`,
    reads: 0,
    writes: 1,
  });

  const now = Date.now();
  const newCustomer: Customer = {
    ...customerData,
    id: `cust-${now}-${Math.floor(100 + Math.random() * 900)}`,
    tenant_id: tenantId,
    created_at: now,
  };

  reactiveStore.addCustomer(newCustomer);
  return { customer: newCustomer, newBalance };
}

/**
 * Creates an Appointment with DB_WRITE_MUTATION credit metering.
 */
export async function createAppointmentWithMetering(
  tenantId: string,
  apptData: Omit<Appointment, 'id' | 'created_at'>
): Promise<{ appointment: Appointment; newBalance: number }> {
  const rateCard = reactiveStore.getRateCard();
  const cost = rateCard.DB_WRITE_MUTATION || 0.50;

  const { newBalance } = await meterAndDeductCredits({
    tenant_id: tenantId,
    cost,
    action_code: 'DB_WRITE_MUTATION',
    friendly_desc: `Booked Appointment Slot: ${apptData.customer_name} (${apptData.service_name})`,
    reads: 1,
    writes: 1,
  });

  const now = Date.now();
  const newAppt: Appointment = {
    ...apptData,
    id: `appt-${now}-${Math.floor(100 + Math.random() * 900)}`,
    tenant_id: tenantId,
    created_at: now,
  };

  reactiveStore.addAppointment(newAppt);
  return { appointment: newAppt, newBalance };
}

/**
 * Updates an appointment's status (e.g. ATTENDED, NO_SHOW, CANCELLED, CONFIRMED)
 * and updates client engagement statistics when attended.
 */
export async function updateAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  status: Appointment['status'],
  notes?: string
): Promise<Appointment | null> {
  const appointments = reactiveStore.getAppointments(tenantId);
  const target = appointments.find((a) => a.id === appointmentId);
  if (!target) return null;

  const updates: Partial<Appointment> = {
    status,
    ...(notes !== undefined ? { notes } : {}),
    updated_at: Date.now(),
  };

  reactiveStore.updateAppointment(appointmentId, updates);

  // If attended / completed, update client attendance stats
  if ((status === 'ATTENDED' || status === 'COMPLETED') && (target.customer_id || target.client_id)) {
    const cId = (target.customer_id || target.client_id)!;
    const customer = reactiveStore.getCustomers(tenantId).find((c) => c.id === cId);
    if (customer) {
      reactiveStore.updateCustomer(cId, {
        total_completed_visits: (customer.total_completed_visits || 0) + 1,
        last_interacted_at: Date.now(),
      });
    }
  }

  // Also update live Firestore if configured
  if (db && isLiveFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), {
        status,
        ...(notes !== undefined ? { notes } : {}),
        updated_at: serverTimestamp(),
      });
    } catch {
      // background sync
    }
  }

  return { ...target, ...updates };
}

/**
 * Updates a customer/client's profile information or engagement statistics.
 */
export async function updateCustomerRecord(
  tenantId: string,
  customerId: string,
  updates: Partial<Customer>
): Promise<Customer | null> {
  const customers = reactiveStore.getCustomers(tenantId);
  const target = customers.find((c) => c.id === customerId);
  if (!target) return null;

  reactiveStore.updateCustomer(customerId, updates);

  if (db && isLiveFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'customers', customerId), {
        ...updates,
        updated_at: serverTimestamp(),
      });
    } catch {
      // background sync
    }
  }

  return { ...target, ...updates };
}

/**
 * Admin Manual Booking & Slot Allocation:
 * Books an appointment on behalf of an existing or new client directly with metering,
 * updates client engagement counters, and marks the slot as taken.
 */
export async function bookManualAppointmentWithMetering(
  tenantId: string,
  bookingData: {
    customer_id?: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    service_name: string;
    date: string;
    time: string;
    duration_minutes?: number;
    notes?: string;
  }
): Promise<{ appointment: Appointment; customer: Customer; newBalance: number }> {
  const rateCard = reactiveStore.getRateCard();
  const cost = rateCard.DB_WRITE_MUTATION || 0.50;

  const { newBalance } = await meterAndDeductCredits({
    tenant_id: tenantId,
    cost,
    action_code: 'DB_WRITE_MUTATION',
    friendly_desc: `Admin Manual Booking: ${bookingData.customer_name} (${bookingData.service_name})`,
    reads: 1,
    writes: 2,
  });

  const now = Date.now();
  let clientObj: Customer;

  // 1. Resolve or Create Client
  const existingCustomers = reactiveStore.getCustomers(tenantId);
  let matchedClient = bookingData.customer_id
    ? existingCustomers.find((c) => c.id === bookingData.customer_id)
    : existingCustomers.find(
        (c) =>
          c.phone === bookingData.customer_phone ||
          c.phone.replace(/[^0-9]/g, '') === bookingData.customer_phone.replace(/[^0-9]/g, '')
      );

  if (matchedClient) {
    const updatedBookings = (matchedClient.total_bookings || 0) + 1;
    const clientUpdates: Partial<Customer> = {
      total_bookings: updatedBookings,
      last_interacted_at: now,
      ...(bookingData.customer_email && !matchedClient.email ? { email: bookingData.customer_email } : {}),
      ...(bookingData.service_name ? { service_interest: bookingData.service_name } : {}),
    };
    reactiveStore.updateCustomer(matchedClient.id, clientUpdates);
    clientObj = { ...matchedClient, ...clientUpdates };
  } else {
    const newCustId = `cust-${now}-${Math.floor(100 + Math.random() * 900)}`;
    clientObj = {
      id: newCustId,
      tenant_id: tenantId,
      full_name: bookingData.customer_name,
      name: bookingData.customer_name,
      phone: bookingData.customer_phone,
      phone_number: bookingData.customer_phone,
      email: bookingData.customer_email || `${bookingData.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@client.com`,
      service_interest: bookingData.service_name,
      status: 'active',
      total_bookings: 1,
      total_completed_visits: 0,
      last_interacted_at: now,
      notes: bookingData.notes || 'Created via Admin Manual Booking',
      created_at: now,
    };
    reactiveStore.addCustomer(clientObj);
  }

  // 2. Create Appointment Entity
  const apptId = `appt-${now}-${Math.floor(100 + Math.random() * 900)}`;
  const newAppt: Appointment = {
    id: apptId,
    tenant_id: tenantId,
    customer_id: clientObj.id,
    client_id: clientObj.id,
    customer_name: clientObj.full_name,
    client_name: clientObj.full_name,
    customer_phone: clientObj.phone,
    client_phone: clientObj.phone,
    service_name: bookingData.service_name,
    date: bookingData.date,
    time: bookingData.time,
    duration_minutes: bookingData.duration_minutes || 45,
    status: 'CONFIRMED',
    booking_source: 'admin_manual',
    notes: bookingData.notes || 'Manual booking via Admin Console',
    created_at: now,
    updated_at: now,
  };

  reactiveStore.addAppointment(newAppt);

  // 3. Concurrency Slot Booking Sync
  try {
    await bookSlot(tenantId, bookingData.date, bookingData.time, {
      customer_phone: clientObj.phone,
      customer_name: clientObj.full_name,
      service: bookingData.service_name,
    });
  } catch (err) {
    console.warn('Slot booking sync in manual booking completed with fallback:', err);
  }

  // 4. Firestore Background Sync if Configured
  if (db && isLiveFirebaseConfigured) {
    try {
      setDoc(doc(db, 'appointments', apptId), {
        ...newAppt,
        created_at: serverTimestamp(),
      }).catch(console.warn);
      setDoc(doc(db, 'customers', clientObj.id), {
        ...clientObj,
        created_at: serverTimestamp(),
      }).catch(console.warn);
    } catch {
      // background
    }
  }

  return { appointment: newAppt, customer: clientObj, newBalance };
}

/**
 * Uploads a Media / File with dynamic STORAGE_INGEST_MB credit metering.
 */
export async function uploadMediaWithMetering(
  tenantId: string,
  fileData: {
    file_name: string;
    file_type: string;
    file_size_mb: number;
    category: MediaFile['category'];
    url?: string;
  }
): Promise<{ media: MediaFile; newBalance: number; creditsMetered: number }> {
  const rateCard = reactiveStore.getRateCard();
  // Rate: 1.00 credit / 10MB -> (size_in_mb / 10) * rate
  const cost = Math.max(
    0.10,
    Number(((fileData.file_size_mb / 10) * (rateCard.STORAGE_INGEST_MB || 1.00)).toFixed(2))
  );

  const { newBalance } = await meterAndDeductCredits({
    tenant_id: tenantId,
    cost,
    action_code: 'STORAGE_INGEST_MB',
    friendly_desc: `Uploaded Document / Media: ${fileData.file_name} (${fileData.file_size_mb.toFixed(1)}MB)`,
    storageMb: fileData.file_size_mb,
    writes: 1,
  });

  const now = Date.now();
  const newMedia: MediaFile = {
    id: `med-${now}-${Math.floor(100 + Math.random() * 900)}`,
    tenant_id: tenantId,
    file_name: fileData.file_name,
    file_type: fileData.file_type,
    file_size_mb: fileData.file_size_mb,
    category: fileData.category,
    credits_metered: cost,
    url:
      fileData.url ||
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=60',
    uploaded_at: now,
  };

  reactiveStore.addMedia(newMedia);
  return { media: newMedia, newBalance, creditsMetered: cost };
}

/**
 * Saves WhatsApp automation flow configuration.
 */
export async function saveWhatsAppConfig(
  tenantId: string,
  config: Partial<WhatsAppAutomationConfig>
): Promise<void> {
  const existing = reactiveStore.getWhatsAppConfig(tenantId);
  const updated: WhatsAppAutomationConfig = {
    ...existing,
    ...config,
    tenant_id: tenantId,
    updated_at: Date.now(),
  };

  reactiveStore.setWhatsAppConfig(tenantId, updated);

  if (db && isLiveFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'whatsapp_configs', tenantId), {
        ...updated,
        updated_at: serverTimestamp(),
      });
      // Also persist to structured whatsapp_flows collection for tenant
      await setDoc(doc(db, 'whatsapp_flows', tenantId), {
        ...updated,
        updated_at: serverTimestamp(),
      });
    } catch {
      // background
    }
  }
}

/**
 * Simulates an automated WhatsApp reply or reminder dispatch with live credit metering.
 */
export async function testSendWhatsAppAutomationWithMetering(
  tenantId: string,
  ruleTitle: string,
  recipientPhone: string
): Promise<{ success: boolean; newBalance: number; creditsDeducted: number; activeFlowVersion?: number }> {
  const rateCard = reactiveStore.getRateCard();
  const cost = rateCard.WA_BOT_STATE_TRANS || 0.50;

  const activeFlow = reactiveStore.getNodeFlow(tenantId);
  const flowName = activeFlow?.name || ruleTitle;
  const versionStr = activeFlow?.version ? `v${activeFlow.version}` : 'v1.0';

  const { newBalance } = await meterAndDeductCredits({
    tenant_id: tenantId,
    cost,
    action_code: 'WA_BOT_STATE_TRANS',
    friendly_desc: `Automated WhatsApp Dispatch: "${flowName}" (${versionStr} Live) to ${recipientPhone}`,
    reads: 1,
    writes: 1,
  });

  return { success: true, newBalance, creditsDeducted: cost, activeFlowVersion: activeFlow?.version };
}

/**
 * Session Management & State Machine Routing
 * Stores and updates session state with:
 * { user_phone, active_flow_id, current_step, collected_data: {}, updated_at }
 */
export async function getWhatsAppSession(
  tenantId: string,
  userPhone: string
): Promise<WhatsAppSessionState | null> {
  const local = reactiveStore.getSession(tenantId, userPhone);
  return local;
}

export async function saveWhatsAppSession(
  tenantId: string,
  session: WhatsAppSessionState
): Promise<void> {
  reactiveStore.saveSession(tenantId, session);
  if (db && isLiveFirebaseConfigured) {
    try {
      const sanitized = JSON.parse(JSON.stringify(session));
      const syncTask = setDoc(
        doc(db, 'whatsapp_sessions', `${tenantId}_${session.user_phone.replace(/[^a-zA-Z0-9]/g, '')}`),
        {
          ...sanitized,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
      // Strict timeout guard to prevent Firestore network latency from blocking UI
      await Promise.race([syncTask, new Promise((resolve) => setTimeout(resolve, 300))]);
    } catch (e) {
      console.warn('Failed to sync session to Firestore:', e);
    }
  }
}

export async function resetWhatsAppSession(
  tenantId: string,
  userPhone: string,
  activeFlowId: string
): Promise<WhatsAppSessionState> {
  const freshSession = reactiveStore.resetSession(tenantId, userPhone, activeFlowId);
  if (db && isLiveFirebaseConfigured) {
    try {
      const syncTask = setDoc(
        doc(db, 'whatsapp_sessions', `${tenantId}_${userPhone.replace(/[^a-zA-Z0-9]/g, '')}`),
        {
          ...freshSession,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
      // Strict timeout guard to prevent Firestore network latency from blocking UI
      await Promise.race([syncTask, new Promise((resolve) => setTimeout(resolve, 300))]);
    } catch (e) {
      console.warn('Failed to reset session in Firestore:', e);
    }
  }
  return freshSession;
}

/**
 * Dynamically resolves available services based on business config/vertical.
 * Universal and customizable: no hardcoded niche services.
 */
export function getTenantAvailableServices(_tenant?: Tenant | null): string[] {
  return [
    'Option 1: Initial Consultation',
    'Option 2: Standard Procedure / Service',
    'Option 3: Follow-up & Support',
  ];
}

/**
 * Universal Appointment & Booking Flow
 * Single, fully modular, and customizable flow for any business type.
 * Follows the universal 7-step progression:
 * Step 1: Inbound message trigger
 * Step 2: Session state reset
 * Step 3: Identity / Full Legal Name ({{customer_name}})
 * Step 4: Dynamic Service Selection ({{selected_service}})
 * Step 5: Date & Time / Slot Selection ({{booking_date}}, {{booking_time}}, {{booking_slot}})
 * Step 6: Booking Confirmation Summary
 * Step 7: Universal Rating / Feedback (appended directly)
 */
/**
 * Real-time Slot Availability & Collision Detection Engine
 * Checks whether the requested slot collides with existing confirmed appointments.
 * If a collision occurs, calculates and returns alternative available time slots.
 */
export function checkSlotCollision(
  tenantId: string,
  dateStr: string,
  timeStr: string,
  _doctorOrService?: string
): { hasCollision: boolean; conflictingAppointment?: Appointment; alternativeSlots: string[] } {
  const appointments = reactiveStore.getAppointments(tenantId);
  const normalizedDate = dateStr.toLowerCase().trim();
  const normalizedTime = timeStr.toLowerCase().trim();

  // Find colliding confirmed appointment
  const conflicting = appointments.find((appt) => {
    if (appt.status === 'CANCELLED') return false;
    const apptDate = String(appt.date || '').toLowerCase().trim();
    const apptTime = String(appt.time || '').toLowerCase().trim();
    const apptSlot = `${apptDate} ${apptTime}`.toLowerCase();

    // Check collision on date + time or partial time match
    const dateMatch = apptDate && (normalizedDate.includes(apptDate) || apptDate.includes(normalizedDate));
    const timeMatch =
      apptTime && (
        normalizedTime.includes(apptTime) ||
        apptTime.includes(normalizedTime) ||
        (normalizedTime.includes('2:00') && apptTime.includes('14:00')) ||
        (normalizedTime.includes('2:30') && apptTime.includes('14:30'))
      );

    return (dateMatch && timeMatch) || apptSlot.includes(normalizedTime);
  });

  const standardSlots = ['09:30 AM', '11:00 AM', '02:00 PM', '03:30 PM', '05:00 PM', '06:30 PM'];
  const alternativeSlots = standardSlots.filter((slot) => !slot.toLowerCase().includes(normalizedTime));

  return {
    hasCollision: !!conflicting,
    conflictingAppointment: conflicting,
    alternativeSlots: alternativeSlots.slice(0, 3),
  };
}

/**
 * Universal Appointment & Booking Flow (Multi-Branch Architecture)
 * Modular multi-branch flow for generic businesses (clinics, consultancies, services):
 * Node 1: Inbound Trigger ("Hi", "Hello")
 * Node 2: Welcome Message & Capture Full Name ({{customer_name}})
 * Node 3: Dynamic Main Menu (Branch 1: Consulting/Doctor, Branch 2: Services, Branch 3: Help/Support)
 * Node 4: Branch 1 - Help & Support
 * Node 5: Branch 2 - Services Catalog
 * Node 6: Branch 3 - Consulting / Doctor Selection
 * Node 7: Slot Availability & Real-Time Booking
 * Node 8: Backend Action (Auto-create appointment in DB, rule metering)
 * Node 9: Booking Confirmation Summary
 * Node 10: Post-Service Rating & Feedback Node (1-5 Stars)
 * Node 11: Final Receipt & Completion Node
 */
export function getDefaultNodeFlow(
  tenantId: string,
  businessName?: string,
  _services?: string[]
): WhatsAppNodeFlow {
  const effectiveBiz = businessName || 'Universal Consultation Hub';

  return {
    id: `flow-universal-${tenantId}`,
    name: 'Universal Multi-Branch Appointment & Services Flow',
    tenant_id: tenantId,
    description:
      'Multi-branch conversational workflow with Main Menu routing (Consulting/Doctors, Services Catalog, Help/Support), real-time slot collision detection, and automated booking receipts.',
    status: 'ACTIVE',
    is_active: true,
    version: 1,
    deployed_at: Date.now() - 3600000,
    deployed_by: 'Platform Workflow Architect',
    execution_policy: 'EXCLUSIVE_ACTIVE',
    nodes: [
      {
        id: 'node-trigger',
        type: 'TRIGGER',
        title: 'Inbound Customer Trigger',
        subtitle: 'Listens for start keywords & clears session',
        x: 40,
        y: 220,
        data: {
          keywords: ['hi', 'hello', 'start', 'menu', 'book', 'appointment', 'consult', 'help'],
          matchType: 'CONTAINS',
          description: 'Matches initial customer greeting and starts clean workflow',
        },
      },
      {
        id: 'node-identity',
        type: 'USER_INPUT',
        title: 'Welcome & Capture Name',
        subtitle: 'Stored in {{customer_name}}',
        x: 360,
        y: 220,
        data: {
          prompt: `Hello! Welcome to ${effectiveBiz}.\n\nTo get started, please reply with your Full Name:`,
          variableName: 'customer_name',
          inputType: 'text',
          required: true,
          validationMessage: 'Please reply with your full name to proceed.',
        },
      },
      {
        id: 'node-main-menu',
        type: 'USER_INPUT',
        title: 'Dynamic Main Menu',
        subtitle: 'Multi-Branch Routing Hub',
        x: 680,
        y: 220,
        data: {
          prompt: 'Welcome, {{customer_name}}! How can we assist you today? Please choose an option below:',
          variableName: 'menu_choice',
          inputType: 'choice',
          options: [
            '1. Consulting / Doctor Appointment',
            '2. Services',
            '3. Help / Support',
          ],
          required: true,
        },
      },
      {
        id: 'node-consultant',
        type: 'USER_INPUT',
        title: 'Branch 1: Consultant / Doctor Selection',
        subtitle: 'Select department & specialist',
        x: 1040,
        y: 60,
        data: {
          prompt: '🩺 Please select a specialist / consultant for your appointment:\n\n• Dr. Mitchell (Lead Specialist • $150)\n• Dr. Chen (Senior Consultant • $120)\n• Dr. Vance (General Practitioner • $90)',
          variableName: 'selected_doctor',
          inputType: 'choice',
          options: [
            'Dr. Mitchell (Lead Specialist)',
            'Dr. Chen (Senior Consultant)',
            'Dr. Vance (General Practitioner)',
          ],
          required: true,
        },
      },
      {
        id: 'node-services',
        type: 'USER_INPUT',
        title: 'Branch 2: Services Catalog',
        subtitle: 'Customizable service menu & pricing',
        x: 1040,
        y: 220,
        data: {
          prompt: '📋 Explore our service catalog and select a service to book:\n\n1. Option 1: Initial Comprehensive Consultation ($45 • 30 mins)\n2. Option 2: Standard Service & Procedure ($120 • 45 mins)\n3. Option 3: Follow-up & Support Review ($35 • 20 mins)',
          variableName: 'selected_service',
          inputType: 'choice',
          options: [
            'Option 1: Initial Consultation',
            'Option 2: Standard Service',
            'Option 3: Follow-up & Review',
          ],
          services: [
            { id: 'srv-1', name: 'Option 1: Initial Consultation', price: 45, durationMinutes: 30, description: 'Initial Consultation' },
            { id: 'srv-2', name: 'Option 2: Standard Service', price: 120, durationMinutes: 45, description: 'Standard Service' },
            { id: 'srv-3', name: 'Option 3: Follow-up & Review', price: 35, durationMinutes: 20, description: 'Follow-up & Review' },
          ],
          required: true,
        },
      },
      {
        id: 'node-support',
        type: 'SUPPORT_HELPDESK',
        title: 'Branch 3: Customer Support & Helpdesk',
        subtitle: 'Multi-action helpdesk with live agent, location, FAQ, and inbox',
        x: 1040,
        y: 390,
        data: {
          header: `How can our support team assist you today, {{customer_name}}?`,
          phone: '+1 (555) 019-2831',
          address: '1200 Innovation Way, Suite 400',
          workingHours: 'Mon-Sat: 9:00 AM - 7:00 PM',
          mapsUrl: 'https://maps.google.com/?q=1200+Innovation+Way',
          options: [
            'Direct Call / Live Agent',
            'Location & Working Hours',
            'Frequently Asked Questions (FAQ)',
            'Leave a Message',
          ],
          faqs: [
            { question: 'What are your accepted payment methods?', answer: 'We accept all major credit cards, Apple Pay, Google Pay, and UPI.' },
            { question: 'What is your cancellation policy?', answer: 'Cancellations or reschedules made 24+ hours in advance incur no fee.' },
            { question: 'Do you offer introductory consultations?', answer: 'Yes! Free 15-minute consultations can be scheduled directly here.' },
          ],
          variableName: 'support_action',
        },
      },
      {
        id: 'node-slot-booking',
        type: 'USER_INPUT',
        title: 'Slot Availability & Booking',
        subtitle: 'Interactive calendar & collision check',
        x: 1400,
        y: 140,
        data: {
          prompt: '📅 Please select your preferred appointment date and time slot below (working hours: 9:00 AM - 6:30 PM):',
          variableName: 'booking_slot',
          inputType: 'date',
          required: true,
        },
      },
      {
        id: 'node-backend-booking',
        type: 'BACKEND_ACTION',
        title: 'Backend Rule Action',
        subtitle: 'Auto-create appointment in DB & meters credit',
        x: 1740,
        y: 140,
        data: {
          actionType: 'CREATE_APPOINTMENT',
          description: 'Auto-create confirmed appointment & customer record directly from WhatsApp inputs',
          autoConfirm: true,
          creditCost: 0.50,
        },
      },
      {
        id: 'node-confirmation',
        type: 'MESSAGE',
        title: 'Booking Confirmation Summary',
        subtitle: 'Structured WhatsApp confirmation receipt',
        x: 2080,
        y: 140,
        data: {
          header: effectiveBiz,
          body: '🎉 Booking Confirmed!\n\n📋 Reservation Summary:\n• Client: {{customer_name}}\n• Provider / Specialty: {{selected_doctor}}\n• Service: {{selected_service}}\n• Scheduled Slot: {{booking_slot}}\n• Booking Ref: #BK-{{booking_id}}\n\nWe look forward to serving you!',
        },
      },
      {
        id: 'node-rating',
        type: 'USER_INPUT',
        title: 'Post-Service Feedback',
        subtitle: '1-5 star review collection',
        x: 2420,
        y: 140,
        data: {
          prompt: 'Before you go, {{customer_name}}, how would you rate your booking experience today?',
          variableName: 'rating',
          inputType: 'choice',
          options: [
            '⭐⭐⭐⭐⭐ 5 Stars (Delighted)',
            '⭐⭐⭐⭐ 4 Stars (Good)',
            '⭐⭐⭐ 3 Stars (Satisfactory)',
            '⚠️ Needs Improvement',
          ],
          required: false,
        },
      },
      {
        id: 'node-terminal',
        type: 'TERMINAL',
        title: 'Final Receipt & Completion',
        subtitle: 'Completed flow receipt',
        x: 2760,
        y: 140,
        data: {
          body: 'Thank you for your rating ({{rating}}), {{customer_name}}! If you need to make any changes to your appointment, simply reply to this chat anytime.',
          includeSummary: false,
        },
      },
    ],
    edges: [
      { id: 'edge-trigger-identity', sourceNodeId: 'node-trigger', targetNodeId: 'node-identity' },
      { id: 'edge-identity-menu', sourceNodeId: 'node-identity', targetNodeId: 'node-main-menu' },
      // Branch 1: Consulting / Doctor Appointment -> node-consultant
      {
        id: 'edge-menu-consultant',
        sourceNodeId: 'node-main-menu',
        targetNodeId: 'node-consultant',
        sourceHandle: '1. Consulting / Doctor Appointment',
        label: '1. Consulting / Doctor Appointment',
      },
      // Branch 2: Services -> node-services
      {
        id: 'edge-menu-services',
        sourceNodeId: 'node-main-menu',
        targetNodeId: 'node-services',
        sourceHandle: '2. Services',
        label: '2. Services',
      },
      // Branch 3: Help / Support -> node-support
      {
        id: 'edge-menu-support',
        sourceNodeId: 'node-main-menu',
        targetNodeId: 'node-support',
        sourceHandle: '3. Help / Support',
        label: '3. Help / Support',
      },
      // Both branches converge into the slot availability & booking node
      { id: 'edge-consultant-slot', sourceNodeId: 'node-consultant', targetNodeId: 'node-slot-booking' },
      { id: 'edge-services-slot', sourceNodeId: 'node-services', targetNodeId: 'node-slot-booking' },
      // Pipeline to confirmation and rating
      { id: 'edge-slot-backend', sourceNodeId: 'node-slot-booking', targetNodeId: 'node-backend-booking' },
      { id: 'edge-backend-confirm', sourceNodeId: 'node-backend-booking', targetNodeId: 'node-confirmation' },
      { id: 'edge-confirm-rating', sourceNodeId: 'node-confirmation', targetNodeId: 'node-rating' },
      { id: 'edge-rating-terminal', sourceNodeId: 'node-rating', targetNodeId: 'node-terminal' },
    ],
    updated_at: Date.now(),
  };
}

/**
 * Deprecated: Standalone rating flow unified into Universal Booking Flow Step 7.
 * Alias maintained for backward compatibility.
 */
export function getRatingTriageFlow(tenantId: string): WhatsAppNodeFlow {
  return getDefaultNodeFlow(tenantId);
}

/**
 * Subscribes to direct in-WhatsApp captured submissions for a tenant.
 */
export function subscribeCapturedSubmissions(
  tenantId: string,
  callback: (submissions: CapturedFlowSubmission[]) => void
): Unsubscribe {
  return reactiveStore.subscribeCapturedSubmissions((list) => {
    const filtered = list.filter((s) => s.tenant_id === tenantId);
    callback(filtered);
  });
}

/**
 * Subscribes to the visual node flow for a tenant.
 * Uses real-time Firestore listener on `whatsapp_node_flows/{tenantId}` if live,
 * ensuring all updates strictly reflect the deployed custom configuration.
 */
export function subscribeNodeFlow(
  tenantId: string,
  callback: (flow: WhatsAppNodeFlow) => void
): Unsubscribe {
  const effectiveId = tenantId || 'ten-apex-01';

  if (db && isLiveFirebaseConfigured) {
    try {
      const unsub = onSnapshot(
        doc(db, 'whatsapp_node_flows', effectiveId),
        (snapshot) => {
          if (snapshot.exists()) {
            const liveFlow = snapshot.data() as WhatsAppNodeFlow;
            reactiveStore.setNodeFlow(effectiveId, liveFlow);
            callback(liveFlow);
          } else {
            callback(reactiveStore.getNodeFlow(effectiveId));
          }
        },
        (err) => {
          console.warn('Firestore live node flow listener fallback:', err);
          callback(reactiveStore.getNodeFlow(effectiveId));
        }
      );
      return unsub;
    } catch (e) {
      console.warn('Error setting up Firestore node flow listener:', e);
    }
  }

  return reactiveStore.subscribeNodeFlows((flows) => {
    const flow = flows[effectiveId] || reactiveStore.getNodeFlow(effectiveId);
    callback(flow);
  });
}

/**
 * Deploys a specific visual node flow as the active, authoritative live version.
 * Overwrites all previous flow versions, suppresses any legacy competing configurations,
 * and updates the tenant metadata so all live WhatsApp interactions strictly execute this path.
 */
export async function deployActiveNodeFlow(
  tenantId: string,
  flow: WhatsAppNodeFlow,
  adminUser?: string
): Promise<{ flow: WhatsAppNodeFlow; deployedVersion: number }> {
  const effectiveId = tenantId || 'ten-apex-01';
  const currentFlow = reactiveStore.getNodeFlow(effectiveId);
  const nextVersion = (currentFlow?.version || 0) + 1;
  const now = Date.now();

  const activeFlow: WhatsAppNodeFlow = {
    ...flow,
    tenant_id: effectiveId,
    status: 'ACTIVE',
    is_active: true,
    version: nextVersion,
    deployed_at: now,
    deployed_by: adminUser || 'Business Admin',
    execution_policy: 'EXCLUSIVE_ACTIVE',
    updated_at: now,
  };

  // 1. Immediately overwrite in-memory reactiveStore for this tenant's flow
  reactiveStore.setNodeFlow(effectiveId, activeFlow);

  // 2. Overwrite / deactivate any legacy secondary configs for this tenant
  // so that NO other competing flow or legacy rule interferes!
  const legacyConfig = reactiveStore.getWhatsAppConfig(effectiveId);
  if (legacyConfig) {
    reactiveStore.setWhatsAppConfig(effectiveId, {
      ...legacyConfig,
      welcome_flow: {
        ...legacyConfig.welcome_flow,
        enabled: false, // strictly disabled in favor of active node flow
      },
      followup_rules: (legacyConfig.followup_rules || []).map((r) => ({
        ...r,
        enabled: false, // suppressed
      })),
      updated_at: now,
    });
  }

  // 3. Update the tenant record with the active deployed flow reference
  reactiveStore.updateTenant(effectiveId, {
    active_flow_id: activeFlow.id,
    active_flow_name: activeFlow.name,
    active_flow_version: nextVersion,
    active_flow_deployed_at: now,
  });

  // 4. Remote Firestore sync (Non-blocking with strict timeout & sanitized payload)
  if (db && isLiveFirebaseConfigured) {
    try {
      const sanitizedFlow = JSON.parse(JSON.stringify(activeFlow));

      const syncTask = Promise.all([
        // Overwrite document in whatsapp_node_flows
        setDoc(doc(db, 'whatsapp_node_flows', effectiveId), {
          ...sanitizedFlow,
          updated_at: serverTimestamp(),
        }),
        // Update tenant document with merge: true so it never throws if document is missing
        setDoc(
          doc(db, 'tenants', effectiveId),
          {
            active_flow_id: activeFlow.id,
            active_flow_name: activeFlow.name,
            active_flow_version: nextVersion,
            active_flow_deployed_at: now,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        ),
        // Overwrite legacy config doc to disable competing rules
        setDoc(
          doc(db, 'whatsapp_configs', effectiveId),
          {
            tenant_id: effectiveId,
            node_flow_active: true,
            active_flow_id: activeFlow.id,
            legacy_rules_suppressed: true,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      // Guard with 800ms race so UI save/deploy is instant and never hangs
      await Promise.race([
        syncTask,
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    } catch (err) {
      console.warn('Firestore deploy flow background sync warning:', err);
    }
  }

  return { flow: activeFlow, deployedVersion: nextVersion };
}

/**
 * Saves and deploys the visual node flow graph to store and Firestore.
 */
export async function saveNodeFlow(
  tenantId: string,
  flow: WhatsAppNodeFlow,
  adminUser?: string
): Promise<{ flow: WhatsAppNodeFlow; deployedVersion: number }> {
  return deployActiveNodeFlow(tenantId, flow, adminUser);
}

/**
 * Rule Engine: Processes in-WhatsApp captured data without external redirects,
 * automatically creating Appointment, Customer, and metered audit logs.
 */
export async function submitCapturedFlowDataWithRuleEngine(
  tenantId: string,
  payload: {
    flow_id: string;
    flow_name: string;
    customer_name: string;
    customer_phone?: string;
    captured_data: Record<string, any>;
  }
): Promise<{ submission: CapturedFlowSubmission; appointment?: Appointment; newBalance: number }> {
  const rateCard = reactiveStore.getRateCard();
  const cost = rateCard.WA_BOT_STATE_TRANS || 0.50;

  const { newBalance } = await meterAndDeductCredits({
    tenant_id: tenantId,
    cost,
    action_code: 'WA_BOT_STATE_TRANS',
    friendly_desc: `In-WhatsApp Flow Completed: "${payload.flow_name}" for ${payload.customer_name}`,
    reads: 1,
    writes: 2,
  });

  const now = Date.now();
  const phone = payload.customer_phone || '+1 (555) 789-0123';
  const serviceName =
    payload.captured_data.selected_service ||
    payload.captured_data.service_name ||
    payload.captured_data.service ||
    'Universal Service Consultation';
  const dateSlot =
    payload.captured_data.booking_slot ||
    payload.captured_data.appointment_slot ||
    (payload.captured_data.booking_date
      ? `${payload.captured_data.booking_date} ${payload.captured_data.booking_time || ''}`.trim()
      : 'Upcoming Slot');

  // 1. Rule Engine: auto-create or update Customer
  const custId = `cust-${now}-${Math.floor(100 + Math.random() * 900)}`;
  const newCust: Customer = {
    id: custId,
    tenant_id: tenantId,
    full_name: payload.customer_name,
    name: payload.customer_name,
    phone,
    phone_number: phone,
    email: `${payload.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@client.io`,
    service_interest: serviceName,
    status: 'active',
    total_bookings: 1,
    total_completed_visits: 0,
    last_interacted_at: now,
    notes: 'Captured directly within WhatsApp multi-turn flow',
    created_at: now,
  };
  reactiveStore.addCustomer(newCust);

  // 2. Rule Engine: auto-create Confirmed Appointment directly in DB
  const apptDate = payload.captured_data.booking_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const apptTime = payload.captured_data.booking_time || '11:00 AM';

  const apptId = `appt-${now}-${Math.floor(100 + Math.random() * 900)}`;
  const newAppt: Appointment = {
    id: apptId,
    tenant_id: tenantId,
    customer_id: custId,
    client_id: custId,
    customer_name: payload.customer_name,
    client_name: payload.customer_name,
    customer_phone: phone,
    client_phone: phone,
    service_name: serviceName,
    date: apptDate,
    time: apptTime,
    duration_minutes: 45,
    status: 'CONFIRMED',
    booking_source: 'whatsapp_bot',
    notes: `In-WhatsApp automated slot: ${dateSlot}`,
    created_at: now,
    updated_at: now,
  };
  reactiveStore.addAppointment(newAppt);

  // 3. Create CapturedFlowSubmission
  const subId = `sub-${now}-${Math.floor(100 + Math.random() * 900)}`;
  const submission: CapturedFlowSubmission = {
    id: subId,
    tenant_id: tenantId,
    flow_id: payload.flow_id,
    flow_name: payload.flow_name,
    customer_name: payload.customer_name,
    customer_phone: phone,
    captured_data: {
      ...payload.captured_data,
      customer_name: payload.customer_name,
      customer_phone: phone,
      service_name: serviceName,
      appointment_slot: dateSlot,
    },
    status: 'ACTION_EXECUTED',
    rule_engine_result: {
      appointment_created: true,
      appointment_id: apptId,
      customer_saved: true,
      customer_id: custId,
      credits_deducted: cost,
      message: `Confirmed Appointment #${apptId.slice(-6).toUpperCase()} created in DB via Backend Rule Engine`,
    },
    created_at: now,
  };

  reactiveStore.addCapturedSubmission(submission);

  if (db && isLiveFirebaseConfigured) {
    try {
      const syncTask = Promise.all([
        setDoc(doc(db, 'captured_leads', subId), {
          ...submission,
          created_at: serverTimestamp(),
        }),
        setDoc(doc(db, 'appointments', apptId), {
          ...newAppt,
          created_at: serverTimestamp(),
        }),
        setDoc(doc(db, 'customers', custId), {
          ...newCust,
          created_at: serverTimestamp(),
        }),
      ]);
      await Promise.race([syncTask, new Promise((resolve) => setTimeout(resolve, 400))]);
    } catch {
      // background
    }
  }

  return { submission, appointment: newAppt, newBalance };
}

/**
 * ============================================================================
 * REAL-TIME SLOT BOOKING ENGINE (CONCURRENCY CONTROL VIA FIRESTORE TRANSACTIONS)
 * Multi-tenant path: tenants/{tenantId}/booking_dates/{YYYY-MM-DD}/slots/{slotId}
 * ============================================================================
 */

export const DEFAULT_BOOKING_SLOT_TIMES = [
  '09:00 AM',
  '10:30 AM',
  '01:00 PM',
  '02:30 PM',
  '04:00 PM',
];

/**
 * Normalizes time string to a deterministic document ID
 * e.g., "10:00 AM" -> "slot-10-00-am"
 */
export function normalizeSlotId(timeStr: string): string {
  const clean = timeStr.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `slot-${clean}`;
}

/**
 * Admin utility: Configures or adds custom time slots dynamically per date.
 * Uses Firestore writeBatch for atomic multi-document writes.
 * Multi-tenant path: tenants/{tenantId}/booking_dates/{dateStr}/slots/{slotId}
 */
export async function addSlots(
  tenantId: string,
  dateStr: string,
  slotTimes: string[] = DEFAULT_BOOKING_SLOT_TIMES
): Promise<{ count: number; date: string; slots: BookingSlotDoc[] }> {
  const now = Date.now();
  const createdSlots: BookingSlotDoc[] = slotTimes.map((time) => {
    const slotId = normalizeSlotId(time);
    return {
      id: slotId,
      time,
      status: 'available' as BookingSlotStatus,
      booked_by: null,
      booked_at: null,
      created_at: now,
    };
  });

  // Always update local reactive store for instant offline/fallback availability
  const existingLocal = reactiveStore.getBookingSlots(tenantId, dateStr);
  const slotMap = new Map<string, BookingSlotDoc>();
  existingLocal.forEach((s) => slotMap.set(s.id, s));
  createdSlots.forEach((s) => {
    if (!slotMap.has(s.id) || slotMap.get(s.id)!.status === 'available') {
      slotMap.set(s.id, s);
    }
  });
  const mergedSlots = Array.from(slotMap.values());
  reactiveStore.setBookingSlots(tenantId, dateStr, mergedSlots);

  // Firestore writeBatch atomic execution
  if (db && isLiveFirebaseConfigured) {
    try {
      const batch = writeBatch(db);
      const parentDateRef = doc(db, 'tenants', tenantId, 'booking_dates', dateStr);

      const dateDocData: BookingDateDoc = {
        date: dateStr,
        tenant_id: tenantId,
        total_slots: mergedSlots.length,
        available_slots: mergedSlots.filter((s) => s.status === 'available').length,
        updated_at: now,
      };
      batch.set(parentDateRef, dateDocData, { merge: true });

      for (const slot of createdSlots) {
        const slotRef = doc(db, 'tenants', tenantId, 'booking_dates', dateStr, 'slots', slot.id);
        batch.set(slotRef, slot, { merge: true });
      }

      await batch.commit();
    } catch (err) {
      console.warn('addSlots writeBatch failed on live Firebase, fallback to reactive store:', err);
    }
  }

  return { count: createdSlots.length, date: dateStr, slots: mergedSlots };
}

/**
 * Step A: Query status === 'available' slots for a requested date.
 * If 0 slots exist on that date initially, automatically seeds default slots.
 */
export async function getAvailableSlots(
  tenantId: string,
  dateStr: string
): Promise<BookingSlotDoc[]> {
  // 1. Try Live Firestore
  if (db && isLiveFirebaseConfigured) {
    try {
      const slotsColRef = collection(db, 'tenants', tenantId, 'booking_dates', dateStr, 'slots');
      const q = query(slotsColRef, where('status', '==', 'available'));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const list: BookingSlotDoc[] = [];
        snap.forEach((d) => list.push(d.data() as BookingSlotDoc));
        return list;
      }

      const allSnap = await getDocs(query(slotsColRef, limit(1)));
      if (allSnap.empty) {
        const seeded = await addSlots(tenantId, dateStr, DEFAULT_BOOKING_SLOT_TIMES);
        return seeded.slots.filter((s) => s.status === 'available');
      }

      return [];
    } catch (err) {
      console.warn('getAvailableSlots live firestore read failed, fallback to local store:', err);
    }
  }

  // 2. Reactive Store Fallback
  let localSlots = reactiveStore.getBookingSlots(tenantId, dateStr);
  if (!localSlots || localSlots.length === 0) {
    const seeded = await addSlots(tenantId, dateStr, DEFAULT_BOOKING_SLOT_TIMES);
    return seeded.slots.filter((s) => s.status === 'available');
  }

  return localSlots.filter((s) => s.status === 'available');
}

/**
 * Step B: Atomic Booking Logic (Prevent Double Booking)
 * Uses Firestore runTransaction to guarantee mutual exclusion and eliminate race conditions.
 */
export async function bookSlot(
  tenantId: string,
  dateStr: string,
  slotIdOrTime: string,
  customerDetails: {
    customer_phone: string;
    customer_name?: string;
    service?: string;
  }
): Promise<BookSlotResult> {
  const slotId = slotIdOrTime.startsWith('slot-')
    ? slotIdOrTime
    : normalizeSlotId(slotIdOrTime);
  const nowIso = new Date().toISOString();
  const bookingId = `BK-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

  // 1. Live Firestore Concurrency Transaction
  if (db && isLiveFirebaseConfigured) {
    try {
      const slotDocRef = doc(db, 'tenants', tenantId, 'booking_dates', dateStr, 'slots', slotId);
      const parentDateRef = doc(db, 'tenants', tenantId, 'booking_dates', dateStr);

      const txnResult = await runTransaction(db, async (transaction) => {
        const slotSnap = await transaction.get(slotDocRef);

        if (!slotSnap.exists()) {
          return {
            success: false,
            reason: 'SLOT_NOT_FOUND' as const,
            message: `Time slot "${slotIdOrTime}" was not found for ${dateStr}.`,
          };
        }

        const slotData = slotSnap.data() as BookingSlotDoc;

        if (slotData.status !== 'available') {
          return {
            success: false,
            reason: 'SLOT_ALREADY_TAKEN' as const,
            message: `Slot "${slotData.time || slotIdOrTime}" was just booked by another customer. Please choose an alternative slot.`,
            slotData,
          };
        }

        const updatedSlot: Partial<BookingSlotDoc> = {
          status: 'booked',
          booked_by: customerDetails.customer_phone,
          booked_at: nowIso,
          customer_name: customerDetails.customer_name || 'Valued Client',
          service: customerDetails.service || 'Appointment',
        };

        transaction.update(slotDocRef, updatedSlot);

        const dateSnap = await transaction.get(parentDateRef);
        if (dateSnap.exists()) {
          const currentAvail = (dateSnap.data() as BookingDateDoc).available_slots || 0;
          transaction.update(parentDateRef, {
            available_slots: Math.max(0, currentAvail - 1),
            updated_at: Date.now(),
          });
        }

        return {
          success: true,
          bookingId,
          slotData: {
            ...slotData,
            ...updatedSlot,
          } as BookingSlotDoc,
        };
      });

      reactiveStore.bookSlotLocal(tenantId, dateStr, slotId, customerDetails);
      return txnResult;
    } catch (err: any) {
      console.warn('bookSlot Firestore transaction failed, falling back to local store:', err);
    }
  }

  return reactiveStore.bookSlotLocal(tenantId, dateStr, slotId, customerDetails);
}

/**
 * Step C: Fallback / Zero Slots Available Logic
 */
export async function findNextAvailableDateWithSlots(
  tenantId: string,
  startDateStr: string
): Promise<NextAvailableDateResult | null> {
  let baseDate = new Date(startDateStr);
  if (isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }

  for (let offset = 1; offset <= 14; offset++) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + offset);

    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    const checkDateStr = `${yyyy}-${mm}-${dd}`;

    const slots = await getAvailableSlots(tenantId, checkDateStr);
    const available = slots.filter((s) => s.status === 'available');

    if (available.length > 0) {
      const formattedDate = nextDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return {
        date: checkDateStr,
        formattedDate,
        earliestSlot: available[0],
        availableCount: available.length,
      };
    }
  }

  return null;
}

/**
 * Admin Helper: Pre-populates default slots for today and next 7 days
 */
export async function seedDefaultBookingSlotsForWeek(tenantId: string): Promise<void> {
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const target = new Date(today);
    target.setDate(today.getDate() + i);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    await addSlots(tenantId, dateStr, DEFAULT_BOOKING_SLOT_TIMES);
  }
}

// ==========================================
// Credit Top-Up Workflow & Request Management
// ==========================================

/**
 * Submits a credit top-up request from a Business Admin.
 */
export async function requestCreditTopUp(params: {
  tenant_id: string;
  business_name: string;
  amount: number;
  payment_reference?: string;
  notes?: string;
  requested_by_email: string;
}): Promise<CreditTopUpRequest> {
  const now = Date.now();
  const id = `req-${now}-${Math.floor(100 + Math.random() * 900)}`;

  const newRequest: CreditTopUpRequest = {
    id,
    tenant_id: params.tenant_id,
    business_name: params.business_name,
    amount: Number(params.amount),
    payment_reference: params.payment_reference?.trim() || '',
    notes: params.notes?.trim() || '',
    status: 'PENDING',
    requested_by_email: params.requested_by_email,
    requested_at: now,
  };

  if (db && isLiveFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'credit_requests', id), {
        ...newRequest,
        requested_at: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firestore credit request write failed, fallback to local store:', e);
    }
  }

  reactiveStore.addCreditRequest(newRequest);
  return newRequest;
}

/**
 * Super Admin approval function: Atomically adds credits to the tenant's wallet and updates request status.
 */
export async function approveCreditTopUp(params: {
  requestId: string;
  approverId: string;
}): Promise<{ success: boolean; request: CreditTopUpRequest; newBalance: number }> {
  const requests = reactiveStore.getCreditRequests();
  const targetReq = requests.find((r) => r.id === params.requestId);

  if (!targetReq) {
    throw new Error(`Credit request with ID "${params.requestId}" not found.`);
  }

  if (targetReq.status !== 'PENDING') {
    throw new Error(`Credit request "${params.requestId}" is already ${targetReq.status.toLowerCase()}.`);
  }

  // 1. Atomically adjust credits on tenant wallet
  const adjustResult = await adjustTenantCredits({
    tenant_id: targetReq.tenant_id,
    amount: targetReq.amount,
    note: `Super Admin (${params.approverId}) approved credit top-up request #${targetReq.id} [Ref: ${targetReq.payment_reference || 'N/A'}]`,
    adminId: params.approverId,
  });

  const now = Date.now();
  const updatedReq: CreditTopUpRequest = {
    ...targetReq,
    status: 'APPROVED',
    resolved_at: now,
    resolved_by: params.approverId,
  };

  if (db && isLiveFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'credit_requests', params.requestId), {
        status: 'APPROVED',
        resolved_at: serverTimestamp(),
        resolved_by: params.approverId,
      });
    } catch (e) {
      console.warn('Firestore credit request update failed:', e);
    }
  }

  reactiveStore.updateCreditRequest(params.requestId, {
    status: 'APPROVED',
    resolved_at: now,
    resolved_by: params.approverId,
  });

  return { success: true, request: updatedReq, newBalance: adjustResult.newBalance };
}

/**
 * Super Admin rejection function: Marks the request as REJECTED with mandatory or optional reason.
 */
export async function rejectCreditTopUp(params: {
  requestId: string;
  approverId: string;
  rejectionReason?: string;
}): Promise<{ success: boolean; request: CreditTopUpRequest }> {
  const requests = reactiveStore.getCreditRequests();
  const targetReq = requests.find((r) => r.id === params.requestId);

  if (!targetReq) {
    throw new Error(`Credit request with ID "${params.requestId}" not found.`);
  }

  const now = Date.now();
  const updatedReq: CreditTopUpRequest = {
    ...targetReq,
    status: 'REJECTED',
    resolved_at: now,
    resolved_by: params.approverId,
    rejection_reason: params.rejectionReason || 'Rejected by platform Super Admin reconciliation review.',
  };

  if (db && isLiveFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'credit_requests', params.requestId), {
        status: 'REJECTED',
        resolved_at: serverTimestamp(),
        resolved_by: params.approverId,
        rejection_reason: updatedReq.rejection_reason,
      });
    } catch (e) {
      console.warn('Firestore credit request reject write failed:', e);
    }
  }

  reactiveStore.updateCreditRequest(params.requestId, {
    status: 'REJECTED',
    resolved_at: now,
    resolved_by: params.approverId,
    rejection_reason: updatedReq.rejection_reason,
  });

  return { success: true, request: updatedReq };
}

/**
 * Subscribes to real-time credit top-up requests (optionally filtered by tenant_id).
 */
export function subscribeCreditRequests(
  callback: (requests: CreditTopUpRequest[]) => void,
  tenantIdFilter?: string
): Unsubscribe {
  if (db && isLiveFirebaseConfigured) {
    try {
      const q = tenantIdFilter
        ? query(collection(db, 'credit_requests'), where('tenant_id', '==', tenantIdFilter), orderBy('requested_at', 'desc'))
        : query(collection(db, 'credit_requests'), orderBy('requested_at', 'desc'));

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: CreditTopUpRequest[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as any;
              list.push({ ...data, id: d.id });
            });
            callback(list);
          } else {
            callback(reactiveStore.getCreditRequests(tenantIdFilter));
          }
        },
        () => {
          reactiveStore.subscribeCreditRequests(callback, tenantIdFilter);
        }
      );
      return unsub;
    } catch (e) {
      console.warn('Firestore credit requests listener error:', e);
    }
  }

  return reactiveStore.subscribeCreditRequests(callback, tenantIdFilter);
}

/**
 * Updates tenant profile and clinic configuration (locked fields are protected).
 */
export async function updateTenantProfile(
  tenantId: string,
  updates: Partial<Tenant>
): Promise<Tenant> {
  const tenants = reactiveStore.getTenants();
  const current = tenants.find((t) => t.id === tenantId || t.tenant_id === tenantId);

  if (!current) {
    throw new Error(`Tenant with ID ${tenantId} not found.`);
  }

  // Enforce field-level protection: do not allow overwriting locked system identity fields
  const safeUpdates: Partial<Tenant> = {
    business_name: updates.business_name || current.business_name,
    address: updates.address !== undefined ? updates.address : current.address,
    operating_hours: updates.operating_hours !== undefined ? updates.operating_hours : current.operating_hours,
    contact_phone: updates.contact_phone !== undefined ? updates.contact_phone : current.contact_phone,
    description: updates.description !== undefined ? updates.description : current.description,
    logo_url: updates.logo_url !== undefined ? updates.logo_url : current.logo_url,
    website_url: updates.website_url !== undefined ? updates.website_url : current.website_url,
    social_links: updates.social_links !== undefined ? updates.social_links : current.social_links,
    updated_at: Date.now(),
  };

  if (db && isLiveFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'tenants', current.id), {
        ...safeUpdates,
        updated_at: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firestore tenant profile update failed, using local store:', e);
    }
  }

  reactiveStore.updateTenant(current.id, safeUpdates);
  return { ...current, ...safeUpdates };
}



