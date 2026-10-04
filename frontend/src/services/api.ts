import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

export type SessionType = 'USER' | 'CUSTOMER';

const SESSION_TYPE_KEY = 'crs_auth_session_type';
const REFRESH_TOKEN_KEY = 'crs_auth_refresh_token';

// In-memory access token holder (never stored in localStorage/sessionStorage)
let inMemoryAccessToken: string | null = null;
let onUnauthenticatedCallback: (() => void) | null = null;
let onTokenRefreshedCallback: ((token: string) => void) | null = null;

export const getAccessToken = (): string | null => inMemoryAccessToken;

export const setAccessToken = (token: string | null): void => {
  inMemoryAccessToken = token;
};

export const getFallbackRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setFallbackRefreshToken = (token: string | null): void => {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage write errors
  }
};

export const getSessionType = (): SessionType | null => {
  try {
    const val = localStorage.getItem(SESSION_TYPE_KEY);
    if (val === 'USER' || val === 'CUSTOMER') {
      return val;
    }
  } catch {
    // Ignore localStorage read errors
  }
  return null;
};

export const setSessionType = (type: SessionType | null): void => {
  try {
    if (type) {
      localStorage.setItem(SESSION_TYPE_KEY, type);
    } else {
      localStorage.removeItem(SESSION_TYPE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage write errors
  }
};

export const setOnUnauthenticated = (callback: () => void): void => {
  onUnauthenticatedCallback = callback;
};

export const setOnTokenRefreshed = (callback: (token: string) => void): void => {
  onTokenRefreshedCallback = callback;
};

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token if present in memory
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Endpoints excluded from 401 automatic refresh handling
const EXCLUDED_REFRESH_ENDPOINTS = [
  '/auth/refresh',
  '/auth/customer/refresh',
  '/auth/login',
  '/auth/register',
  '/auth/customer/otp/send',
  '/auth/customer/otp/verify',
  '/auth/logout',
  '/auth/customer/logout',
];

const isExcludedEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return EXCLUDED_REFRESH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

// Single-flight refresh state
let activeRefreshPromise: Promise<string> | null = null;

/**
 * Single-flight refresh token executor.
 * Guarantees only ONE refresh request is in-flight at any time.
 * If multiple callers call this simultaneously, they receive the exact same Promise.
 */
export const refreshAccessToken = async (sessionTypeHint?: SessionType): Promise<string> => {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const sessionType = sessionTypeHint || getSessionType();
  if (!sessionType) {
    const error = new Error('No session type available for refresh');
    setAccessToken(null);
    setSessionType(null);
    setFallbackRefreshToken(null);
    if (onUnauthenticatedCallback) {
      onUnauthenticatedCallback();
    }
    return Promise.reject(error);
  }

  const endpoint = sessionType === 'CUSTOMER' ? '/auth/customer/refresh' : '/auth/refresh';

  activeRefreshPromise = (async () => {
    try {
      const fallbackToken = getFallbackRefreshToken();
      const body: Record<string, any> = {};
      const headers: Record<string, string> = {};
      if (fallbackToken) {
        body.refreshToken = fallbackToken;
        headers['x-refresh-token'] = fallbackToken;
      }

      // Use raw axios call directly to bypass interceptors
      const response = await axios.post(
        `${api.defaults.baseURL}${endpoint}`,
        body,
        {
          withCredentials: true,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        }
      );

      const newToken = response.data?.data?.accessToken;
      if (!newToken || typeof newToken !== 'string') {
        throw new Error('Refresh response missing access token');
      }

      const rotatedRefreshToken = response.data?.data?.refreshToken;
      if (rotatedRefreshToken && typeof rotatedRefreshToken === 'string') {
        setFallbackRefreshToken(rotatedRefreshToken);
      }

      setAccessToken(newToken);
      if (onTokenRefreshedCallback) {
        onTokenRefreshedCallback(newToken);
      }

      return newToken;
    } catch (error) {
      setAccessToken(null);
      setSessionType(null);
      setFallbackRefreshToken(null);
      if (onUnauthenticatedCallback) {
        onUnauthenticatedCallback();
      }
      throw error;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
};

// Response interceptor: handle 401 and queue concurrent requests
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Ignore if not a 401 or no request config
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Do not retry if already retried once or if request is to an excluded auth endpoint
    if (originalRequest._retry || isExcludedEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    // Mark as retried: ensures failed requests are retried AT MOST ONCE
    originalRequest._retry = true;

    const sessionType = getSessionType();
    if (!sessionType) {
      setAccessToken(null);
      if (onUnauthenticatedCallback) {
        onUnauthenticatedCallback();
      }
      return Promise.reject(error);
    }

    try {
      // Wait for the single-flight refresh Promise
      const newToken = await refreshAccessToken(sessionType);

      // Update queued request with the new access token and retry exactly once
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
      }

      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed: reject queued requests, do not retry
      return Promise.reject(refreshError);
    }
  }
);

export default api;
