/**
 * VYENFITA Mobile Configuration
 * 
 * @version 1.0.0
 */

import Constants from 'expo-constants';

const getApiUrl = (): string => {
  // Priority 1: Environment override (for staging/production builds)
  const envUrl = Constants.expoConfig?.extra?.apiUrl;
  if (envUrl) return envUrl;

  // Priority 2: Development — use localhost (works for iOS simulator)
  // For Android emulator use 10.0.2.2
  if (__DEV__) {
    return 'http://10.0.2.2:3001'; // Android emulator
    // For iOS simulator: 'http://localhost:3001'
    // For physical device: use your machine IP
  }

  // Priority 3: Production
  return 'https://api.vyenfita.com';
};

export const config = {
  apiUrl: getApiUrl(),
  appVersion: '1.0.0',
  environment: __DEV__ ? 'development' : 'production',
  deepLinkScheme: 'vyenfita',
  storageKeys: {
    accessToken: 'vyenfita.accessToken',
    refreshToken: 'vyenfita.refreshToken',
    tenantId: 'vyenfita.tenantId',
    biometricEnabled: 'vyenfita.biometricEnabled',
    lastEmail: 'vyenfita.lastEmail',
  },
};

export default config;
