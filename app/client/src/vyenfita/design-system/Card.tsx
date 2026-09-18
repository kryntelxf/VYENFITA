/**
 * VYENFITA Card Component
 * 
 * @version 1.0.0
 */

import React from 'react';
import { colors, spacing, borderRadius, shadows, typography } from './tokens';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  style,
  ...rest
}) => {
  const paddingMap = {
    none: '0',
    sm: spacing[3],
    md: spacing[6],
    lg: spacing[8],
  };

  const variantStyles: Record<typeof variant, React.CSSProperties> = {
    default: {
      background: colors.background.primary,
      border: 'none',
      boxShadow: shadows.sm,
    },
    outlined: {
      background: colors.background.primary,
      border: `1px solid ${colors.border.default}`,
      boxShadow: 'none',
    },
    elevated: {
      background: colors.background.primary,
      border: 'none',
      boxShadow: shadows.lg,
    },
  };

  return (
    <div
      style={{
        borderRadius: borderRadius.xl,
        padding: paddingMap[padding],
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        ...variantStyles[variant],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = shadows.lg;
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = variantStyles[variant].boxShadow as string;
        }
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

// ============================================================
// CARD HEADER
// ============================================================

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, action, icon }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing[4],
      marginBottom: spacing[4],
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[3], flex: 1 }}>
      {icon && <div style={{ fontSize: '24px' }}>{icon}</div>}
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
            marginBottom: subtitle ? spacing[1] : 0,
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.sm,
              color: colors.text.secondary,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

// ============================================================
// CARD BODY
// ============================================================

export const CardBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div>{children}</div>
);

// ============================================================
// CARD FOOTER
// ============================================================

export const CardFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      marginTop: spacing[4],
      paddingTop: spacing[4],
      borderTop: `1px solid ${colors.border.default}`,
      display: 'flex',
      gap: spacing[2],
      justifyContent: 'flex-end',
    }}
  >
    {children}
  </div>
);

export default Card;
