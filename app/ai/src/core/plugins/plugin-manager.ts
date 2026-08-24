/**
 * VYENFITA Plugin Manager
 * 
 * Manages plugins for VYENFITA platform
 * - Load plugins
 * - Register plugins
 * - Execute plugin hooks
 * - Manage plugin lifecycle
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  hooks: PluginHook[];
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginHook {
  id: string;
  type: 'before_generation' | 'after_generation' | 'before_validation' | 'after_validation' | 'before_workflow' | 'after_workflow' | 'before_bi' | 'after_bi' | 'before_versioning' | 'after_versioning';
  name: string;
  handler: (data: any) => Promise<any>;
  priority: number;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  hooks: {
    type: PluginHook['type'];
    name: string;
    priority: number;
  }[];
}

export class PluginManager {
  private plugins: Map<string, Plugin>;
  private hookRegistry: Map<PluginHook['type'], PluginHook[]>;

  constructor() {
    this.plugins = new Map();
    this.hookRegistry = new Map();
    
    // Initialize hook registry
    const hookTypes: PluginHook['type'][] = [
      'before_generation', 'after_generation',
      'before_validation', 'after_validation',
      'before_workflow', 'after_workflow',
      'before_bi', 'after_bi',
      'before_versioning', 'after_versioning'
    ];
    
    for (const type of hookTypes) {
      this.hookRegistry.set(type, []);
    }
  }

  /**
   * Register a plugin
   */
  registerPlugin(manifest: PluginManifest, config: Record<string, any> = {}): Plugin {
    const plugin: Plugin = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      enabled: true,
      hooks: [],
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Register hooks
    for (const hookDef of manifest.hooks) {
      // In production, this would dynamically import the handler
      // For now, we'll create a placeholder
      const hook: PluginHook = {
        id: uuidv4(),
        type: hookDef.type,
        name: hookDef.name,
        priority: hookDef.priority,
        handler: async (data: any) => {
          // Placeholder - in production, this would call the actual plugin code
          return { ...data, plugin: plugin.id };
        },
      };
      plugin.hooks.push(hook);
      this.hookRegistry.get(hookDef.type)?.push(hook);
    }

    // Sort hooks by priority
    for (const [type, hooks] of this.hookRegistry) {
      hooks.sort((a, b) => a.priority - b.priority);
    }

    this.plugins.set(plugin.id, plugin);
    return plugin;
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    // Remove all hooks
    for (const hook of plugin.hooks) {
      const hooks = this.hookRegistry.get(hook.type);
      if (hooks) {
        const index = hooks.findIndex(h => h.id === hook.id);
        if (index !== -1) {
          hooks.splice(index, 1);
        }
      }
    }

    return this.plugins.delete(pluginId);
  }

  /**
   * Execute hooks for a specific type
   */
  async executeHooks(type: PluginHook['type'], data: any): Promise<any> {
    const hooks = this.hookRegistry.get(type) || [];
    let result = data;

    for (const hook of hooks) {
      try {
        result = await hook.handler(result);
      } catch (error) {
        console.error(`Hook execution failed: ${hook.name}`, error);
        // Continue with other hooks
      }
    }

    return result;
  }

  /**
   * Get all plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin
   */
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Enable a plugin
   */
  enablePlugin(id: string): boolean {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    plugin.enabled = true;
    plugin.updatedAt = new Date();
    return true;
  }

  /**
   * Disable a plugin
   */
  disablePlugin(id: string): boolean {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    plugin.enabled = false;
    plugin.updatedAt = new Date();
    return true;
  }

  /**
   * Update plugin configuration
   */
  updatePluginConfig(id: string, config: Record<string, any>): boolean {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    plugin.config = { ...plugin.config, ...config };
    plugin.updatedAt = new Date();
    return true;
  }
}
