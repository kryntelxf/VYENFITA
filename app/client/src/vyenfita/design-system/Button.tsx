/**
 * VYENFITA Button Component
 * 
 * @version 1.0.0
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { colors, typography, spacing, borderRadius, transitions, shadows } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      style,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
      primary: {
        background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
        color: colors.text.inverse,
        border: 'none',
        boxShadow: shadows.sm,
      },
      secondary: {
        background: colors.neutral[100],
        color: colors.text.primary,
        border: `1px solid ${colors.border.default}`,
      },
      outline: {
        background: 'transparent',
        color: colors.brand.primary,
        border: `1px solid ${colors.brand.primary}`,
      },
      ghost: {
        background: 'transparent',
        color: colors.text.secondary,
        border: 'none',
      },
      danger: {
        background: colors.semantic.error,
        color: colors.text.inverse,
        border: 'none',
      },
    };

    const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
      sm: {
        padding: `${spacing[2]} ${spacing[3]}`,
        fontSize: typography.fontSize.sm,
        height: '32px',
      },
      md: {
        padding: `${spacing[3]} ${spacing[4]}`,
        fontSize: typography.fontSize.base,
        height: '40px',
      },
      lg: {
        padding: `${spacing[4]} ${spacing[6]}`,
        fontSize: typography.fontSize.lg,
        height: '48px',
      },
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          fontFamily: typography.fontFamily.sans,
          fontWeight: typography.fontWeight.semibold,
          borderRadius: borderRadius.lg,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: `all ${transitions.fast}`,
          opacity: isDisabled ? 0.5 : 1,
          width: fullWidth ? '100%' : 'auto',
          outline: 'none',
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && variant === 'primary') {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = shadows.md;
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && variant === 'primary') {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = shadows.sm;
          }
        }}
        {...rest}
      >
        {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ============================================================
// SPINNER
// ============================================================

const Spinner: React.FC<{ size: number }> = ({ size }) => (
  <span
    style={{
      width: size,
      height: size,
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'vyenfita-spin 0.8s linear infinite',
      display: 'inline-block',
    }}
  />
);

// Add keyframes to document (once)
if (typeof document !== 'undefined' && !document.getElementById('vyenfita-spin-keyframes')) {
  const style = document.createElement('style');
  style.id = 'vyenfita-spin-keyframes';
  style.textContent = `
    @keyframes vyenfita-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default Button;
