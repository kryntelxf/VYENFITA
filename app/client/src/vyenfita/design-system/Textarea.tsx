/**
 * VYENFITA Textarea Component
 * 
 * @version 1.0.0
 */

import React, { TextareaHTMLAttributes, forwardRef, useState } from 'react';
import { colors, typography, spacing, borderRadius, transitions } from './tokens';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, fullWidth = true, style, onFocus, onBlur, ...rest }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const textareaId = rest.id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div style={{ width: fullWidth ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
        {label && (
          <label
            htmlFor={textareaId}
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

        <textarea
          ref={ref}
          id={textareaId}
          style={{
            width: '100%',
            padding: `${spacing[3]} ${spacing[4]}`,
            fontFamily: typography.fontFamily.sans,
            fontSize: typography.fontSize.base,
            color: colors.text.primary,
            background: colors.background.primary,
            border: `1px solid ${
              error ? colors.border.error : isFocused ? colors.border.focus : colors.border.default
            }`,
            borderRadius: borderRadius.lg,
            outline: 'none',
            transition: `all ${transitions.fast}`,
            boxShadow: isFocused ? `0 0 0 3px ${colors.brand.primary}20` : 'none',
            resize: 'vertical',
            minHeight: '100px',
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

        {error && (
          <span style={{ fontSize: typography.fontSize.xs, color: colors.semantic.error }}>{error}</span>
        )}

        {hint && !error && (
          <span style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary }}>{hint}</span>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
