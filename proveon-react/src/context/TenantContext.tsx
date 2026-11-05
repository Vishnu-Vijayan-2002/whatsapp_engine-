import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Tenant, UsageAuditLog } from '../types';
import { useAuth } from './AuthContext';
import {
  subscribeTenantById,
  subscribeToUsageAuditLogs,
  translateActionCode,
} from '../firebase/firestoreService';

export interface CreditDropEvent {
  id: string;
  amount: number;
  description: string;
  timestamp: number;
}

export interface TenantContextType {
  tenantId: string;
  tenant: Tenant | null;
  balance: number;
  threshold: number;
  isLowBalance: boolean;
  isOutOfCredits: boolean;
  recentDrop: CreditDropEvent | null;
  dismissDrop: () => void;
  rechargeModalOpen: boolean;
  setRechargeModalOpen: (open: boolean) => void;
}

export const TenantContext = createContext<TenantContextType>({
  tenantId: '',
  tenant: null,
  balance: 0,
  threshold: 50,
  isLowBalance: false,
  isOutOfCredits: false,
  recentDrop: null,
  dismissDrop: () => {},
  rechargeModalOpen: false,
  setRechargeModalOpen: () => {},
});

export const useTenant = () => useContext(TenantContext);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const tenantId = currentUser?.tenant_id || '';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [recentDrop, setRecentDrop] = useState<CreditDropEvent | null>(null);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);

  const prevLogIdRef = useRef<string | null>(null);

  // Subscribe in real-time strictly to this specific tenant document
  useEffect(() => {
    if (!tenantId) return;

    const unsubTenant = subscribeTenantById(tenantId, (data) => {
      setTenant(data);
    });

    // Real-time listener strictly filtered to this tenant_id for credit drop notifications
    const unsubLogs = subscribeToUsageAuditLogs((logs: UsageAuditLog[]) => {
      if (!logs || logs.length === 0) return;
      const latest = logs[0];

      if (latest.tenant_id === tenantId && latest.financials?.credits_deducted > 0) {
        if (prevLogIdRef.current && prevLogIdRef.current !== latest.log_id) {
          const friendly = translateActionCode(
            latest.operation?.action_code,
            latest.operation?.description
          );
          setRecentDrop({
            id: latest.log_id,
            amount: latest.financials.credits_deducted,
            description: friendly,
            timestamp: Date.now(),
          });

          setTimeout(() => {
            setRecentDrop((prev) => (prev?.id === latest.log_id ? null : prev));
          }, 4500);
        }
        prevLogIdRef.current = latest.log_id;
      }
    }, 25);

    return () => {
      unsubTenant();
      unsubLogs();
    };
  }, [tenantId]);

  const balance = tenant?.credit_wallet?.balance ?? 0;
  const threshold = tenant?.credit_wallet?.low_balance_threshold ?? 50;
  const isLowBalance = balance < threshold;
  const isOutOfCredits = balance <= 0;

  const dismissDrop = () => setRecentDrop(null);

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        tenant,
        balance,
        threshold,
        isLowBalance,
        isOutOfCredits,
        recentDrop,
        dismissDrop,
        rechargeModalOpen,
        setRechargeModalOpen,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

