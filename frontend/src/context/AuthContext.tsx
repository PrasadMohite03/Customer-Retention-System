import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, LoginRequest, RegisterOwnerRequest } from '../types/auth';
import { authService } from '../services/authService';
import {
  setAccessToken,
  setOnUnauthenticated,
  setOnTokenRefreshed,
  getSessionType,
  setSessionType,
  refreshAccessToken,
} from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  loginOwnerOrStaff: (data: LoginRequest) => Promise<void>;
  registerOwner: (data: RegisterOwnerRequest) => Promise<void>;
  sendCustomerOtp: (phone: string) => Promise<string>;
  verifyCustomerOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to decode JWT payload without external library
function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Module-level restore promise to guarantee idempotent execution across React StrictMode dev double-mounts
let startupRestorePromise: Promise<{ token: string; user: AuthUser } | null> | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const updateAuthState = useCallback((token: string | null, userData: AuthUser | null) => {
    setAccessToken(token);
    setAccessTokenState(token);
    setUser(userData);
  }, []);

  // Listen for background token refreshes and unauthenticated events from Axios interceptor
  useEffect(() => {
    setOnTokenRefreshed((newToken: string) => {
      setAccessTokenState(newToken);
    });

    setOnUnauthenticated(() => {
      updateAuthState(null, null);
    });
  }, [updateAuthState]);

  // Restore session on app startup (idempotent, single-flight, safe with StrictMode)
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const sessionType = getSessionType();

      // If no session type is stored, no session exists -> finish immediately without hitting refresh
      if (!sessionType) {
        if (isMounted) {
          updateAuthState(null, null);
          setIsLoading(false);
        }
        return;
      }

      // If a session type exists, perform single-flight restoration
      if (!startupRestorePromise) {
        startupRestorePromise = (async () => {
          try {
            // Uses the shared single-flight refresh function
            const token = await refreshAccessToken(sessionType);
            const payload = parseJwtPayload(token);

            if (sessionType === 'CUSTOMER' && payload?.customerId) {
              const authUser: AuthUser = {
                id: payload.customerId,
                customerId: payload.customerId,
                role: 'CUSTOMER',
              };
              return { token, user: authUser };
            } else if (sessionType === 'USER' && payload?.userId) {
              const authUser: AuthUser = {
                id: payload.userId,
                email: payload.email,
                role: payload.role,
                businessId: payload.businessId,
              };
              return { token, user: authUser };
            } else {
              throw new Error('Invalid token claims');
            }
          } catch {
            setAccessToken(null);
            setSessionType(null);
            return null;
          }
        })();
      }

      const result = await startupRestorePromise;

      if (isMounted) {
        if (result) {
          updateAuthState(result.token, result.user);
        } else {
          updateAuthState(null, null);
        }
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [updateAuthState]);

  const loginOwnerOrStaff = async (data: LoginRequest) => {
    const res = await authService.loginOwnerOrStaff(data);
    const payload = parseJwtPayload(res.accessToken);

    const authUser: AuthUser = {
      id: res.user.id,
      email: res.user.email,
      role: res.user.role,
      businessId: res.businessId || payload?.businessId,
    };

    startupRestorePromise = null;
    updateAuthState(res.accessToken, authUser);
  };

  const registerOwner = async (data: RegisterOwnerRequest) => {
    const res = await authService.registerOwner(data);
    const payload = parseJwtPayload(res.accessToken);

    const authUser: AuthUser = {
      id: res.user.id,
      email: res.user.email,
      role: 'OWNER',
      businessId: res.business.id || payload?.businessId,
    };

    startupRestorePromise = null;
    updateAuthState(res.accessToken, authUser);
  };

  const sendCustomerOtp = async (phone: string): Promise<string> => {
    return authService.sendCustomerOtp({ phone });
  };

  const verifyCustomerOtp = async (phone: string, otp: string) => {
    const res = await authService.verifyCustomerOtp({ phone, otp });

    const authUser: AuthUser = {
      id: res.customer.id,
      customerId: res.customer.id,
      phone: res.customer.phone,
      name: res.customer.name,
      role: 'CUSTOMER',
    };

    startupRestorePromise = null;
    updateAuthState(res.accessToken, authUser);
  };

  const logout = async () => {
    try {
      if (user?.role === 'CUSTOMER') {
        await authService.logoutCustomer();
      } else {
        await authService.logoutUser();
      }
    } catch {
      // Ignore errors on logout
    } finally {
      startupRestorePromise = null;
      setSessionType(null);
      updateAuthState(null, null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: accessTokenState,
        isLoading,
        loginOwnerOrStaff,
        registerOwner,
        sendCustomerOtp,
        verifyCustomerOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
