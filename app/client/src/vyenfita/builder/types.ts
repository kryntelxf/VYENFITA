/**
 * VYENFITA Builder Types
 * 
 * Core types for visual app builder.
 * 
 * @version 1.0.0
 */

// ============================================================
// WIDGET TYPES
// ============================================================

export type WidgetType =
  | 'text'
  | 'heading'
  | 'button'
  | 'input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'datepicker'
  | 'filepicker'
  | 'table'
  | 'chart'
  | 'form'
  | 'card'
  | 'container'
  | 'tabs'
  | 'accordion'
  | 'image'
  | 'video'
  | 'iframe'
  | 'divider'
  | 'spacer'
  | 'map'
  | 'list'
  | 'grid';

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetProps {
  // Text
  text?: string;
  label?: string;
  placeholder?: string;
  value?: string;

  // Select
  options?: Array<{ label: string; value: string }>;

  // Style
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: string;
  borderRadius?: string;

  // Behavior
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;

  // Data binding
  dataSource?: string;
  query?: string;

  // Custom
  [key: string]: any;
}

export interface Widget {
  id: string;
  type: WidgetType;
  name: string;
  props: WidgetProps;
  position: WidgetPosition;
  children?: Widget[];
  parentId?: string;
  locked?: boolean;
  hidden?: boolean;
}

// ============================================================
// PAGE TYPES
// ============================================================

export interface Page {
  id: string;
  name: string;
  path: string;
  type: 'dashboard' | 'form' | 'table' | 'custom' | 'login' | 'profile' | 'settings' | 'reports';
  layout: 'full' | 'sidebar' | 'split';
  widgets: Widget[];
  metadata?: Record<string, any>;
}

// ============================================================
// APPLICATION TYPES
// ============================================================

export interface ApplicationState {
  metadata: {
    name: string;
    description: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
  };
  pages: Page[];
  currentPageId: string | null;
  selectedWidgetId: string | null;
  variables: Record<string, any>;
}

// ============================================================
// BUILDER STATE
// ============================================================

export interface BuilderState {
  application: ApplicationState;
  history: {
    past: ApplicationState[];
    present: ApplicationState;
    future: ApplicationState[];
  };
  ui: {
    mode: 'design' | 'preview';
    zoom: number;
    gridVisible: boolean;
    gridSize: number;
    snapToGrid: boolean;
    selectedWidgetId: string | null;
    hoveredWidgetId: string | null;
    clipboard: Widget | null;
    dragging: {
      isDragging: boolean;
      widgetId: string | null;
      offset: { x: number; y: number } | null;
    } | null;
    resizing: {
      isResizing: boolean;
      widgetId: string | null;
      startX: number;
      startY: number;
      startWidth: number;
      startHeight: number;
    } | null;
  };
}

// ============================================================
// BUILDER ACTIONS
// ============================================================

