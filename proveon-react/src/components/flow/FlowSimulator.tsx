import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { WhatsAppNodeFlow, FlowNode, TerminalNodeData } from '../../types';
import {
  submitCapturedFlowDataWithRuleEngine,
  saveWhatsAppSession,
  resetWhatsAppSession,
  checkSlotCollision,
} from '../../firebase/firestoreService';

interface FlowSimulatorProps {
  flow: WhatsAppNodeFlow;
  tenantId: string;
  tenantName?: string;
  onSubmissionCreated?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user' | 'system';
  header?: string;
  text: string;
  time: string;
  choices?: string[];
  isActionFeedback?: boolean;
  isDateSlotPicker?: boolean;
}

let msgSeq = 100;
const nextMsgId = (prefix: string = 'msg') => `${prefix}-${++msgSeq}`;

const formatTime = () => {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// WhatsApp In-Chat Calendar & Time Slot Picker Component
interface WhatsAppCalendarPickerProps {
  onSelectSlot: (slotStr: string) => void;
}

// Lazy initialization for appointment calendar picker
const getInitialPickerData = () => {
  const baseNow = Date.now();
  const dates = [1, 2, 3, 4].map((offset) => {
    const d = new Date(baseNow + offset * 86400000);
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return { iso, label, offset };
  });
  return {
    quickDates: dates,
    defaultDate: dates[0].iso,
    minDate: new Date(baseNow).toISOString().split('T')[0],
  };
};

const WhatsAppCalendarPicker: React.FC<WhatsAppCalendarPickerProps> = ({ onSelectSlot }) => {
  const [pickerData] = useState(getInitialPickerData);
  const [selectedDate, setSelectedDate] = useState<string>(pickerData.defaultDate);
  const [selectedTime, setSelectedTime] = useState<string>('02:00 PM');

  const { quickDates, minDate } = pickerData;
  const timeSlots = ['09:30 AM', '11:00 AM', '02:00 PM', '03:30 PM', '05:00 PM', '06:30 PM'];

  const chosenObj = quickDates.find((q) => q.iso === selectedDate);
  const formattedDateLabel = chosenObj
    ? chosenObj.label
    : selectedDate;

  const handleConfirm = () => {
    onSelectSlot(`${formattedDateLabel} at ${selectedTime}`);
  };

  return (
    <div className="wa-calendar-slot-picker">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="wa-picker-section-title">📅 Choose Appointment Date</span>
        <span style={{ fontSize: '10px', color: '#00A884', fontWeight: 700 }}>Interactive Calendar</span>
      </div>

      {/* Quick Date Chips */}
      <div className="wa-date-chips-row">
        {quickDates.map((q) => (
          <button
            key={q.iso}
            type="button"
            className={`wa-date-chip ${selectedDate === q.iso ? 'selected' : ''}`}
            onClick={() => setSelectedDate(q.iso)}
          >
            {q.offset === 1 ? `Tomorrow (${q.label})` : q.label}
          </button>
        ))}
      </div>

      {/* Native HTML5 Calendar Picker for Custom Date Selection */}
      <div style={{ marginTop: '2px' }}>
        <input
          type="date"
          className="wa-native-date-input"
          value={selectedDate}
          min={minDate}
          onChange={(e) => {
            if (e.target.value) setSelectedDate(e.target.value);
          }}
          title="Pick custom date from calendar"
        />
      </div>

      <span className="wa-picker-section-title" style={{ marginTop: '4px' }}>⏰ Select Preferred Time Slot</span>
      <div className="wa-time-chips-grid">
        {timeSlots.map((time) => (
          <button
            key={time}
            type="button"
            className={`wa-time-chip ${selectedTime === time ? 'selected' : ''}`}
            onClick={() => setSelectedTime(time)}
          >
            {time}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="wa-confirm-slot-btn"
        onClick={handleConfirm}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Confirm Slot: {formattedDateLabel} at {selectedTime}</span>
      </button>
    </div>
  );
};

// Universal Variable Interpolation Helper
const interpolateVars = (
  template: string,
  vars: Record<string, string>,
  tenantName: string = 'Our Business'
): string => {
  if (!template) return '';
  const enriched: Record<string, string> = {
    ...vars,
    business_name: tenantName || vars.business_name || 'Our Business',
    customer_name: vars.customer_name || 'Valued Client',
    selected_doctor: vars.selected_doctor || 'Lead Consultant',
    doctor_name: vars.selected_doctor || 'Lead Consultant',
    selected_service: vars.selected_service || vars.service_name || 'Universal Consultation',
    service_name: vars.selected_service || vars.service_name || 'Universal Consultation',
    booking_date: vars.booking_date || 'Upcoming Date',
    booking_time: vars.booking_time || 'Scheduled Time',
    booking_slot: vars.booking_slot || vars.appointment_slot || 'Confirmed Slot',
    appointment_slot: vars.booking_slot || vars.appointment_slot || 'Confirmed Slot',
    booking_id: vars.booking_id || 'BK-1082',
    rating: vars.rating || '5 Stars',
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, key) => {
    return enriched[key] !== undefined ? enriched[key] : `[${key}]`;
  });
};

// Safe Keyword Normalization for trigger matching
const getNormalizedKeywords = (raw: any): string[] => {
  if (!raw) return ['hi', 'hello', 'book', 'appointment', 'start', 'schedule', 'doctor', 'consultation'];
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.flatMap((item) => String(item).split(','));
  } else if (typeof raw === 'string') {
    list = raw.split(',');
  } else {
    list = [String(raw)];
  }
  const cleaned = list.map((s) => s.trim().toLowerCase()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : ['hi', 'hello', 'book', 'appointment', 'start', 'schedule', 'doctor', 'consultation'];
};

export const FlowSimulator: React.FC<FlowSimulatorProps> = ({
  flow,
  tenantId,
  tenantName = 'Universal Business Hub',
  onSubmissionCreated,
}) => {
  const SIMULATOR_PHONE = '+1 (555) 019-2831';

  // State synchronization with currently deployed canvas graph
  const [activeExecutingFlow, setActiveExecutingFlow] = useState<WhatsAppNodeFlow>(flow);
  const computeFlowKey = (f: WhatsAppNodeFlow) =>
    `${f.id}-${f.version || 1}-${f.nodes.length}-${f.edges.length}-${f.nodes.map((n) => `${n.id}:${(n.data as any)?.variableName || ''}:${(n.data as any)?.prompt || ''}`).join('|')}`;

  const [prevFlowKey, setPrevFlowKey] = useState<string>(computeFlowKey(flow));

  const currentFlowKey = computeFlowKey(flow);
  if (prevFlowKey !== currentFlowKey) {
    setPrevFlowKey(currentFlowKey);
    setActiveExecutingFlow(flow);
  }

  // Session State Variables
  const [capturedVariables, setCapturedVariables] = useState<Record<string, string>>({});
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [flowStarted, setFlowStarted] = useState<boolean>(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const [isProcessingRuleEngine, setIsProcessingRuleEngine] = useState(false);
  const [completedNotification, setCompletedNotification] = useState<string | null>(null);

  const triggerNode = activeExecutingFlow.nodes.find((n) => n.type === 'TRIGGER') || activeExecutingFlow.nodes[0];
  const triggerKeywords: string[] = getNormalizedKeywords((triggerNode?.data as any)?.keywords);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initTrigger = flow.nodes.find((n) => n.type === 'TRIGGER') || flow.nodes[0];
    const initKeywords = getNormalizedKeywords((initTrigger?.data as any)?.keywords);
    const sampleKeyword = initKeywords[0] || 'hi';
    return [
      {
        id: nextMsgId('sys-cue'),
        sender: 'system',
        text: `📱 Universal WhatsApp Simulation Ready • Send any trigger keyword like "${sampleKeyword}" to begin scheduling.`,
        time: formatTime(),
      },
    ];
  });

  // Reference for recursive step execution
  const processFlowStepRef = useRef<(node: FlowNode | null, currentVars: Record<string, string>) => void>(() => {});

  // State Router: dynamically evaluates next node strictly from deployed canvas edges
  const getNextNode = useCallback(
    (sourceNodeId: string, handle: string = 'default'): FlowNode | null => {
      let edge = activeExecutingFlow.edges.find((e) => {
        if (e.sourceNodeId !== sourceNodeId) return false;
        if (handle === 'default') {
          return !e.sourceHandle || e.sourceHandle === 'default' || e.sourceHandle === 'right' || e.sourceHandle === 'output';
        }
        return (
          e.sourceHandle === handle ||
          (e.label && (
            e.label.toLowerCase() === handle.toLowerCase() ||
            handle.toLowerCase().includes(e.label.toLowerCase()) ||
            e.label.toLowerCase().includes(handle.toLowerCase())
          ))
        );
      });

      // Partial keyword matching for multi-branch options
      if (!edge && handle !== 'default') {
        const cleanInput = handle.toLowerCase();
        edge = activeExecutingFlow.edges.find((e) => {
          if (e.sourceNodeId !== sourceNodeId) return false;
          const cleanH = String(e.sourceHandle || e.label || '').toLowerCase();
          return (
            (cleanInput.includes('doctor') && cleanH.includes('doctor')) ||
            (cleanInput.includes('consult') && cleanH.includes('consult')) ||
            (cleanInput.includes('service') && cleanH.includes('service')) ||
            (cleanInput.includes('help') && cleanH.includes('help')) ||
            (cleanInput.includes('support') && cleanH.includes('support')) ||
            (cleanInput.includes('call') && cleanH.includes('call')) ||
            (cleanInput.includes('agent') && cleanH.includes('agent')) ||
            (cleanInput.includes('location') && cleanH.includes('location')) ||
            (cleanInput.includes('hour') && cleanH.includes('hour')) ||
            (cleanInput.includes('faq') && cleanH.includes('faq')) ||
            (cleanInput.includes('message') && cleanH.includes('message')) ||
            (cleanH && (cleanInput.includes(cleanH) || cleanH.includes(cleanInput)))
          );
        });
      }

      if (!edge) {
        edge = activeExecutingFlow.edges.find((e) => e.sourceNodeId === sourceNodeId);
      }

      if (!edge) return null;
      return activeExecutingFlow.nodes.find((n) => n.id === edge.targetNodeId) || null;
    },
    [activeExecutingFlow]
  );

  // Evaluate condition node
  const evaluateCondition = (node: FlowNode, vars: Record<string, string>): boolean => {
    const data = node.data as any;
    const varValue = (vars[data.variableName] || '').toLowerCase().trim();
    const compareValue = (data.compareValue || '').toLowerCase().trim();
    const operator = data.operator || 'CONTAINS';

    switch (operator) {
      case 'EQUALS':
        return varValue === compareValue;
      case 'NOT_EQUALS':
        return varValue !== compareValue;
      case 'CONTAINS':
        return varValue.includes(compareValue);
      case 'IS_EMPTY':
        return !varValue;
      default:
        return true;
    }
  };

  // Step through non-blocking nodes
  useEffect(() => {
    processFlowStepRef.current = async (node: FlowNode | null, currentVars: Record<string, string>) => {
      if (!node) return;

      if (node.type === 'MESSAGE') {
        const data = node.data as any;
        const msgText = interpolateVars(data.body || '', currentVars, tenantName);
        const headerText = data.header ? interpolateVars(data.header, currentVars, tenantName) : tenantName;

        let choices: string[] | undefined = undefined;
        if (data.options && Array.isArray(data.options) && data.options.length > 0) {
          choices = data.options;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId('bot-msg'),
            sender: 'bot',
            header: headerText,
            text: msgText,
            choices,
            time: formatTime(),
          },
        ]);

        // If interactive options are attached to this message, wait for user selection
        if (choices && choices.length > 0) {
          setActiveNodeId(node.id);
          return;
        }

        let next = getNextNode(node.id, 'default');
        if (!next) {
          const currentIndex = activeExecutingFlow.nodes.findIndex((n) => n.id === node.id);
          if (currentIndex !== -1 && currentIndex + 1 < activeExecutingFlow.nodes.length) {
            next = activeExecutingFlow.nodes[currentIndex + 1];
          }
        }
        if (next) {
          setTimeout(() => processFlowStepRef.current(next, currentVars), 350);
        }
      } else if (node.type === 'USER_INPUT') {
        const data = node.data as any;
        const promptText = interpolateVars(data.prompt || 'Please provide your input:', currentVars, tenantName);

        let choices: string[] | undefined = undefined;
        if (data.services && Array.isArray(data.services) && data.services.length > 0) {
          choices = data.services.map((s: any) => `${s.name} ($${s.price ?? 50})`);
        } else if (data.inputType === 'choice' || data.options) {
          if (Array.isArray(data.options)) {
            choices = data.options.flatMap((s: any) => String(s).split(',')).map((s: string) => s.trim()).filter(Boolean);
          } else if (typeof data.options === 'string') {
            choices = data.options.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }

        const vName = String(data.variableName || '').toLowerCase();
        const pText = String(data.prompt || '').toLowerCase();
        const isDateSlotNode =
          data.inputType === 'date' ||
          vName.includes('slot') ||
          vName.includes('date') ||
          vName.includes('time') ||
          pText.includes('date and time') ||
          pText.includes('what date') ||
          pText.includes('preferred date') ||
          pText.includes('slot');

        setActiveNodeId(node.id);
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId('bot-prompt'),
            sender: 'bot',
            text: promptText,
            choices,
            isDateSlotPicker: isDateSlotNode,
            time: formatTime(),
          },
        ]);
      } else if (node.type === 'CONDITION') {
        const isTrue = evaluateCondition(node, currentVars);
        const targetHandle = isTrue ? 'true' : 'false';
        let next = getNextNode(node.id, targetHandle) || getNextNode(node.id, 'default');
        if (!next) {
          const edge = activeExecutingFlow.edges.find(
            (e) => e.sourceNodeId === node.id && (e.sourceHandle === targetHandle || e.label?.toLowerCase() === targetHandle)
          );
          if (edge) next = activeExecutingFlow.nodes.find((n) => n.id === edge.targetNodeId) || null;
        }
        if (!next) {
          const currentIndex = activeExecutingFlow.nodes.findIndex((n) => n.id === node.id);
          if (currentIndex !== -1 && currentIndex + 1 < activeExecutingFlow.nodes.length) {
            next = activeExecutingFlow.nodes[currentIndex + 1];
          }
        }

        if (next) {
          setTimeout(() => processFlowStepRef.current(next, currentVars), 250);
        }
      } else if (node.type === 'BACKEND_ACTION') {
        setIsProcessingRuleEngine(true);
        const data = node.data as any;
        try {
          const res = await submitCapturedFlowDataWithRuleEngine(tenantId, {
            flow_id: activeExecutingFlow.id,
            flow_name: activeExecutingFlow.name,
            customer_name: currentVars.customer_name || 'Client',
            customer_phone: SIMULATOR_PHONE,
            captured_data: currentVars,
          });

          const bookingRef = res.appointment?.id.slice(-6).toUpperCase() || 'BK-1082';
          currentVars.booking_id = bookingRef;

          setMessages((prev) => [
            ...prev,
            {
              id: nextMsgId('rule-engine-confirm'),
              sender: 'system',
              text: `⚡ RULE ENGINE EXECUTED: ${data.description || 'Booking auto-created in database'} (Ref #${bookingRef}). Metered ${data.creditCost || 0.50} cr.`,
              time: formatTime(),
              isActionFeedback: true,
            },
          ]);

          if (onSubmissionCreated) {
            onSubmissionCreated();
          }

          let next = getNextNode(node.id, 'default');
          if (!next) {
            const currentIndex = activeExecutingFlow.nodes.findIndex((n) => n.id === node.id);
            if (currentIndex !== -1 && currentIndex + 1 < activeExecutingFlow.nodes.length) {
              next = activeExecutingFlow.nodes[currentIndex + 1];
            }
          }
          if (next) {
            setTimeout(() => processFlowStepRef.current(next, currentVars), 350);
          }
        } catch (err: any) {
          console.warn('Simulator rule engine execution error:', err);
        } finally {
          setIsProcessingRuleEngine(false);
        }
      } else if (node.type === 'SUPPORT_HELPDESK') {
        const data = node.data as any;
        const headerText = interpolateVars(
          data.header || 'How can our support team assist you today?',
          currentVars,
          tenantName
        );

        let choices: string[] = [
          'Direct Call / Live Agent',
          'Location & Working Hours',
          'Frequently Asked Questions (FAQ)',
          'Leave a Message',
        ];
        if (data.options && Array.isArray(data.options) && data.options.length > 0) {
          choices = data.options;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId('bot-support-header'),
            sender: 'bot',
            header: `${tenantName} • Support & Helpdesk`,
            text: headerText,
            choices,
            time: formatTime(),
          },
        ]);

        setActiveNodeId(node.id);
        return;
      } else if (node.type === 'TERMINAL') {
        const data = node.data as TerminalNodeData;
        const receiptText = interpolateVars(
          data.body || '🎉 Booking confirmed! Thank you.',
          currentVars,
          tenantName
        );

        setActiveNodeId(null);
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId('bot-receipt'),
            sender: 'bot',
            text: receiptText,
            time: formatTime(),
          },
        ]);

        setCompletedNotification(
          `Universal Flow Completed! Session for "${currentVars.customer_name || 'Client'}" stored in database.`
        );

        // Save terminal completed state in DB session (non-blocking)
        saveWhatsAppSession(tenantId, {
          user_phone: SIMULATOR_PHONE,
          active_flow_id: activeExecutingFlow.id,
          current_step: 'COMPLETED',
          collected_data: currentVars,
        }).catch(console.warn);
      }
    };
  });

  // Restart chat manually & reset database session
  const handleResetChat = () => {
    setActiveExecutingFlow(flow);
    setCapturedVariables({});
    setActiveNodeId(null);
    setFlowStarted(false);
    setInputBuffer('');
    setCompletedNotification(null);

    // Non-blocking session reset
    resetWhatsAppSession(tenantId, SIMULATOR_PHONE, flow.id).catch(console.warn);

    const resetTrigger = flow.nodes.find((n) => n.type === 'TRIGGER') || flow.nodes[0];
    const resetKeywords = getNormalizedKeywords((resetTrigger?.data as any)?.keywords);
    setMessages([
      {
        id: nextMsgId('sys-cue'),
        sender: 'system',
        text: `📱 Session Cleared & Reset • Send any trigger keyword like "${resetKeywords[0] || 'hi'}" to start.`,
        time: formatTime(),
      },
    ]);
  };

  // Handle Inbound User Input Submission with Router Evaluation
  const handleUserReply = (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed) return;

    // 1. Add user reply bubble
    const userMsg: ChatMessage = {
      id: nextMsgId('user-reply'),
      sender: 'user',
      text: trimmed,
      time: formatTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputBuffer('');

    const currentTriggerNode = activeExecutingFlow.nodes.find((n) => n.type === 'TRIGGER') || activeExecutingFlow.nodes[0];
    const matchKeywords = getNormalizedKeywords((currentTriggerNode?.data as any)?.keywords);

    const normalizedUser = trimmed.toLowerCase();
    const userWords = normalizedUser.split(/[\s,;.!?]+/).filter(Boolean);

    const isTriggerMatch = matchKeywords.some((k) => {
      const cleanK = k.toLowerCase().trim();
      if (!cleanK) return false;
      return (
        normalizedUser === cleanK ||
        userWords.includes(cleanK) ||
        normalizedUser.includes(cleanK) ||
        cleanK.includes(normalizedUser)
      );
    });

    // Step 1 & 2: When fresh trigger detected, OR if flow hasn't started yet and no active node is waiting
    if (isTriggerMatch || (!flowStarted && !activeNodeId)) {
      setCapturedVariables({});
      setCompletedNotification(null);
      setFlowStarted(true);
      setActiveNodeId(null);

      // Clear previous session states in database (non-blocking)
      resetWhatsAppSession(tenantId, SIMULATOR_PHONE, activeExecutingFlow.id).catch(console.warn);

      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId('sys-reset'),
          sender: 'system',
          text: `⚡ SESSION RESET: Initialized fresh booking session for ${SIMULATOR_PHONE}. Previous state cleared.`,
          time: formatTime(),
          isActionFeedback: true,
        },
      ]);

      // Resolve first target node strictly from deployed canvas
      let firstTarget = currentTriggerNode ? getNextNode(currentTriggerNode.id, 'default') : null;
      if (!firstTarget && currentTriggerNode) {
        firstTarget = getNextNode(currentTriggerNode.id, 'right') || getNextNode(currentTriggerNode.id, 'output');
      }
      if (!firstTarget) {
        firstTarget = activeExecutingFlow.nodes.find((n) => n.id !== currentTriggerNode?.id && n.type !== 'TRIGGER') || activeExecutingFlow.nodes[1] || null;
      }

      if (firstTarget) {
        setTimeout(() => {
          processFlowStepRef.current(firstTarget, {});
        }, 200);
      }
      return;
    }

    // Step 3, 4, 5, 7: State router evaluates next node strictly based on currently deployed canvas graph
    if (activeNodeId) {
      const activeNode = activeExecutingFlow.nodes.find((n) => n.id === activeNodeId);
      if (
        activeNode &&
        (activeNode.type === 'USER_INPUT' ||
          activeNode.type === 'MESSAGE' ||
          activeNode.type === 'SUPPORT_HELPDESK')
      ) {
        const varName = (activeNode.data as any).variableName || `var_${activeNode.id}`;
        const updatedVars: Record<string, string> = {
          ...capturedVariables,
          ...(activeNode.type === 'USER_INPUT' ? { [varName]: trimmed } : {}),
        };

        if (activeNode.type === 'SUPPORT_HELPDESK') {
          updatedVars.support_action = trimmed;
          const supportData = activeNode.data as any;
          const phone = supportData.phone || '+1 (555) 019-2831';
          const address = supportData.address || '1200 Innovation Way, Suite 400';
          const workingHours = supportData.workingHours || 'Mon-Sat: 9:00 AM - 7:00 PM';
          const mapsUrl = supportData.mapsUrl || 'https://maps.google.com/?q=1200+Innovation+Way';
          const faqs: Array<{ question: string; answer: string }> = supportData.faqs || [
            { question: 'What are your accepted payment methods?', answer: 'We accept all major credit cards, Apple Pay, Google Pay, and UPI.' },
            { question: 'What is your cancellation policy?', answer: 'Cancellations or reschedules made 24+ hours in advance incur no fee.' },
            { question: 'Do you offer introductory consultations?', answer: 'Yes! Free 15-minute consultations can be scheduled directly here.' },
          ];

          const lower = trimmed.toLowerCase();
          if (lower.includes('call') || lower.includes('agent')) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextMsgId('bot-support-call'),
                sender: 'bot',
                header: `${tenantName} • Direct Call / Live Agent`,
                text: `📞 Direct Call / Live Agent:\n\n• Hotline Number: ${phone}\n• Click-to-Call: tel:${phone.replace(/[^0-9+]/g, '')}\n\n🛎️ Live Agent Handover Initiated: An alert has been broadcast to our on-duty desk team. An agent will connect in this chat shortly.`,
                time: formatTime(),
              },
            ]);
          } else if (lower.includes('location') || lower.includes('hour') || lower.includes('address')) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextMsgId('bot-support-loc'),
                sender: 'bot',
                header: `${tenantName} • Location & Hours`,
                text: `📍 Store Location & Working Hours:\n\n• Address: ${address}\n• Operating Hours: ${workingHours}\n• Google Maps Pin: ${mapsUrl}`,
                time: formatTime(),
              },
            ]);
          } else if (lower.includes('faq') || lower.includes('question')) {
            const faqText = faqs
              .map((f, i) => `${i + 1}️⃣ *${f.question}*\n   ${f.answer}`)
              .join('\n\n');
            setMessages((prev) => [
              ...prev,
              {
                id: nextMsgId('bot-support-faq'),
                sender: 'bot',
                header: `${tenantName} • Frequently Asked Questions (FAQ)`,
                text: `❓ Frequently Asked Questions:\n\n${faqText}`,
                time: formatTime(),
              },
            ]);
          } else if (lower.includes('leave a message') || lower.includes('message')) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextMsgId('bot-support-leave-msg'),
                sender: 'bot',
                header: `${tenantName} • Support Helpdesk`,
                text: `✉️ Leave a Message:\nYour request has been captured and routed to our admin support inbox. Our team will review your notes and reply directly to this number.`,
                time: formatTime(),
              },
            ]);
          }
        }

        // Universal Dynamic Variable Bindings
        if (varName === 'customer_name') {
          updatedVars.customer_name = trimmed;
        } else if (varName === 'selected_doctor' || varName === 'doctor_name') {
          updatedVars.selected_doctor = trimmed;
          updatedVars.doctor_name = trimmed;
        } else if (varName === 'selected_service' || varName === 'service_name') {
          updatedVars.selected_service = trimmed;
          updatedVars.service_name = trimmed;

          // Check if node has services catalog to extract clean name, price and duration
          const srvList = (activeNode.data as any)?.services;
          if (Array.isArray(srvList)) {
            const cleanT = trimmed.toLowerCase();
            const matchedSrv = srvList.find(
              (s: any) =>
                cleanT.includes(String(s.name || '').toLowerCase()) ||
                String(s.name || '').toLowerCase().includes(cleanT)
            );
            if (matchedSrv) {
              updatedVars.selected_service = matchedSrv.name;
              updatedVars.service_name = matchedSrv.name;
              updatedVars.service_price = `$${matchedSrv.price ?? 50}`;
              updatedVars.service_duration = `${matchedSrv.durationMinutes || 30} mins`;
            }
          }
        } else if (varName === 'booking_slot' || varName === 'appointment_slot') {
          updatedVars.booking_slot = trimmed;
          updatedVars.appointment_slot = trimmed;

          // Split preferred date and time dynamically
          if (trimmed.toLowerCase().includes(' at ')) {
            const parts = trimmed.split(/\s+at\s+/i);
            updatedVars.booking_date = parts[0].trim();
            updatedVars.booking_time = parts[1].trim();
          } else if (trimmed.includes(',')) {
            const parts = trimmed.split(',');
            updatedVars.booking_date = parts[0].trim();
            updatedVars.booking_time = parts[1]?.trim() || '11:00 AM';
          } else {
            updatedVars.booking_date = trimmed;
            updatedVars.booking_time = 'Confirmed';
          }

          // Real-Time Slot Collision Detection Check
          const datePart = updatedVars.booking_date || trimmed;
          const timePart = updatedVars.booking_time || trimmed;
          const collision = checkSlotCollision(
            tenantId,
            datePart,
            timePart,
            updatedVars.selected_doctor || updatedVars.selected_service
          );

          if (collision.hasCollision) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextMsgId('slot-collision-alert'),
                sender: 'bot',
                text: `⚠️ Notice: "${trimmed}" is already reserved for an appointment. To prevent scheduling conflicts, please select one of the following available alternative slots:`,
                choices: collision.alternativeSlots.map((s) => `${datePart} at ${s}`),
                isDateSlotPicker: true,
                time: formatTime(),
              },
            ]);
            // Remain on active slot selection step
            return;
          }
        } else if (varName === 'rating') {
          updatedVars.rating = trimmed;
        }

        setCapturedVariables(updatedVars);
        setActiveNodeId(null);

        // Multi-Branch routing evaluation: tries matching the chosen option first, then default
        let next = getNextNode(activeNode.id, trimmed);
        if (!next) {
          next = getNextNode(activeNode.id, 'default');
        }
        if (!next) {
          next = getNextNode(activeNode.id, 'right') || getNextNode(activeNode.id, 'output');
        }
        if (!next) {
          const currentIndex = activeExecutingFlow.nodes.findIndex((n) => n.id === activeNode.id);
          if (currentIndex !== -1 && currentIndex + 1 < activeExecutingFlow.nodes.length) {
            next = activeExecutingFlow.nodes[currentIndex + 1];
          }
        }

        // Store session state in database (non-blocking)
        saveWhatsAppSession(tenantId, {
          user_phone: SIMULATOR_PHONE,
          active_flow_id: activeExecutingFlow.id,
          current_step: next ? next.id : 'COMPLETED',
          collected_data: updatedVars,
        }).catch(console.warn);

        if (next) {
          setTimeout(() => {
            processFlowStepRef.current(next, updatedVars);
          }, 250);
        }
        return;
      }
    }

    // Fallback if message received when no active node is waiting
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId('bot-free'),
          sender: 'bot',
          header: tenantName,
          text: `Thank you! To schedule a new appointment or modify your reservation, simply send "${matchKeywords[0] || 'Book'}".`,
          time: formatTime(),
        },
      ]);
    }, 200);
  };

  const activeNode = activeNodeId ? activeExecutingFlow.nodes.find((n) => n.id === activeNodeId) : null;
  const activeVarName = activeNode ? (activeNode.data as any).variableName : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '380px', margin: '0 auto' }}>
      {/* Live Active Flow Version Badge */}
      <div style={{ marginBottom: '12px', textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px',
            fontWeight: 800,
            background: 'rgba(0, 168, 132, 0.14)',
            color: '#00A884',
            padding: '5px 12px',
            borderRadius: '9999px',
          }}
        >
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00A884' }}></span>
          UNIVERSAL FLOW ENGINE • v{flow.version || 1} LIVE
        </span>
      </div>

      {/* Realistic WhatsApp Device Frame */}
      <div className="phone-device-shell" style={{ width: '100%' }}>
        <div className="phone-screen-viewport" style={{ height: '620px', display: 'flex', flexDirection: 'column' }}>
          {/* Phone Status Bar */}
          <div className="phone-status-bar">
            <span>9:41</span>
            <div className="phone-notch-island"></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 21l3.5-1.12C9.36 20.53 10.64 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"></path>
              </svg>
              <span>100%</span>
            </div>
          </div>

          {/* WhatsApp Chat Navigation Bar */}
          <div className="phone-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleResetChat}
                title="Restart WhatsApp Session"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="wa-avatar-circle">
                <span>{tenantName.slice(0, 2).toUpperCase()}</span>
                <span className="wa-avatar-online"></span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className="wa-contact-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {tenantName}
                </span>
                <span className="wa-contact-status">
                  ● Verified Universal Bot
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255, 255, 255, 0.8)' }}>
              <button
                type="button"
                onClick={handleResetChat}
                title="Reset Chat Session"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '3px 7px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* WhatsApp Chat Conversation Bubble Stream */}
          <div className="phone-chat-body" style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
            {/* Encryption Notice */}
            <div className="wa-encryption-notice">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
              <span>Messages and calls are end-to-end encrypted. No one outside of this chat can read them.</span>
            </div>

            {/* Date Separator Pill */}
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <span className="wa-date-pill">TODAY</span>
            </div>

            {/* Messages */}
            {messages.map((m) => {
              if (m.sender === 'system') {
                return (
                  <div key={m.id} style={{ textAlign: 'center', margin: '8px 0' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        background: m.isActionFeedback ? 'rgba(0, 168, 132, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                        color: m.isActionFeedback ? '#00A884' : 'rgba(255, 255, 255, 0.8)',
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        maxWidth: '92%',
                        lineHeight: 1.3,
                        border: m.isActionFeedback ? '1px solid rgba(0, 168, 132, 0.3)' : undefined,
                      }}
                    >
                      {m.text}
                    </span>
                  </div>
                );
              }

              const isUser = m.sender === 'user';
              return (
                <div key={m.id} className={`wa-bubble-row ${isUser ? 'user-row' : 'bot-row'}`}>
                  <div className={`wa-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
                    {/* Bot Business Header */}
                    {!isUser && m.header && (
                      <span className="wa-bubble-sender-title">{m.header}</span>
                    )}

                    {/* Message Body */}
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.45, fontSize: '13px' }}>
                      {m.text}
                    </p>

                    {/* Choice Buttons */}
                    {m.choices && m.choices.length > 0 && (
                      <div className="wa-quick-replies-group">
                        {m.choices.map((choice) => (
                          <button
                            key={choice}
                            type="button"
                            className="wa-quick-reply-pill"
                            onClick={() => handleUserReply(choice)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <span>{choice}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Interactive Calendar & Time Slot Picker */}
                    {m.isDateSlotPicker && activeNodeId && (
                      <WhatsAppCalendarPicker
                        onSelectSlot={(slotStr) => handleUserReply(slotStr)}
                      />
                    )}

                    {/* Bubble Timestamp & Status */}
                    <div className="wa-bubble-meta">
                      <span className="wa-timestamp">{m.time}</span>
                      {isUser && (
                        <span className="wa-checkmarks double-blue">✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Rule Engine Metering In-Progress Spinner */}
            {isProcessingRuleEngine && (
              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <span className="rule-engine-spinner-pill">
                  <span className="pulse-indicator-fast"></span>
                  Rule Engine: Executing Booking & Deducting 0.50 cr...
                </span>
              </div>
            )}
          </div>

          {/* Flow Completion Banner */}
          {completedNotification && (
            <div style={{ background: 'rgba(0, 168, 132, 0.16)', padding: '6px 12px', borderTop: '1px solid rgba(0, 168, 132, 0.3)', textAlign: 'center', fontSize: '11px', color: '#00A884', fontWeight: 700 }}>
              ✓ {completedNotification}
            </div>
          )}

          {/* Active Variable Capture Strip */}
          {activeVarName && (
            <div style={{ background: '#1F2C34', padding: '4px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #2A3942', fontSize: '11px', color: '#8696A0' }}>
              <span>Awaiting input for: <strong style={{ color: '#00A884' }}>{`{{${activeVarName}}}`}</strong></span>
              <span style={{ fontSize: '10px', background: '#2A3942', padding: '1px 5px', borderRadius: '3px' }}>Node ID: {activeNodeId}</span>
            </div>
          )}

          {/* WhatsApp In-Chat Text Input Dock */}
          <div className="phone-chat-input-bar">
            <div style={{ color: '#8696A0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke="#121B22" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            <input
              type="text"
              className="phone-chat-textfield"
              placeholder={
                activeVarName
                  ? activeVarName.toLowerCase().includes('slot') || activeVarName.toLowerCase().includes('date')
                    ? '📅 Pick date & slot above or type...'
                    : `Enter ${activeVarName}...`
                  : `Type a message (e.g. "${triggerKeywords[0] || 'hi'}")...`
              }
              value={inputBuffer}
              onChange={(e) => setInputBuffer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUserReply(inputBuffer);
                }
              }}
            />

            <button
              type="button"
              className="phone-chat-send-circle"
              onClick={() => handleUserReply(inputBuffer)}
              title="Send reply"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowSimulator;