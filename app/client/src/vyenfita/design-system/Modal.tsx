/**
 * VYENFITA Modal Component
 * 
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { colors, spacing, borderRadius, shadows, typography, transitions, zIndex } from './tokens';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const sizeMap: Record<typeof size, string> = {
    sm: '400px',
    md: '560px',
    lg: '720px',
    xl: '960px',
    full: '95vw',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[4],
        animation: `vyenfita-modal-fade 200ms ease-out`,
      }}
    >
      {/* Overlay */}
      <div
        onClick={closeOnOverlay ? onClose : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: colors.background.overlay,
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: colors.background.primary,
          borderRadius: borderRadius['2xl'],
          boxShadow: shadows['2xl'],
          width: '100%',
          maxWidth: sizeMap[size],
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: `vyenfita-modal-slide 300ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${spacing[5]} ${spacing[6]}`,
              borderBottom: `1px solid ${colors.border.default}`,
            }}
          >
            {title && (
              <h2
                style={{
                  margin: 0,
                  fontSize: typography.fontSize.xl,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text.primary,
                }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '24px',
                  color: colors.text.tertiary,
                  padding: 0,
                  lineHeight: 1,
                  transition: `color ${transitions.fast}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = colors.text.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = colors.text.tertiary)}
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          style={{
            padding: spacing[6],
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: spacing[2],
              padding: `${spacing[5]} ${spacing[6]}`,
              borderTop: `1px solid ${colors.border.default}`,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// Add keyframes
if (typeof document !== 'undefined' && !document.getElementById('vyenfita-modal-keyframes')) {
  const style = document.createElement('style');
  style.id = 'vyenfita-modal-keyframes';
  style.textContent = `
    @keyframes vyenfita-modal-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes vyenfita-modal-slide {
      from { opacity: 0; transform: scale(0.95) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

export default Modal;
