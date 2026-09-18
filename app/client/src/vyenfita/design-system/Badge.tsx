/**
 * VYENFITA Badge Component
 * 
 * @version 1.0.0
 */

import React from 'react';
import { colors, typography, spacing, borderRadius } from './tokens';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
    default: { bg: colors.neutral[100], color: colors.neutral[700] },
    success: { bg: colors.semantic.successLight, color: colors.semantic.successDark },
    warning: { bg: colors.semantic.warningLight, color: colors.semantic.warningDark },
    error: { bg: colors.semantic.errorLight, color: colors.semantic.errorDark },
    info: { bg: colors.semantic.infoLight, color: colors.semantic.infoDark },
    brand: { bg: `${colors.brand.primary}20`, color: colors.brand.primary },
  };

  const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
    sm: {
      fontSize: '10px',
      padding: `2px ${spacing[2]}`,
      height: '18px',
    },
    md: {
      fontSize: typography.fontSize.xs,
      padding: `2px ${spacing[3]}`,
      height: '22px',
    },
  };

  const style = variantStyles[variant];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[1],
        background: style.bg,
        color: style.color,
        fontWeight: typography.fontWeight.semibold,
        borderRadius: borderRadius.full,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        ...sizeStyles[size],
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
          }}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
