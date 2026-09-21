/**
 * VYENFITA Mobile Auth Context
 * 
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import api, { AuthResult, User, Tenant, TokenStorage } from '../api/client';
import config from '../config';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, tenantId: string) => Promise<void>;
  register: (params: {
    email: string;
    password: string;
    name: string;
    tenantName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  authenticateWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    isAuthenticated: false,
    isLoading: true,
    biometricAvailable: false,
    biometricEnabled: false,
  });

  // Check biometric availability on mount
  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const enabled = (await SecureStore.getItemAsync(config.storageKeys.biometricEnabled)) === 'true';

      setState((s) => ({
        ...s,
        biometricAvailable: hasHardware && isEnrolled,
        biometricEnabled: enabled,
      }));
    })();
  }, []);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const isAuth = await api.isAuthenticated();
        if (isAuth) {
          const tenant = await api.getTenant();
          setState((s) => ({
            ...s,
            user: null,
            tenant,
            isAuthenticated: true,
            isLoading: false,
          }));
        } else {
          setState((s) => ({ ...s, isLoading: false }));
        }
      } catch {
        await TokenStorage.clearTokens();
        setState((s) => ({ ...s, isLoading: false, isAuthenticated: false }));
      }
    })();
  }, []);

  const handleAuthResult = useCallback((result: AuthResult) => {
    setState((s) => ({
      ...s,
      user: result.user,
      tenant: result.tenant,
      isAuthenticated: true,
      isLoading: false,
    }));
  }, []);

  const login = useCallback(
    async (email: string, password: string, tenantId: string) => {
      const result = await api.login({ email, password, tenantId });
      await SecureStore.setItemAsync(config.storageKeys.lastEmail, email);
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
    setState((s) => ({
      ...s,
      user: null,
      tenant: null,
      isAuthenticated: false,
    }));
  }, []);

  const authenticateWithBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to VYENFITA',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
      });
      return result.success;
    } catch {
      return false;
    }
  }, []);

  const enableBiometric = useCallback(async () => {
    await SecureStore.setItemAsync(config.storageKeys.biometricEnabled, 'true');
    setState((s) => ({ ...s, biometricEnabled: true }));
  }, []);

  const disableBiometric = useCallback(async () => {
    await SecureStore.setItemAsync(config.storageKeys.biometricEnabled, 'false');
    setState((s) => ({ ...s, biometricEnabled: false }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        authenticateWithBiometric,
        enableBiometric,
        disableBiometric,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
  }
