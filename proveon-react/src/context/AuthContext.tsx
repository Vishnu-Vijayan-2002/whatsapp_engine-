import React, { createContext, useContext, useState } from 'react';
import type { UserProfile } from '../types';
import { getActiveSession, setActiveSession, authenticateUser } from '../firebase/authService';

export interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  loginSuperAdmin: (email: string, pass: string) => Promise<UserProfile>;
  loginBusinessAdmin: (email: string, pass: string) => Promise<UserProfile>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  loginSuperAdmin: async () => { throw new Error('Not implemented'); },
  loginBusinessAdmin: async () => { throw new Error('Not implemented'); },
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getActiveSession());
  const loading = false;

  const loginSuperAdmin = async (email: string, pass: string): Promise<UserProfile> => {
    const user = await authenticateUser(email, pass, 'super_admin');
    setCurrentUser(user);
    return user;
  };

  const loginBusinessAdmin = async (email: string, pass: string): Promise<UserProfile> => {
    const user = await authenticateUser(email, pass, 'business_admin');
    setCurrentUser(user);
    return user;
  };

  const logout = () => {
    setActiveSession(null);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        loginSuperAdmin,
        loginBusinessAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
