import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Tenant, UsageAuditLog } from '../types';
import {
  subscribeToTenants,
  subscribeTenantById,
  subscribeToUsageAuditLogs,
  translateActionCode,
} from '../firebase/firestoreService';

export interface CreditDropNotification {
  id: string;
  amount: number;
  description: string;
  timestamp: number;
}

export interface RoleContextType {
  role: 'super' | 'business';
  setRole: (role: 'super' | 'business') => void;
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
  activeTenant: Tenant | null;
  tenants: Tenant[];
  isLowBalance: boolean;
  isOutOfCredits: boolean;
  recentDrop: CreditDropNotification | null;
  dismissDrop: () => void;
  showRechargeModal: boolean;
  setShowRechargeModal: (show: boolean) => void;
}

export const RoleContext = createContext<RoleContextType>({
  role: 'business',
  setRole: () => {},
  activeTenantId: 'ten-apex-01',
  setActiveTenantId: () => {},
  activeTenant: null,
  tenants: [],
  isLowBalance: false,
  isOutOfCredits: false,
  recentDrop: null,
  dismissDrop: () => {},
  showRechargeModal: false,
  setShowRechargeModal: () => {},
});

export const useRole = () => useContext(RoleContext);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<'super' | 'business'>('business');
  const [activeTenantId, setActiveTenantId] = useState<string>('ten-apex-01');
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [recentDrop, setRecentDrop] = useState<CreditDropNotification | null>(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  const prevLogIdRef = useRef<string | null>(null);

  // Subscribe to all tenants for tenant switcher
  useEffect(() => {
    const unsub = subscribeToTenants((list: Tenant[]) => {
      setTenants(list);
      if (list.length > 0 && !list.some((t: Tenant) => t.tenant_id === activeTenantId)) {
        setActiveTenantId(list[0].tenant_id);
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [activeTenantId]);

  // Subscribe directly to active tenant's document in real-time
  useEffect(() => {
    if (!activeTenantId) return;
    const unsub = subscribeTenantById(activeTenantId, (tenant) => {
      setActiveTenant(tenant);
    });
    return () => unsub();
  }, [activeTenantId]);

  // Listen to new document additions in usage_audit_logs where tenant_id == currentTenant
  // and trigger a top-right notification toast showing the exact reduction
  useEffect(() => {
    if (!activeTenantId) return;

    const unsub = subscribeToUsageAuditLogs((logs: UsageAuditLog[]) => {
      if (!logs || logs.length === 0) return;
      const latest = logs[0];

      // Check if this is a newly received log for the active tenant
      if (latest.tenant_id === activeTenantId && latest.financials?.credits_deducted > 0) {
        if (prevLogIdRef.current && prevLogIdRef.current !== latest.log_id) {
          const friendlyName = translateActionCode(
            latest.operation?.action_code,
            latest.operation?.description
          );
          setRecentDrop({
            id: latest.log_id,
            amount: latest.financials.credits_deducted,
            description: friendlyName,
            timestamp: Date.now(),
          });

          // Auto dismiss after 4.5 seconds
          setTimeout(() => {
            setRecentDrop((prev) => (prev?.id === latest.log_id ? null : prev));
          }, 4500);
        }
        prevLogIdRef.current = latest.log_id;
      }
    }, 20);

    return () => unsub();
  }, [activeTenantId]);

  const balance = activeTenant?.credit_wallet?.balance ?? 0;
  const threshold = activeTenant?.credit_wallet?.low_balance_threshold ?? 50;
  const isLowBalance = balance < threshold;
  const isOutOfCredits = balance <= 0;

  const dismissDrop = () => setRecentDrop(null);

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        activeTenantId,
        setActiveTenantId,
        activeTenant,
        tenants,
        isLowBalance,
        isOutOfCredits,
        recentDrop,
        dismissDrop,
        showRechargeModal,
        setShowRechargeModal,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};
