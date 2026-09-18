/**
 * VYENFITA Input Component
 * 
 * @version 1.0.0
 */

import React, { InputHTMLAttributes, forwardRef, useState } from 'react';
import { colors, typography, spacing, borderRadius, transitions } from './tokens';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      fullWidth = true,
      style,
      onFocus,
      onBlur,
      ...rest
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = rest.id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div style={{ width: fullWidth ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.text.primary,
            }}
          >
            {label}
            {rest.required && <span style={{ color: colors.semantic.error, marginLeft: spacing[1] }}>*</span>}
          </label>
        )}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {leftIcon && (
            <span
              style={{
                position: 'absolute',
                left: spacing[3],
                display: 'flex',
                alignItems: 'center',
                color: colors.text.tertiary,
                pointerEvents: 'none',
              }}
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            style={{
              width: '100%',
              padding: `${spacing[3]} ${spacing[4]}`,
              paddingLeft: leftIcon ? spacing[10] : spacing[4],
              paddingRight: rightIcon ? spacing[10] : spacing[4],
              fontFamily: typography.fontFamily.sans,
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
              background: colors.background.primary,
              border: `1px solid ${
                error
                  ? colors.border.error
                  : isFocused
                  ? colors.border.focus
                  : colors.border.default
              }`,
              borderRadius: borderRadius.lg,
              outline: 'none',
              transition: `all ${transitions.fast}`,
              boxShadow: isFocused ? `0 0 0 3px ${colors.brand.primary}20` : 'none',
              ...style,
            }}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />

          {rightIcon && (
            <span
              style={{
                position: 'absolute',
                right: spacing[3],
                display: 'flex',
                alignItems: 'center',
                color: colors.text.tertiary,
              }}
            >
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <span
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.semantic.error,
            }}
          >
            {error}
          </span>
        )}

        {hint && !error && (
          <span
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.text.tertiary,
            }}
          >
            {hint}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
