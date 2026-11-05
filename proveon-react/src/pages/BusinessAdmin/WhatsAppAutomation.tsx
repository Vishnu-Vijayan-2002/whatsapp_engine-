import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import {
  subscribeNodeFlow,
  deployActiveNodeFlow,
  subscribeCapturedSubmissions,
  getDefaultNodeFlow,
  getTenantAvailableServices,
  reactiveStore,
  testSendWhatsAppAutomationWithMetering,
} from '../../firebase/firestoreService';
import type { WhatsAppNodeFlow, CapturedFlowSubmission } from '../../types';
import NodeCanvas from '../../components/flow/NodeCanvas';
import FlowSimulator from '../../components/flow/FlowSimulator';
import CapturedSubmissionsTable from '../../components/flow/CapturedSubmissionsTable';
import './BusinessAdmin.css';
import '../SuperAdmin/SuperAdmin.css';

type BuilderTab = 'CANVAS_BUILDER' | 'SIMULATOR' | 'SUBMISSIONS';

const WhatsAppAutomationPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId, tenant, isOutOfCredits, setRechargeModalOpen } = useTenant();
  const effectiveTenantId = tenantId || tenant?.id || tenant?.tenant_id || 'ten-apex-01';

  const [activeTab, setActiveTab] = useState<BuilderTab>('CANVAS_BUILDER');
  const [nodeFlow, setNodeFlow] = useState<WhatsAppNodeFlow>(() => reactiveStore.getNodeFlow(effectiveTenantId));
  const [submissions, setSubmissions] = useState<CapturedFlowSubmission[]>([]);

  // Deployment & Dirty state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isDeployingFlow, setIsDeployingFlow] = useState<boolean>(false);

  // Simulation test phone state
  const [testPhoneNumber, setTestPhoneNumber] = useState('+1 (555) 019-2831');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Subscribe to real-time Node Flow & Captured In-WhatsApp Submissions
  // Strictly synchronizes with visual canvas without resetting to default flows
  useEffect(() => {
    if (!effectiveTenantId) return;

    const unsubFlow = subscribeNodeFlow(effectiveTenantId, (flow) => {
      if (flow && flow.nodes && flow.nodes.length > 0) {
        setNodeFlow(flow);
        setHasUnsavedChanges(false);
      }
    });

    const unsubSubs = subscribeCapturedSubmissions(effectiveTenantId, (list) => {
      setSubmissions(list);
    });

    return () => {
      unsubFlow();
      unsubSubs();
    };
  }, [effectiveTenantId]);

  // Handle flow modifications in canvas
  const handleFlowChange = (updatedFlow: WhatsAppNodeFlow) => {
    setNodeFlow(updatedFlow);
    setHasUnsavedChanges(true);
  };

  // Deploy Flow: Overwrites previous configurations, makes this the exclusive active live version
  const handleDeployFlow = async () => {
    const tid = effectiveTenantId;
    try {
      setIsDeployingFlow(true);
      const res = await deployActiveNodeFlow(
        tid,
        nodeFlow,
        tenant?.admin_email || 'Business Admin'
      );
      setNodeFlow(res.flow);
      setHasUnsavedChanges(false);
      showToast(
        `🚀 Flow deployed as ACTIVE Live Version v${res.deployedVersion}! Previous configurations overwritten. All live WhatsApp interactions now strictly follow this path.`
      );
    } catch (err: any) {
      console.error('Deploy flow error:', err);
      showToast(err.message || 'Failed to deploy flow');
    } finally {
      setIsDeployingFlow(false);
    }
  };

  // Load Single Universal Appointment & Booking Flow
  const handleLoadUniversalFlow = () => {
    const tid = effectiveTenantId;
    const biz = tenant?.business_name || 'Our Business';
    const services = getTenantAvailableServices(tenant);
    const universalFlow = getDefaultNodeFlow(tid, biz, services);
    setNodeFlow(universalFlow);
    setHasUnsavedChanges(true);
    showToast('Loaded "Universal Appointment & Booking Flow" (Draft). Click "⚡ Deploy Node Flow" to make it live!');
  };

  // Live real phone test dispatch
  const handleTestSend = async () => {
    if (isOutOfCredits) {
      setRechargeModalOpen(true);
      return;
    }
    if (!testPhoneNumber.trim()) {
      showToast('Please enter a phone number to test.');
      return;
    }

    try {
      setIsSendingTest(true);
      const res = await testSendWhatsAppAutomationWithMetering(
        tenantId,
        nodeFlow.name || 'Visual WhatsApp Flow',
        testPhoneNumber.trim()
      );
      showToast(
        `⚡ Active WhatsApp flow (v${res.activeFlowVersion || nodeFlow.version || 1}) dispatched to ${testPhoneNumber}! Deducted ${res.creditsDeducted.toFixed(2)} credits.`
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch test flow');
    } finally {
      setIsSendingTest(false);
    }
  };

  const waba = tenant?.waba_integration;

  return (
    <div className="dashstack-overview">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="super-toast success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="dash-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 className="dash-page-title" style={{ margin: 0 }}>Visual WhatsApp Flow Builder</h1>
            <span className="active-flow-live-pill">
              <span className="live-dot"></span>
              LIVE v{nodeFlow.version || 1} ACTIVE
            </span>
            {hasUnsavedChanges ? (
              <span className="unsaved-changes-pill">● Draft Changes Unsaved</span>
            ) : (
              <span className="exclusive-routing-pill">✓ Exclusive Active Live Route</span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '5px' }}>
            {tenant?.business_name || 'Business'} • Design conversational flows that capture data directly in WhatsApp without external redirects.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary-action"
            onClick={() => setActiveTab(activeTab === 'CANVAS_BUILDER' ? 'SIMULATOR' : 'CANVAS_BUILDER')}
          >
            {activeTab === 'CANVAS_BUILDER' ? '📱 Open Live Phone Simulator' : '🔀 Back to Canvas'}
          </button>

          <button
            type="button"
            className="btn-primary-action"
            onClick={handleDeployFlow}
            disabled={isDeployingFlow}
            style={{
              background: hasUnsavedChanges ? 'linear-gradient(135deg, #00A884 0%, #059669 100%)' : undefined,
              boxShadow: hasUnsavedChanges ? '0 4px 14px rgba(0, 168, 132, 0.4)' : undefined,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
            </svg>
            {isDeployingFlow
              ? 'Deploying to Live WhatsApp...'
              : hasUnsavedChanges
              ? '⚡ Deploy Node Flow (Make Live)'
              : `✓ Live Active v${nodeFlow.version || 1}`}
          </button>
        </div>
      </div>

      {/* Single-Active Deployment Notice Banner */}
      <div className="deploy-banner-active">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span>
            <strong>Strict Single-Active Routing:</strong> When you click <strong>Deploy Node Flow</strong>, this version becomes the sole authoritative live version (v{(nodeFlow.version || 1) + (hasUnsavedChanges ? 1 : 0)}). All previous configurations and legacy rules are strictly overwritten so that no other flow interferes with incoming customer messages.
          </span>
        </div>
        {nodeFlow.deployed_at && (
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Last Deployed: {new Date(nodeFlow.deployed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* WABA Status Strip */}
      <div className="waba-status-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#00a884', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                Meta WhatsApp Business API Integration
              </strong>
              <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 182, 155, 0.12)', color: '#00B69B' }}>
                {waba?.status || 'CONNECTED'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '18px', marginTop: '3px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <span>Phone: <strong>{waba?.display_phone_number || tenant?.admin_phone || '+1 (555) 019-2831'}</strong></span>
              <span>WABA ID: <code style={{ fontSize: '11px' }}>{waba?.waba_account_id || 'waba_991827361'}</code></span>
              <span>Quality: <strong style={{ color: '#00B69B' }}>{waba?.quality_rating || 'HIGH (GREEN)'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher & Template Selector Bar */}
      <div className="flow-template-selector" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Main Mode Tabs */}
          <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-input)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              type="button"
              className={`btn-secondary-action ${activeTab === 'CANVAS_BUILDER' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'CANVAS_BUILDER' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'CANVAS_BUILDER' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
              }}
              onClick={() => setActiveTab('CANVAS_BUILDER')}
            >
              🔀 Visual Drag & Drop Canvas
            </button>

            <button
              type="button"
              className={`btn-secondary-action ${activeTab === 'SIMULATOR' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'SIMULATOR' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'SIMULATOR' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
              }}
              onClick={() => setActiveTab('SIMULATOR')}
            >
              📱 Live WhatsApp Phone Simulator
            </button>

            <button
              type="button"
              className={`btn-secondary-action ${activeTab === 'SUBMISSIONS' ? 'active' : ''}`}
              style={{
                border: 'none',
                background: activeTab === 'SUBMISSIONS' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'SUBMISSIONS' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
              }}
              onClick={() => setActiveTab('SUBMISSIONS')}
            >
              📊 Captured Leads & Bookings ({submissions.length})
            </button>
          </div>

          {/* Universal Preset Loader */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Universal Architecture:</span>
            <button
              type="button"
              className="preset-pill-btn"
              onClick={handleLoadUniversalFlow}
              title="Reset canvas to the standard Universal Appointment & Booking Flow"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0, 168, 132, 0.12)',
                color: '#00A884',
                borderColor: 'rgba(0, 168, 132, 0.3)',
                fontWeight: 700,
              }}
            >
              ⚡ Load Universal Booking Flow
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: Visual Drag-and-Drop Node Canvas */}
      {activeTab === 'CANVAS_BUILDER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Canvas Subheader / Guide */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '12px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="live-beacon">
                <span className="beacon-dot"></span>
                ACTIVE LIVE FLOW
              </span>
              <strong style={{ fontSize: '14.5px', color: 'var(--text-main)' }}>
                {nodeFlow.name}
              </strong>
              <span className="active-flow-live-pill" style={{ padding: '2px 8px', fontSize: '11px' }}>
                v{nodeFlow.version || 1}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                ({nodeFlow.nodes.length} Nodes, {nodeFlow.edges.length} Branches)
              </span>
              {hasUnsavedChanges && (
                <span className="unsaved-changes-pill" style={{ padding: '2px 8px', fontSize: '11px' }}>
                  ● Unsaved Edits
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                💡 Select node & click <strong>+ Add Node</strong> to auto-connect.
              </div>
              <button
                type="button"
                className="btn-primary-action"
                onClick={handleDeployFlow}
                disabled={isDeployingFlow}
                style={{
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  background: hasUnsavedChanges ? 'linear-gradient(135deg, #00A884 0%, #059669 100%)' : undefined,
                  boxShadow: hasUnsavedChanges ? '0 4px 12px rgba(0, 168, 132, 0.4)' : undefined,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                </svg>
                {isDeployingFlow
                  ? 'Deploying...'
                  : hasUnsavedChanges
                  ? '⚡ Deploy Node Flow'
                  : `✓ Deployed Live (v${nodeFlow.version || 1})`}
              </button>
            </div>
          </div>

          {/* The Visual Canvas */}
          <NodeCanvas
            flow={nodeFlow}
            onChange={handleFlowChange}
          />

          {/* Live Phone Test Strip */}
          <div className="flow-step-card" style={{ background: 'var(--bg-input)', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--text-main)', display: 'block' }}>
                  Live Real-Device WhatsApp Test Dispatch
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Sends a real test execution of this visual flow to any WhatsApp phone number (Meters 0.50 credits).
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="tel"
                  className="form-input"
                  style={{ width: '190px', background: 'var(--bg-card)' }}
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
                <button
                  type="button"
                  className="btn-primary-action"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={handleTestSend}
                  disabled={isSendingTest || isOutOfCredits}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  {isSendingTest ? 'Sending...' : '⚡ Test Reply (-0.50 cr)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live In-WhatsApp Phone Simulator */}
      {activeTab === 'SIMULATOR' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>
          <div>
            <div className="flow-submissions-card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span className="live-beacon">
                  <span className="beacon-dot"></span>
                  LIVE IN-CHAT RULE ENGINE TEST
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>
                Direct WhatsApp Data Capture Simulator
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.5, margin: 0 }}>
                Test the multi-turn conversational flow right on the phone on the right. When you answer the prompts, data is captured in variables, evaluated through conditional logic, and the Backend Rule Engine automatically creates the <strong>Confirmed Appointment</strong> and <strong>Customer Record</strong> directly in your database!
              </p>
            </div>

            {/* Submissions processed preview */}
            <CapturedSubmissionsTable
              submissions={submissions.slice(0, 3)}
              onNavigateAppointments={() => navigate('/app/customers')}
              onNavigateCustomers={() => navigate('/app/customers')}
            />
          </div>

          {/* Realistic Phone Simulator Component */}
          <FlowSimulator
            key={`${nodeFlow.id}-v${nodeFlow.version || 1}-${JSON.stringify(nodeFlow.nodes.map((n) => [n.id, n.data]))}`}
            flow={nodeFlow}
            tenantId={effectiveTenantId}
            tenantName={tenant?.business_name || 'Apex Aesthetics'}
            onSubmissionCreated={() => {
              showToast('Rule Engine automatically booked Appointment in database!');
            }}
          />
        </div>
      )}

      {/* TAB 3: Direct In-WhatsApp Submissions & Captured Leads */}
      {activeTab === 'SUBMISSIONS' && (
        <div>
          <CapturedSubmissionsTable
            submissions={submissions}
            onNavigateAppointments={() => navigate('/app/customers')}
            onNavigateCustomers={() => navigate('/app/customers')}
          />
        </div>
      )}
    </div>
  );
};

export default WhatsAppAutomationPage;
