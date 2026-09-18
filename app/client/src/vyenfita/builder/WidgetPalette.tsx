/**
 * VYENFITA Builder Store
 * 
 * Central state management for the builder using reducer pattern.
 * Includes undo/redo history.
 * 
 * @version 1.0.0
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import {
  BuilderState,
  BuilderAction,
  ApplicationState,
  Widget,
  Page,
  WidgetPosition,
  generatePageId,
  createWidget,
  WidgetType,
} from './types';

// ============================================================
// INITIAL STATE
// ============================================================

const initialApplicationState: ApplicationState = {
  metadata: {
    name: 'Untitled Application',
    description: 'A new application built with VYENFITA',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  pages: [
    {
      id: generatePageId(),
      name: 'Home',
      path: '/',
      type: 'dashboard',
      layout: 'full',
      widgets: [],
    },
  ],
  currentPageId: null,
  selectedWidgetId: null,
  variables: {},
};

const initialState: BuilderState = {
  application: {
    ...initialApplicationState,
    currentPageId: initialApplicationState.pages[0].id,
  },
  history: {
    past: [],
    present: initialApplicationState,
    future: [],
  },
  ui: {
    mode: 'design',
    zoom: 1,
    gridVisible: true,
    gridSize: 8,
    snapToGrid: true,
    selectedWidgetId: null,
    hoveredWidgetId: null,
    clipboard: null,
    dragging: null,
    resizing: null,
  },
};

// ============================================================
// REDUCER
// ============================================================

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    // ============================================================
    // WIDGET ACTIONS
    // ============================================================

    case 'ADD_WIDGET': {
      const { widget, pageId } = action.payload;
      const newApplication = {
        ...state.application,
        pages: state.application.pages.map((p) =>
          p.id === pageId ? { ...p, widgets: [...p.widgets, widget] } : p
        ),
        metadata: { ...state.application.metadata, updatedAt: new Date() },
      };
      return pushHistory(state, newApplication);
    }

    case 'UPDATE_WIDGET': {
      const { widgetId, updates } = action.payload;
      const newApplication = {
        ...state.application,
        pages: state.application.pages.map((p) => ({
          ...p,
          widgets: p.widgets.map((w) =>
            w.id === widgetId ? { ...w, ...updates } : w
          ),
        })),
        metadata: { ...state.application.metadata, updatedAt: new Date() },
      };
      return pushHistory(state, newApplication);
    }

    case 'DELETE_WIDGET': {
      const { widgetId } = action.payload;
      const newApplication = {
        ...state.application,
        pages: state.application.pages.map((p) => ({
          ...p,
          widgets: p.widgets.filter((w) => w.id !== widgetId),
        })),
        selectedWidgetId:
          state.application.selectedWidgetId === widgetId
            ? null
            : state.application.selectedWidgetId,
        metadata: { ...state.application.metadata, updatedAt: new Date() },
      };
      return pushHistory(state, newApplication);
    }

    case 'DUPLICATE_WIDGET': {
      const { widgetId } = action.payload;
      const page = state.application.pages.find((p) =>
        p.widgets.some((w) => w.id === widgetId)
      );
      const widget = page?.widgets.find((w) => w.id === widgetId);
      if (!widget) return state;

      const duplicated: Widget = {
        ...widget,
        id: `widget-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: `${widget.name} (copy)`,
        position: { ...widget.position, y: widget.position.y + 1 },
      };

      const newApplication = {
        ...state.application,
        pages: state.application.pages.map((p) =>
          p.id === page!.id ? { ...p, widgets: [...p.widgets, duplicated] } : p
        ),
      };
      return pushHistory(state, newApplication);
    }

    case 'MOVE_WIDGET': {
      const { widgetId, position } = action.payload;
      const newApplication = {
        ...state.application,
        pages: state.application.pages.map((p) => ({
          ...p,
          widgets: p.widgets.map((w) =>
            w.id === widgetId ? { ...w, position } : w
          ),
        })),
      };
      return pushHistory(state, newApplication);
    }

    // ============================================================
    // SELECTION
    // ============================================================

    case 'SELECT_WIDGET':
      return {
        ...state,
        ui: { ...state.ui, selectedWidgetId: action.payload.widgetId },
      };

    case 'HOVER_WIDGET':
      return {
        ...state,
        ui: { ...state.ui, hoveredWidgetId: action.payload.widgetId },
      };

    // ============================================================
    // CLIPBOARD
    // ============================================================

    case 'COPY_WIDGET': {
      const { widgetId } = action.payload;
      const page = state.application.pages.find((p) =>
        p.widgets.some((w) => w.id === widgetId)
      );
      const widget = page?.widgets.find((w) => w.id === widgetId);
      if (!widget) return state;
      return { ...state, ui: { ...state.ui, clipboard: widget } };
    }

    case 'PASTE_WIDGET': {
      if (!state.ui.clipboard) return state;
      const { position } = action.payload;
      const currentPage = state.application.pages.find(
        (p) => p.id === state.application.currentPageId
      );
      if (!currentPage) return state;

      const pasted: Widget = {
        ...state.ui.clipboard,
        id: `widget-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: `${state.ui.clipboard.name} (copy)`,
        position: {
          x: position.x,
          y: position.y,
          width: state.ui.clipboard.position.width,
          height: state.ui.clipboard.position.height,
        },
      };

      const newApplication = {
        ...state.application,
        pages: state.application.pages.map((p) =>
          p.id === currentPage.id ? { ...p, widgets: [...p.widgets, pasted] } : p
        ),
      };
      return pushHistory(state, newApplication);
    }

    // ============================================================
    // UI ACTIONS
    // ============================================================

    case 'SET_MODE':
      return { ...state, ui: { ...state.ui, mode: action.payload.mode } };

    case 'SET_ZOOM':
      return {
        ...state,
        ui: { ...state.ui, zoom: Math.max(0.25, Math.min(3, action.payload.zoom)) },
      };

    case 'TOGGLE_GRID':
      return { ...state, ui: { ...state.ui, gridVisible: !state.ui.gridVisible } };

    case 'SET_GRID_SIZE':
      return { ...state, ui: { ...state.ui, gridSize: action.payload.size } };

    case 'TOGGLE_SNAP':
      return { ...state, ui: { ...state.ui, snapToGrid: !state.ui.snapToGrid } };

    // ============================================================
    // PAGE ACTIONS
    // ============================================================

    case 'ADD_PAGE': {
      const newApplication = {
        ...state.application,
        pages: [...state.application.pages, action.payload.page],
        currentPageId: action.payload.page.id,
      };
      return pushHistory(state, newApplication);
    }

    case 'SET_CURRENT_PAGE':
      return {
        ...state,
        application: { ...state.application, currentPageId: action.payload.pageId },
        ui: { ...state.ui, selectedWidgetId: null, hoveredWidgetId: null },
      };

    case 'UPDATE_PAGE': {
      const { pageId, updates } = action.payload;
      const newApplication = {
        ...state.application,
        pages: state.application.pages.map((p) =>
          p.id === pageId ? { ...p, ...updates } : p
        ),
      };
      return pushHistory(state, newApplication);
    }

    case 'DELETE_PAGE': {
      const { pageId } = action.payload;
      if (state.application.pages.length <= 1) return state;
      const newApplication = {
        ...state.application,
        pages: state.application.pages.filter((p) => p.id !== pageId),
        currentPageId:
          state.application.currentPageId === pageId
            ? state.application.pages.find((p) => p.id !== pageId)?.id || null
            : state.application.currentPageId,
      };
      return pushHistory(state, newApplication);
    }

    // ============================================================
    // HISTORY
    // ============================================================

    case 'UNDO': {
      const { past, present, future } = state.history;
      if (past.length === 0) return state;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, -1);
      return {
        ...state,
        application: previous,
        history: {
          past: newPast,
          present: previous,
          future: [present, ...future],
        },
      };
    }

    case 'REDO': {
      const { past, present, future } = state.history;
      if (future.length === 0) return state;
      const next = future[0];
      const newFuture = future.slice(1);
      return {
        ...state,
        application: next,
        history: {
          past: [...past, present],
          present: next,
          future: newFuture,
        },
      };
    }

    case 'RESET':
      return initialState;

    case 'LOAD': {
      const loadedState = action.payload.state;
      return {
        ...state,
        application: loadedState,
        history: {
          past: [],
          present: loadedState,
          future: [],
        },
      };
    }

    default:
      return state;
  }
}

// ============================================================
// HISTORY HELPERS
// ============================================================

function pushHistory(state: BuilderState, newApplication: ApplicationState): BuilderState {
  const MAX_HISTORY = 50;
  const newPast = [...state.history.past, state.history.present];
  return {
    ...state,
    application: newApplication,
    history: {
      past: newPast.slice(-MAX_HISTORY),
      present: newApplication,
      future: [],
    },
  };
}

// ============================================================
// CONTEXT
// ============================================================

interface BuilderContextValue {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  // Convenience methods
  addWidget: (type: WidgetType, position: WidgetPosition) => void;
  updateWidget: (widgetId: string, updates: Partial<Widget>) => void;
  deleteWidget: (widgetId: string) => void;
  duplicateWidget: (widgetId: string) => void;
  selectWidget: (widgetId: string | null) => void;
  hoverWidget: (widgetId: string | null) => void;
  copyWidget: (widgetId: string) => void;
  pasteWidget: (position: { x: number; y: number }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setMode: (mode: 'design' | 'preview') => void;
  setZoom: (zoom: number) => void;
}

const BuilderContext = createContext<BuilderContextValue | undefined>(undefined);

export const BuilderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(builderReducer, initialState);

  const addWidget = useCallback(
    (type: WidgetType, position: WidgetPosition) => {
      const pageId = state.application.currentPageId;
      if (!pageId) return;
      const widget = createWidget(type, position);
      dispatch({ type: 'ADD_WIDGET', payload: { widget, pageId } });
      dispatch({ type: 'SELECT_WIDGET', payload: { widgetId: widget.id } });
    },
    [state.application.currentPageId]
  );

  const updateWidget = useCallback((widgetId: string, updates: Partial<Widget>) => {
    dispatch({ type: 'UPDATE_WIDGET', payload: { widgetId, updates } });
  }, []);

  const deleteWidget = useCallback((widgetId: string) => {
    dispatch({ type: 'DELETE_WIDGET', payload: { widgetId } });
  }, []);

  const duplicateWidget = useCallback((widgetId: string) => {
    dispatch({ type: 'DUPLICATE_WIDGET', payload: { widgetId } });
  }, []);

  const selectWidget = useCallback((widgetId: string | null) => {
    dispatch({ type: 'SELECT_WIDGET', payload: { widgetId } });
  }, []);

  const hoverWidget = useCallback((widgetId: string | null) => {
    dispatch({ type: 'HOVER_WIDGET', payload: { widgetId } });
  }, []);

  const copyWidget = useCallback((widgetId: string) => {
    dispatch({ type: 'COPY_WIDGET', payload: { widgetId } });
  }, []);

  const pasteWidget = useCallback((position: { x: number; y: number }) => {
    dispatch({ type: 'PASTE_WIDGET', payload: { position } });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const setMode = useCallback((mode: 'design' | 'preview') => {
    dispatch({ type: 'SET_MODE', payload: { mode } });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: 'SET_ZOOM', payload: { zoom } });
  }, []);

  const value: BuilderContextValue = {
    state,
    dispatch,
    addWidget,
    updateWidget,
    deleteWidget,
    duplicateWidget,
    selectWidget,
    hoverWidget,
    copyWidget,
    pasteWidget,
    undo,
    redo,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    setMode,
    setZoom,
  };

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
};

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder must be used within BuilderProvider');
  return ctx;
}

export default BuilderProvider;
