/**
 * VYENFITA Auth Context
 * 
 * Global authentication state
 * 
 * @version 1.0.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { api, AuthResult, User, Tenant, Role } from '../api/client';

export interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  role: Role | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string, tenantId: string) => Promise<void>;
  register: (params: {
    email: string;
    password: string;
    name: string;
    tenantName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    role: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // On mount, try to restore session
  useEffect(() => {
    const restore = async () => {
      if (!api.isAuthenticated()) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      try {
        // Fetch current user info
        await api.me();
        const tenant = await api.getTenant();

        setState({
          user: null, // We don't have full user data, but tenant info
          tenant,
          role: null,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch {
        api.clearTokens();
        setState({
          user: null,
          tenant: null,
          role: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    restore();
  }, []);

  const handleAuthResult = useCallback((result: AuthResult) => {
    setState({
      user: result.user,
      tenant: result.tenant,
      role: result.role,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const login = useCallback(
    async (email: string, password: string, tenantId: string) => {
      const result = await api.login({ email, password, tenantId });
      handleAuthResult(result);
    },
    [handleAuthResult]
  );

  const register = useCallback(
    async (params: {
      email: string;
      password: string;
      name: string;
      tenantName?: string;
    }) => {
      const result = await api.register(params);
      handleAuthResult(result);
    },
    [handleAuthResult]
  );

  const logout = useCallback(async () => {
    await api.logout();
    setState({
      user: null,
      tenant: null,
      role: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      await api.me();
      const tenant = await api.getTenant();
      setState((s) => ({ ...s, tenant }));
    } catch {
      // Ignore
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
