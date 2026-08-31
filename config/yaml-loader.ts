/**
 * COGNITIVE PLATFORM - YAML CONFIGURATION LOADER
 * 
 * Loads and parses YAML configuration files with environment variable substitution.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simple YAML parser (no external deps)
function parseYAML(content: string): any {
  const lines = content.split('\n');
  const result: any = {};
  let current: any = result;
  const stack: any[] = [result];
  const indentStack: number[] = [0];

  for (const line of lines) {
    // Skip comments and empty lines
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Pop stack if dedented
    while (indentStack.length > 1 && indent <= indentStack[indentStack.length - 1]) {
      stack.pop();
      indentStack.pop();
    }

    if (trimmed.endsWith(':')) {
      // Map key
      const key = trimmed.slice(0, -1).trim();
      const newMap: any = {};
      current[key] = newMap;
      stack.push(newMap);
      indentStack.push(indent);
      current = newMap;
    } else if (trimmed.includes(':')) {
      // Key-value pair
      const [key, ...rest] = trimmed.split(':');
      let value = rest.join(':').trim();

      // Parse value type
      if (value === 'null') value = null;
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^\d+$/.test(value)) value = parseInt(value);
      else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
      else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      // Else: keep as string

      current[key.trim()] = value;
    } else if (trimmed.startsWith('-')) {
      // Array item
      const value = trimmed.slice(1).trim();
      if (!Array.isArray(current)) {
        const arr: any[] = [];
        const key = Object.keys(stack[stack.length - 2]).pop();
        stack[stack.length - 2][key] = arr;
        current = arr;
      }
      current.push(value);
    }
  }

  return result;
}

/**
 * Substitute environment variables in config values
 * Supports ${VAR_NAME} and ${VAR_NAME:-default} syntax
 */
function substituteEnv(value: any): any {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}:]+)(?::-([^}]*))?\}/g, (match, key, defaultVal) => {
      return process.env[key] || defaultVal || match;
    });
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map(substituteEnv);
    }
    const result: any = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteEnv(v);
    }
    return result;
  }
  return value;
}

/**
 * YAML configuration loader
 */
export class YAMLConfigLoader {
  private cache = new Map<string, any>();

  /**
   * Load YAML file
   */
  load(path: string): any {
    if (this.cache.has(path)) {
      return this.cache.get(path);
    }

    try {
      const fullPath = resolve(path);
      const content = readFileSync(fullPath, 'utf-8');
      let config = parseYAML(content);
      config = substituteEnv(config);
      this.cache.set(path, config);
      return config;
    } catch (error) {
      throw new Error(`Failed to load YAML config from ${path}: ${error}`);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Singleton loader instance
 */
let loader: YAMLConfigLoader | null = null;

export function getYAMLLoader(): YAMLConfigLoader {
  if (!loader) {
    loader = new YAMLConfigLoader();
  }
  return loader;
}
