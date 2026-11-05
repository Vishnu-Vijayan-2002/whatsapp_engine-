export type TenantVertical = 'Clinic' | 'Salon' | 'Wellness Center' | 'Dental Care' | 'Aesthetics Studio';

export type TenantStatus = 'Active' | 'Suspended' | 'Low Balance';

export type UserRole = 'super_admin' | 'business_admin';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  tenant_id?: string;
  status: 'active' | 'suspended';
  name?: string;
  created_at?: any;
}

export interface CreditWallet {
  balance: number;
  lifetime_granted: number;
  lifetime_consumed: number;
  low_balance_threshold: number;
  last_deduction_at?: any;
}

export interface WabaIntegration {
  phone_number_id: string;
  waba_account_id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  status?: 'CONNECTED' | 'DISCONNECTED' | 'PENDING';
}

export interface Tenant {
  id: string;
  tenant_id: string;
  business_name: string;
  vertical: TenantVertical;
  status: TenantStatus;
  admin_name?: string;
  admin_email?: string;
  admin_phone?: string;
  credit_wallet: CreditWallet;
  waba_integration: WabaIntegration;
  active_flow_id?: string;
  active_flow_name?: string;
  active_flow_version?: number;
  active_flow_deployed_at?: number;
  created_at?: any;
  updated_at?: any;
}

export type ActionCode = 
  | 'DB_READ_BURST'
  | 'DB_WRITE_MUTATION'
  | 'STORAGE_INGEST_MB'
  | 'WA_INBOUND_PROCESS'
  | 'WA_BOT_STATE_TRANS'
  | 'AUTOMATED_JOB_DISPATCH'
  | 'MANUAL_TOPUP'
  | 'MANUAL_ADJUSTMENT';

export interface AuditLogActor {
  userId: string;
  role: string;
  email?: string;
}

export interface AuditLogOperation {
  action_code: ActionCode;
  description?: string;
  endpoint?: string;
}

export interface AuditLogMetrics {
  executionTimeMs: number;
  dbReads: number;
  dbWrites: number;
  storageMb?: number;
}

export interface AuditLogFinancials {
  credits_deducted: number;
  balance_prior: number;
  balance_post: number;
}

export interface UsageAuditLog {
  id?: string;
  log_id: string;
  tenant_id: string;
  business_name?: string;
  actor: AuditLogActor;
  operation: AuditLogOperation;
  metrics: AuditLogMetrics;
  financials: AuditLogFinancials;
  timestamp: any;
}

export interface RateCardConfig {
  DB_READ_BURST: number;
  DB_WRITE_MUTATION: number;
  STORAGE_INGEST_MB: number;
  WA_INBOUND_PROCESS: number;
  WA_BOT_STATE_TRANS: number;
  AUTOMATED_JOB_DISPATCH: number;
  updated_at?: any;
  updated_by?: string;
}

export const DEFAULT_RATE_CARD: RateCardConfig = {
  DB_READ_BURST: 0.10,
  DB_WRITE_MUTATION: 0.50,
  STORAGE_INGEST_MB: 1.00,
  WA_INBOUND_PROCESS: 0.25,
  WA_BOT_STATE_TRANS: 0.50,
  AUTOMATED_JOB_DISPATCH: 0.50,
};

export interface Customer {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string;
  email: string;
  service_interest: string;
  notes?: string;
  created_at: any;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  date: string;
  time: string;
  status: 'CONFIRMED' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  created_at: any;
}

export interface MediaFile {
  id: string;
  tenant_id: string;
  file_name: string;
  file_type: string;
  file_size_mb: number;
  url: string;
  category: 'CLINIC_XRAY' | 'PORTFOLIO_IMAGE' | 'CONSENT_FORM' | 'OTHER';
  credits_metered: number;
  uploaded_at: any;
}

export type ButtonActionType = 'BOOKING_LINK' | 'REPLY_TEXT' | 'VIEW_SERVICES' | 'TALK_TO_STAFF';

export interface WhatsAppButton {
  id: string;
  title: string;
  action_payload: string;
  action_type?: ButtonActionType;
  action_value?: string;
}

// ============================================================================
// Node-Based Visual Flow Builder Types
// ============================================================================

export type FlowNodeType =
  | 'TRIGGER'
  | 'MESSAGE'
  | 'USER_INPUT'
  | 'CONDITION'
  | 'BACKEND_ACTION'
  | 'TERMINAL'
  | 'SUPPORT_HELPDESK';

export interface TriggerNodeData {
  keywords: string[];
  matchType: 'CONTAINS' | 'EXACT';
  description?: string;
}

export interface MessageNodeData {
  header?: string;
  body: string;
  quickReplies?: string[];
}

