/**
 * COGNITIVE PLATFORM - SHARED UTILITIES
 * ======================================
 * 
 * [38;5;240mCommon Utility Functions and Helpers[0m
 * 
 * Features:
 * - ID generation
 * - Validation helpers
 * - Data transformation
 * - Type guards
 * - Performance utilities
 * - String manipulation
 * - Object utilities
 */

import { ID, ISODateString, DeepPartial, ValueOf } from '../types';

// ============================================================================
// ID UTILITIES
// ============================================================================

/** Generate unique ID */
export function generateId(prefix: string = 'id'): ID {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** Generate UUID v4 */
export function generateUUID(): ID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate short ID */
export function generateShortId(length: number = 8): ID {
  return Math.random().toString(36).substr(2, length);
}

/** Validate ID format */
export function isValidId(id: unknown): id is ID {
  return typeof id === 'string' && id.length > 0;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/** Get current ISO date string */
export function getCurrentISODate(): ISODateString {
  return new Date().toISOString();
}

/** Get current timestamp */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/** Format date for display */
export function formatDate(date: Date | string | number, locale: string = 'en-US'): string {
  const d = new Date(date);
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Calculate time ago */
export function timeAgo(date: Date | string | number): string {
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks}w ago`;
  }
  
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }
  
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/** Sleep for specified milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/** Check if value is null or undefined */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** Check if value is empty (null, undefined, empty string, empty array, empty object) */
export function isEmpty(value: unknown): boolean {
  if (isNullOrUndefined(value)) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

/** Check if value is a plain object */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Check if value is a function */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/** Check if value is a promise */
export function isPromise<T>(value: unknown): value is Promise<T> {
  return value instanceof Promise;
}

/** Check if value is an error */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/** Check if value is a number */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/** Check if value is a boolean */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** Check if value is a string */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Check if value is an array */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/** Type guard for Record */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}

/** Type guard for Array */
export function isArrayOf<T>(
  value: unknown,
  guard: (v: unknown) => v is T
): value is T[] {
  return isArray(value) && value.every(guard);
}

/** Type guard for Partial */
export function isPartial<T>(
  value: unknown,
  keys: (keyof T)[]
): value is DeepPartial<T> {
  if (!isRecord(value)) {
    return false;
  }
  
  for (const key of keys) {
    if (value[key as string] === undefined) {
      return false;
    }
  }
  
  return true;
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/** Deep clone an object */
export function deepClone<T>(value: T): T {
  if (isNullOrUndefined(value)) {
    return value;
  }
  
  if (isArray(value)) {
    return value.map(deepClone) as unknown as T;
  }
  
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepClone(v)])
    ) as T;
  }
  
  return value;
}

/** Deep merge objects */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: DeepPartial<T>
): T {
  const result = { ...target };
  
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = result[key];
    
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (isArray(sourceValue) && isArray(targetValue)) {
      result[key] = [...targetValue, ...sourceValue] as T[Extract<keyof T, string>];
    } else {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }
  
  return result;
}

/** Pick properties from object */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return Object.fromEntries(
    keys.filter(k => k in obj).map(k => [k, obj[k]])
  ) as Pick<T, K>;
}

/** Omit properties from object */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !keys.includes(k as K))
  ) as Omit<T, K>;
}

/** Map object keys */
export function mapKeys<T extends Record<string, unknown>>(
  obj: T,
  mapper: (key: string) => string
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [mapper(k), v])
  );
}

/** Map object values */
export function mapValues<T extends Record<string, unknown>>(
  obj: T,
  mapper: (value: unknown, key: string) => unknown
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, mapper(v, k)])
  );
}

/** Filter object entries */
export function filterEntries<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: unknown, key: string) => boolean
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([k, v]) => predicate(v, k))
  );
}

/** Invert an object (swap keys and values) */
export function invert<T extends Record<string, string>>(
  obj: T
): Record<ValueOf<T>, string> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [v, k])
  ) as Record<ValueOf<T>, string>;
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/** Chunk array into smaller arrays */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  
  return chunks;
}

/** Flatten array */
export function flatten<T>(array: (T | T[])[]): T[] {
  return array.reduce<T[]>((acc, item) => {
    if (isArray(item)) {
      acc.push(...item);
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
}

/** Group array by key */
export function groupBy<T extends Record<string, unknown>, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> {
  return array.reduce<Record<string, T[]>>((acc, item) => {
    const keyValue = String(item[key]);
    if (!acc[keyValue]) {
      acc[keyValue] = [];
    }
    acc[keyValue].push(item);
    return acc;
  }, {});
}

/** Key by property */
export function keyBy<T extends Record<string, unknown>, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T> {
  return array.reduce<Record<string, T>>((acc, item) => {
    const keyValue = String(item[key]);
    acc[keyValue] = item;
    return acc;
  }, {});
}

/** Unique array by key */
export function uniqueBy<T extends Record<string, unknown>, K extends keyof T>(
  array: T[],
  key: K
): T[] {
  const seen = new Set<string>();
  return array.filter(item => {
    const keyValue = String(item[key]);
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
}

/** Sort array by key */
export function sortBy<T extends Record<string, unknown>, K extends keyof T>(
  array: T[],
  key: K,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal === bVal) {
      return 0;
    }
    
    const comparison = aVal < bVal ? -1 : 1;
    return order === 'asc' ? comparison : -comparison;
  });
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/** Capitalize first letter */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Lowercase first letter */
export function lowerCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/** Convert to camel case */
export function toCamelCase(str: string): string {
  return str.replace(/[_-]([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Convert to snake case */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

/** Convert to kebab case */
export function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

/** Convert to pascal case */
export function toPascalCase(str: string): string {
  return str.replace(/[_-]([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/^[a-z]/, letter => letter.toUpperCase());
}

/** Truncate string */
export function truncate(str: string, length: number): string {
  if (str.length <= length) {
    return str;
  }
  return str.slice(0, length) + '...';
}

/** Pad string */
export function pad(str: string, length: number, char: string = ' '): string {
  if (str.length >= length) {
    return str;
  }
  return str + char.repeat(length - str.length);
}

/** Pad start */
export function padStart(str: string, length: number, char: string = ' '): string {
  if (str.length >= length) {
    return str;
  }
  return char.repeat(length - str.length) + str;
}

/** Slugify string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// NUMBER UTILITIES
// ============================================================================

/** Clamp number between min and max */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/** Round number to decimal places */
export function round(num: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/** Format number */
export function formatNumber(
  num: number,
  locale: string = 'en-US',
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(locale, options).format(num);
}

/** Format bytes */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${round(bytes / 1024, 2)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${round(bytes / (1024 * 1024), 2)} MB`;
  }
  return `${round(bytes / (1024 * 1024 * 1024), 2)} GB`;
}

/** Format percentage */
export function formatPercentage(num: number, decimals: number = 2): string {
  return `${round(num * 100, decimals)}%`;
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/** Performance timer */
export class PerformanceTimer {
  private startTime: number;
  private marks: Record<string, number> = {};
  
  constructor() {
    this.startTime = performance.now();
  }
  
  /** Mark a point in time */
  public mark(name: string): void {
    this.marks[name] = performance.now();
  }
  
  /** Get time since start */
  public getTime(): number {
    return performance.now() - this.startTime;
  }
  
  /** Get time between marks */
  public getTimeBetween(startMark: string, endMark: string): number {
    const start = this.marks[startMark];
    const end = this.marks[endMark];
    
    if (start === undefined || end === undefined) {
      return 0;
    }
    
    return end - start;
  }
  
  /** Get all marks */
  public getMarks(): Record<string, number> {
    return { ...this.marks };
  }
  
  /** Reset timer */
  public reset(): void {
    this.startTime = performance.now();
    this.marks = {};
  }
}

/** Measure function execution time */
export async function measure<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await Promise.resolve(fn());
  const duration = performance.now() - start;
  
  return { result, duration };
}

// ============================================================================
// URL UTILITIES
// ============================================================================

/** Parse URL query string */
export function parseQuery(query: string): Record<string, string> {
  const params = new URLSearchParams(query);
  const result: Record<string, string> = {};
  
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  
  return result;
}

/** Stringify query parameters */
export function stringifyQuery(params: Record<string, unknown>): string {
  return new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
}

/** Join URL paths */
export function joinPaths(...paths: string[]): string {
  return paths
    .map(p => p.replace(/^\/+|\/+$/g, ''))
    .filter(p => p)
    .join('/');
}

/** Is absolute URL */
export function isAbsoluteUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** Is relative URL */
export function isRelativeUrl(url: string): boolean {
  return !isAbsoluteUrl(url);
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/** ANSI color codes */
export const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const;

/** Colorize text */
export function colorize(
  text: string,
  color: keyof typeof COLORS = 'reset'
): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/** Log with color */
export function logColor(
  text: string,
  color: keyof typeof COLORS = 'reset'
): void {
  console.log(colorize(text, color));
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  // ID utilities
  generateId,
  generateUUID,
  generateShortId,
  isValidId,
  
  // Date utilities
  getCurrentISODate,
  getCurrentTimestamp,
  formatDate,
  timeAgo,
  sleep,
  
  // Validation utilities
  isNullOrUndefined,
  isEmpty,
  isPlainObject,
  isFunction,
  isPromise,
  isError,
  isNumber,
  isBoolean,
  isString,
  isArray,
  
  // Type guards
  isRecord,
  isArrayOf,
  isPartial,
  
  // Object utilities
  deepClone,
  deepMerge,
  pick,
  omit,
  mapKeys,
  mapValues,
  filterEntries,
  invert,
  
  // Array utilities
  chunk,
  flatten,
  groupBy,
  keyBy,
  uniqueBy,
  sortBy,
  
  // String utilities
  capitalize,
  lowerCase,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  toPascalCase,
  truncate,
  pad,
  padStart,
  slugify,
  
  // Number utilities
  clamp,
  round,
  formatNumber,
  formatBytes,
  formatPercentage,
  
  // Performance utilities
  PerformanceTimer,
  measure,
  
  // URL utilities
  parseQuery,
  stringifyQuery,
  joinPaths,
  isAbsoluteUrl,
  isRelativeUrl,
  
  // Color utilities
  COLORS,
  colorize,
  logColor,
};
