import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isLiveFirebaseConfigured } from './config';
import type { UserProfile } from '../types';

const USERS_STORAGE_KEY = 'proveon_users_store';
const SESSION_STORAGE_KEY = 'proveon_active_session';

// Pre-provisioned accounts
export const DEFAULT_USERS: UserProfile[] = [
  {
    uid: 'user_super_admin_01',
    email: 'admin@proveon.io',
    name: 'Moni Roy (Platform Admin)',
    role: 'super_admin',
    status: 'active',
    created_at: 1729000000000,
  },
  {
    uid: 'user_biz_sarah_02',
    email: 'sarah.mitchell@apexaesthetics.com',
    name: 'Dr. Sarah Mitchell',
    role: 'business_admin',
    tenant_id: 'ten-apex-01',
    status: 'active',
    created_at: 1729000000000,
  },
  {
    uid: 'user_biz_elena_03',
    email: 'elena@luxeradiance.com',
    name: 'Elena Rostova',
    role: 'business_admin',
    tenant_id: 'ten-luxe-02',
    status: 'active',
    created_at: 1729000000000,
  },
  {
    uid: 'user_biz_mehta_04',
    email: 'dr.mehta@mehtadental.org',
    name: 'Dr. Rajiv Mehta',
    role: 'business_admin',
    tenant_id: 'ten-mehta-03',
    status: 'active',
    created_at: 1729000000000,
  },
];

function getStoredUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse users from localStorage', e);
  }
  return DEFAULT_USERS;
}

function persistUsers(users: UserProfile[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Failed to persist users', e);
  }
}

/**
 * Retrieves the currently active user profile from session storage.
 */
export function getActiveSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

/**
 * Saves active session.
 */
export function setActiveSession(user: UserProfile | null) {
  try {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Provisions a new Business Admin user (strictly initiated by Super Admin).
 */
export async function provisionBusinessAdminUser(params: {
  email: string;
  name: string;
  tenant_id: string;
}): Promise<UserProfile> {
  const users = getStoredUsers();
  const existing = users.find((u) => u.email.toLowerCase() === params.email.toLowerCase());

  const profile: UserProfile = existing || {
    uid: `user_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    email: params.email.toLowerCase(),
    name: params.name,
    role: 'business_admin',
    tenant_id: params.tenant_id,
    status: 'active',
    created_at: Date.now(),
  };

  if (!existing) {
    users.push(profile);
    persistUsers(users);
  }

  // Sync to Firestore if live
  if (db && isLiveFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'users', profile.uid), profile);
    } catch {
      // background
    }
  }

  return profile;
}

/**
 * Authenticates user credentials and checks role.
 */
export async function authenticateUser(
  email: string,
  _pass: string,
  expectedPortal: 'super_admin' | 'business_admin'
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();

  // Check Firestore first if live
  if (db && isLiveFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, 'users', cleanEmail.replace(/[^a-z0-9]/g, '_')));
      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        if (expectedPortal === 'super_admin' && profile.role !== 'super_admin') {
          throw new Error('Access denied. This portal is restricted to Platform Super Admins only.');
        }
        if (expectedPortal === 'business_admin' && profile.role !== 'business_admin') {
          throw new Error('Access denied. Super Admin credentials cannot be used on business tenant portal.');
        }
        setActiveSession(profile);
        return profile;
      }
    } catch (e: any) {
      if (e.message && e.message.includes('Access denied')) throw e;
    }
  }

  // Check local provisioned users
  const users = getStoredUsers();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    throw new Error(
      expectedPortal === 'super_admin'
        ? 'Invalid Super Admin credentials.'
        : 'No account registered with this email. Business accounts must be provisioned by the Super Admin.'
    );
  }

  if (expectedPortal === 'super_admin' && user.role !== 'super_admin') {
    throw new Error('Access denied. Only Super Admins can access the management gateway.');
  }

  if (expectedPortal === 'business_admin' && user.role !== 'business_admin') {
    throw new Error('Access denied. Super Admins must use the Super Admin login portal (/super-admin/login).');
  }

  if (user.status === 'suspended') {
    throw new Error('Your business account has been suspended by the platform administrator.');
  }

  setActiveSession(user);
  return user;
}