export interface UserInputNodeData {
  prompt: string;
  variableName: string; // e.g. customer_name, service_name, appointment_date, notes
  inputType: 'text' | 'phone' | 'choice' | 'date';
  options?: string[]; // for choice input
  required: boolean;
  validationMessage?: string;
}

export interface ConditionNodeData {
  variableName: string;
  operator: 'EQUALS' | 'CONTAINS' | 'NOT_EQUALS' | 'IS_EMPTY';
  compareValue: string;
}

export interface BackendActionNodeData {
  actionType: 'CREATE_APPOINTMENT' | 'SAVE_CUSTOMER' | 'NOTIFY_STAFF' | 'EXECUTE_RULE_ENGINE';
  description: string;
  autoConfirm: boolean;
  creditCost: number;
}

export interface TerminalNodeData {
  body: string;
  includeSummary: boolean;
  chainedFlowTrigger?: string; // keyword to trigger chained flow (e.g. 'review')
  chainedFlowName?: string;    // label of chained flow (e.g. 'Rating Triage Flow')
  delaySeconds?: number;
}

export interface SupportHelpdeskFaqItem {
  id?: string;
  question: string;
  answer: string;
}

export interface SupportHelpdeskNodeData {
  header?: string;
  phone?: string;
  email?: string;
  address?: string;
  workingHours?: string;
  mapsUrl?: string;
  faqs?: SupportHelpdeskFaqItem[];
  options?: string[];
  variableName?: string;
  enableLiveAgentHandoff?: boolean;
}

export interface SupportNodeData {
  hotlinePhone?: string;
  supportEmail?: string;
  businessHours?: string;
  transferToAgent?: boolean;
  allowLoopBack?: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes?: number;
}

export interface ServiceCatalogNodeData {
  prompt: string;
  services: ServiceItem[];
  variableName: string;
}

export interface ConsultantItem {
  id: string;
  name: string;
  department: string;
  title: string;
  consultationFee?: number;
}

export interface ConsultantSelectionNodeData {
  prompt: string;
  consultants: ConsultantItem[];
  variableName: string;
}

export interface SlotBookingNodeData {
  prompt: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  slotDurationMinutes?: number;
  holidays?: string[];
  variableName: string;
}

export type NodeDataPayload =
  | TriggerNodeData
  | MessageNodeData
  | UserInputNodeData
  | ConditionNodeData
  | BackendActionNodeData
  | TerminalNodeData
  | SupportHelpdeskNodeData
  | SupportNodeData
  | ServiceCatalogNodeData
  | ConsultantSelectionNodeData
  | SlotBookingNodeData
  | Record<string, any>;

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  data: NodeDataPayload;
}

export interface FlowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: 'default' | 'true' | 'false' | string;
  targetHandle?: string;
  label?: string;
}

export interface WhatsAppNodeFlow {
  id: string;
  name: string;
  tenant_id: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  updated_at: any;
  status?: 'ACTIVE' | 'DRAFT';
  is_active?: boolean;
  version?: number;
  deployed_at?: number;
  deployed_by?: string;
  execution_policy?: 'EXCLUSIVE_ACTIVE';
}

export interface WhatsAppSessionState {
  user_phone: string;
  active_flow_id: string;
  current_step: string;
  collected_data: Record<string, any>;
  updated_at?: any;
}

export interface CapturedFlowSubmission {
  id: string;
  tenant_id: string;
  flow_id: string;
  flow_name: string;
  customer_name: string;
  customer_phone: string;
  captured_data: Record<string, any>;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'ACTION_EXECUTED';
  rule_engine_result: {
    appointment_created?: boolean;
    appointment_id?: string;
    customer_saved?: boolean;
    customer_id?: string;
    credits_deducted: number;
    message: string;
  };
  created_at: any;
}

export interface WhatsAppFlowConfig {
  tenant_id: string;
  flow_name: string;
  template_type: 'CLINIC_STARTER' | 'SALON_STARTER' | 'FOLLOWUP_SURVEY' | 'CUSTOM';
  trigger_keywords: string[];
  header_text: string;
  body_text: string;
  buttons: WhatsAppButton[];
  updated_at?: any;
}

export interface WhatsAppFollowUpRule {
  id: string;
  title: string;
  trigger_timing: string;
  enabled: boolean;
  template_text: string;
  credits_per_dispatch: number;
}

export interface WhatsAppAutomationConfig {
  tenant_id: string;
  welcome_flow: {
    enabled: boolean;
    trigger_keywords: string[];
    header_text: string;
    body_text: string;
    buttons: WhatsAppButton[];
  };
  followup_rules: WhatsAppFollowUpRule[];
  waba_integration?: WabaIntegration;
  updated_at?: any;
}


