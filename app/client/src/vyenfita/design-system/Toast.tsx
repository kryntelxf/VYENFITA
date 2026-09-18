/**
 * VYENFITA Toast Component
 * 
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { colors, spacing, borderRadius, shadows, typography, zIndex, transitions } from './tokens';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { ...input, id, duration: input.duration || 5000 };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const success = useCallback((title: string, message?: string) => toast({ type: 'success', title, message }), [toast]);
  const error = useCallback((title: string, message?: string) => toast({ type: 'error', title, message }), [toast]);
  const warning = useCallback((title: string, message?: string) => toast({ type: 'warning', title, message }), [toast]);
  const info = useCallback((title: string, message?: string) => toast({ type: 'info', title, message }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: spacing[4],
          right: spacing[4],
          zIndex: zIndex.toast,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
          maxWidth: '400px',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

// ============================================================
// TOAST ITEM
// ============================================================

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const colorMap: Record<ToastType, { bg: string; color: string; icon: string }> = {
    success: { bg: colors.semantic.successLight, color: colors.semantic.successDark, icon: '✓' },
    error: { bg: colors.semantic.errorLight, color: colors.semantic.errorDark, icon: '✕' },
    warning: { bg: colors.semantic.warningLight, color: colors.semantic.warningDark, icon: '!' },
    info: { bg: colors.semantic.infoLight, color: colors.semantic.infoDark, icon: 'i' },
  };

  const c = colorMap[toast.type];

  return (
    <div
      style={{
        background: colors.background.primary,
        borderLeft: `4px solid ${c.color}`,
        borderRadius: borderRadius.lg,
        padding: spacing[4],
        boxShadow: shadows.lg,
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing[3],
        animation: 'vyenfita-toast-slide 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: '300px',
      }}
    >
      <span
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: c.bg,
          color: c.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: typography.fontWeight.bold,
          fontSize: '14px',
          flexShrink: 0,
        }}
      >
        {c.icon}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
            marginBottom: toast.message ? spacing[1] : 0,
          }}
        >
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
            {toast.message}
          </div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          color: colors.text.tertiary,
          padding: 0,
          lineHeight: 1,
          transition: `color ${transitions.fast}`,
        }}
      >
        ×
      </button>
    </div>
  );
};

// Add keyframes
if (typeof document !== 'undefined' && !document.getElementById('vyenfita-toast-keyframes')) {
  const style = document.createElement('style');
  style.id = 'vyenfita-toast-keyframes';
  style.textContent = `
    @keyframes vyenfita-toast-slide {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}

export default ToastProvider;