export type BuilderAction =
  | { type: 'ADD_WIDGET'; payload: { widget: Widget; pageId: string } }
  | { type: 'UPDATE_WIDGET'; payload: { widgetId: string; updates: Partial<Widget> } }
  | { type: 'DELETE_WIDGET'; payload: { widgetId: string } }
  | { type: 'DUPLICATE_WIDGET'; payload: { widgetId: string } }
  | { type: 'MOVE_WIDGET'; payload: { widgetId: string; position: WidgetPosition } }
  | { type: 'SELECT_WIDGET'; payload: { widgetId: string | null } }
  | { type: 'HOVER_WIDGET'; payload: { widgetId: string | null } }
  | { type: 'COPY_WIDGET'; payload: { widgetId: string } }
  | { type: 'PASTE_WIDGET'; payload: { position: { x: number; y: number } } }
  | { type: 'SET_MODE'; payload: { mode: 'design' | 'preview' } }
  | { type: 'SET_ZOOM'; payload: { zoom: number } }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_GRID_SIZE'; payload: { size: number } }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'ADD_PAGE'; payload: { page: Page } }
  | { type: 'SET_CURRENT_PAGE'; payload: { pageId: string } }
  | { type: 'UPDATE_PAGE'; payload: { pageId: string; updates: Partial<Page> } }
  | { type: 'DELETE_PAGE'; payload: { pageId: string } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' }
  | { type: 'LOAD'; payload: { state: ApplicationState } };

// ============================================================
// WIDGET REGISTRY
// ============================================================

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  icon: string;
  category: 'basic' | 'input' | 'layout' | 'data' | 'media';
  defaultProps: WidgetProps;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  resizable?: boolean;
  hasChildren?: boolean;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  text: {
    type: 'text',
    name: 'Text',
    icon: '📝',
    category: 'basic',
    defaultProps: { text: 'Text', fontSize: '14px', color: '#111827' },
    defaultSize: { width: 4, height: 1 },
  },
  heading: {
    type: 'heading',
    name: 'Heading',
    icon: '📰',
    category: 'basic',
    defaultProps: { text: 'Heading', fontSize: '24px', fontWeight: '600', color: '#111827' },
    defaultSize: { width: 6, height: 1 },
  },
  button: {
    type: 'button',
    name: 'Button',
    icon: '🔘',
    category: 'basic',
    defaultProps: { text: 'Click me', color: '#ffffff', backgroundColor: '#667eea' },
    defaultSize: { width: 2, height: 1 },
  },
  input: {
    type: 'input',
    name: 'Input',
    icon: '⌨️',
    category: 'input',
    defaultProps: { label: 'Label', placeholder: 'Enter text...', required: false },
    defaultSize: { width: 4, height: 1 },
  },
  textarea: {
    type: 'textarea',
    name: 'Textarea',
    icon: '📄',
    category: 'input',
    defaultProps: { label: 'Label', placeholder: 'Enter text...', required: false },
    defaultSize: { width: 6, height: 2 },
  },
  select: {
    type: 'select',
    name: 'Select',
    icon: '🔽',
    category: 'input',
    defaultProps: { label: 'Label', options: [{ label: 'Option 1', value: '1' }] },
    defaultSize: { width: 4, height: 1 },
  },
  checkbox: {
    type: 'checkbox',
    name: 'Checkbox',
    icon: '☑️',
    category: 'input',
    defaultProps: { label: 'Checkbox' },
    defaultSize: { width: 3, height: 1 },
  },
  radio: {
    type: 'radio',
    name: 'Radio',
    icon: '🔘',
    category: 'input',
    defaultProps: { label: 'Radio', options: [{ label: 'Option 1', value: '1' }] },
    defaultSize: { width: 4, height: 1 },
  },
  datepicker: {
    type: 'datepicker',
    name: 'Date Picker',
    icon: '📅',
    category: 'input',
    defaultProps: { label: 'Date' },
    defaultSize: { width: 4, height: 1 },
  },
  filepicker: {
    type: 'filepicker',
    name: 'File Picker',
    icon: '📎',
    category: 'input',
    defaultProps: { label: 'Upload' },
    defaultSize: { width: 4, height: 2 },
  },
  table: {
    type: 'table',
    name: 'Table',
    icon: '📊',
    category: 'data',
    defaultProps: { label: 'Table' },
    defaultSize: { width: 12, height: 4 },
  },
  chart: {
    type: 'chart',
    name: 'Chart',
    icon: '📈',
    category: 'data',
    defaultProps: { label: 'Chart' },
    defaultSize: { width: 6, height: 4 },
  },
  form: {
    type: 'form',
    name: 'Form',
    icon: '📋',
    category: 'layout',
    defaultProps: {},
    defaultSize: { width: 6, height: 5 },
    hasChildren: true,
  },
  card: {
    type: 'card',
    name: 'Card',
    icon: '🗂️',
    category: 'layout',
    defaultProps: {},
    defaultSize: { width: 4, height: 4 },
    hasChildren: true,
  },
  container: {
    type: 'container',
    name: 'Container',
    icon: '📦',
    category: 'layout',
    defaultProps: {},
    defaultSize: { width: 6, height: 4 },
    hasChildren: true,
  },
  tabs: {
    type: 'tabs',
    name: 'Tabs',
    icon: '🗂️',
    category: 'layout',
    defaultProps: { options: [{ label: 'Tab 1', value: '1' }] },
    defaultSize: { width: 8, height: 5 },
    hasChildren: true,
  },
  accordion: {
    type: 'accordion',
    name: 'Accordion',
    icon: '📑',
    category: 'layout',
    defaultProps: {},
    defaultSize: { width: 6, height: 4 },
    hasChildren: true,
  },
  image: {
    type: 'image',
    name: 'Image',
    icon: '🖼️',
    category: 'media',
    defaultProps: { value: '' },
    defaultSize: { width: 4, height: 3 },
  },
  video: {
    type: 'video',
    name: 'Video',
    icon: '🎥',
    category: 'media',
    defaultProps: { value: '' },
    defaultSize: { width: 6, height: 4 },
  },
  iframe: {
    type: 'iframe',
    name: 'Iframe',
    icon: '🌐',
    category: 'media',
    defaultProps: { value: '' },
    defaultSize: { width: 6, height: 4 },
  },
  divider: {
    type: 'divider',
    name: 'Divider',
    icon: '➖',
    category: 'basic',
    defaultProps: {},
    defaultSize: { width: 12, height: 1 },
  },
  spacer: {
    type: 'spacer',
    name: 'Spacer',
    icon: '⬜',
    category: 'layout',
    defaultProps: {},
    defaultSize: { width: 4, height: 2 },
  },
  map: {
    type: 'map',
    name: 'Map',
    icon: '🗺️',
    category: 'media',
    defaultProps: {},
    defaultSize: { width: 6, height: 4 },
  },
  list: {
    type: 'list',
    name: 'List',
    icon: '📃',
    category: 'data',
    defaultProps: {},
    defaultSize: { width: 4, height: 4 },
    hasChildren: true,
  },
  grid: {
    type: 'grid',
    name: 'Grid',
    icon: '⚏',
    category: 'layout',
    defaultProps: {},
    defaultSize: { width: 6, height: 4 },
    hasChildren: true,
  },
};

// ============================================================
// HELPERS
// ============================================================

export function generateWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generatePageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createWidget(
  type: WidgetType,
  position: WidgetPosition,
  overrides?: Partial<Widget>
): Widget {
  const def = WIDGET_REGISTRY[type];
  if (!def) throw new Error(`Unknown widget type: ${type}`);

  return {
    id: generateWidgetId(),
    type,
    name: `${def.name} ${Date.now().toString().slice(-4)}`,
    props: { ...def.defaultProps },
    position,
    children: def.hasChildren ? [] : undefined,
    ...overrides,
  };
}
