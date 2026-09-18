/**
 * VYENFITA Design System Tokens
 * 
 * Central source of truth for all design decisions:
 * - Colors
 * - Typography
 * - Spacing
 * - Shadows
 * - Border radius
 * - Transitions
 * 
 * @version 1.0.0
 */

export const colors = {
  // Brand
  brand: {
    primary: '#667eea',
    primaryHover: '#5a6fd8',
    primaryActive: '#4e63c6',
    secondary: '#764ba2',
    secondaryHover: '#6a4392',
    secondaryActive: '#5e3a82',
  },

  // Neutral
  neutral: {
    0: '#ffffff',
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },

  // Semantic
  semantic: {
    success: '#10b981',
    successLight: '#d1fae5',
    successDark: '#065f46',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    warningDark: '#92400e',
    error: '#ef4444',
    errorLight: '#fee2e2',
    errorDark: '#991b1b',
    info: '#3b82f6',
    infoLight: '#dbeafe',
    infoDark: '#1e40af',
  },

  // Backgrounds
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    inverse: '#111827',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Text
  text: {
    primary: '#111827',
    secondary: '#4b5563',
    tertiary: '#9ca3af',
    inverse: '#ffffff',
    link: '#667eea',
    linkHover: '#5a6fd8',
  },

  // Borders
  border: {
    default: '#e5e7eb',
    hover: '#d1d5db',
    focus: '#667eea',
    error: '#ef4444',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
  },

  fontSize: {
    xs: '12px',
    sm: '13px',
    base: '14px',
    md: '15px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '28px',
    '5xl': '32px',
    '6xl': '40px',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
} as const;

export const shadows = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
} as const;

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: '400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Type exports
export type Color = typeof colors;
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type Shadow = keyof typeof shadows;
export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;

// Unified theme
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
} as const;

export default theme;
