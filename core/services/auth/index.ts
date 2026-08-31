/**
 * COGNITIVE PLATFORM - AUTH SERVICE
 * ====================================
 * 
 * [38;5;240mAuthentication and Authorization Service[0m
 * 
 * Features:
 * - JWT-based authentication
 * - Multi-tenant support
 * - Role-based access control
 * - Session management
 * - Password hashing
 * - Token management
 */

import { config } from '../../config';
import {
  User,
  UserRole,
  UserPreferences,
  AuthToken,
  AuthCredentials,
  Tenant,
  TenantConfig,
  ID,
  ISODateString,
} from '../../types';
import { CognitiveError } from '../../errors';
import { logger } from '../../logger';
import { CacheService } from '../cache';
import { EventBus } from '../eventBus';

// ============================================================================
// PASSWORD UTILITIES
// ============================================================================

/** Password hasher */
export class PasswordHasher {
  private algorithm: string;
  private saltRounds: number;
  
  constructor(algorithm: string = 'bcrypt', saltRounds: number = 12) {
    this.algorithm = algorithm;
    this.saltRounds = saltRounds;
  }
  
  /** Hash password */
  public async hash(password: string): Promise<string> {
    if (this.algorithm === 'bcrypt') {
      const bcrypt = require('bcrypt');
      return bcrypt.hash(password, this.saltRounds);
    } else {
      // Fallback to simple hash (not secure!)
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(password).digest('hex');
    }
  }
  
  /** Verify password */
  public async verify(password: string, hash: string): Promise<boolean> {
    if (this.algorithm === 'bcrypt') {
      const bcrypt = require('bcrypt');
      return bcrypt.compare(password, hash);
    } else {
      // Fallback to simple comparison
      const crypto = require('crypto');
      const hashed = crypto.createHash('sha256').update(password).digest('hex');
      return hashed === hash;
    }
  }
}

// ============================================================================
// JWT UTILITIES
// ============================================================================

/** JWT Token Manager */
export class JwtTokenManager {
  private secret: string;
  private expiresIn: string;
  private refreshExpiresIn: string;
  
  constructor() {
    const authConfig = config.get().auth;
    this.secret = authConfig.jwt.secret;
    this.expiresIn = authConfig.jwt.expiresIn;
    this.refreshExpiresIn = authConfig.jwt.refreshExpiresIn;
  }
  
  /** Generate access token */
  public generateAccessToken(payload: Record<string, unknown>): string {
    const jwt = require('jsonwebtoken');
    
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }
  
  /** Generate refresh token */
  public generateRefreshToken(payload: Record<string, unknown>): string {
    const jwt = require('jsonwebtoken');
    
    return jwt.sign(payload, this.secret, { expiresIn: this.refreshExpiresIn });
  }
  
  /** Verify token */
  public verifyToken(token: string): Record<string, unknown> | null {
    const jwt = require('jsonwebtoken');
    
    try {
      return jwt.verify(token, this.secret) as Record<string, unknown>;
    } catch (error) {
      logger.error('JWT verification failed', {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }
  
  /** Decode token without verification */
  public decodeToken(token: string): Record<string, unknown> | null {
    const jwt = require('jsonwebtoken');
    
    try {
      return jwt.decode(token) as Record<string, unknown>;
    } catch (error) {
      return null;
    }
  }
}

// ============================================================================
// SESSION MANAGER
// ============================================================================

/** Session */
export interface Session {
  id: ID;
  userId: ID;
  tenantId?: ID;
  accessToken: string;
  refreshToken: string;
  expiresAt: ISODateString;
  createdAt: ISODateString;
  ipAddress?: string;
  userAgent?: string;
}

/** Session Manager */
export class SessionManager {
  private sessions: Map<ID, Session> = new Map();
  private tokenManager: JwtTokenManager;
  
  constructor() {
    this.tokenManager = new JwtTokenManager();
  }
  
  /** Create session */
  public async createSession(user: User, ipAddress?: string, userAgent?: string): Promise<Session> {
    const sessionId = this.generateId('session');
    const now = new Date().toISOString();
    const expiresIn = this.parseDuration(config.get().auth.jwt.expiresIn);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    // Generate tokens
    const accessToken = this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      tenantId: user.tenantId,
    });
    
    const refreshToken = this.tokenManager.generateRefreshToken({
      sub: user.id,
    });
    
    const session: Session = {
      id: sessionId,
      userId: user.id,
      tenantId: user.tenantId,
      accessToken,
      refreshToken,
      expiresAt,
      createdAt: now,
      ipAddress,
      userAgent,
    };
    
    this.sessions.set(sessionId, session);
    
    logger.info('Session created', {
      sessionId,
      userId: user.id,
      email: user.email,
    });
    
    return session;
  }
  
  /** Get session */
  public getSession(sessionId: ID): Session | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) return null;
    
    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    return session;
  }
  
  /** Get session by access token */
  public getSessionByToken(token: string): Session | null {
    const payload = this.tokenManager.verifyToken(token);
    if (!payload) return null;
    
    const userId = payload.sub as string;
    
    // Find session by user
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.accessToken === token) {
        return session;
      }
    }
    
    return null;
  }
  
  /** Refresh session */
  public async refreshSession(refreshToken: string): Promise<Session | null> {
    const payload = this.tokenManager.verifyToken(refreshToken);
    if (!payload) return null;
    
    const userId = payload.sub as string;
    
    // Find session by user
    let session: Session | null = null;
    for (const s of this.sessions.values()) {
      if (s.userId === userId && s.refreshToken === refreshToken) {
        session = s;
        break;
      }
    }
    
    if (!session) return null;
    
    // Generate new tokens
    const accessToken = this.tokenManager.generateAccessToken({
      sub: userId,
      // In a real implementation, we'd have the user data here
    });
    
    const newRefreshToken = this.tokenManager.generateRefreshToken({
      sub: userId,
    });
    
    // Update session
    const expiresIn = this.parseDuration(config.get().auth.jwt.expiresIn);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    session.accessToken = accessToken;
    session.refreshToken = newRefreshToken;
    session.expiresAt = expiresAt;
    
    return session;
  }
  
  /** Delete session */
  public deleteSession(sessionId: ID): boolean {
    return this.sessions.delete(sessionId);
  }
  
  /** Delete all sessions for user */
  public deleteUserSessions(userId: ID): number {
    let count = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    
    return count;
  }
  
  /** Delete expired sessions */
  public deleteExpiredSessions(): number {
    const now = new Date();
    let count = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    
    return count;
  }
  
  /** Generate unique ID */
  private generateId(prefix: string): ID {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /** Parse duration string */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd]?)$/i);
    
    if (!match) return 3600; // Default to 1 hour
    
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 60 * 60;
      case 'd': return num * 24 * 60 * 60;
      default: return num * 60 * 60; // Default to hours
    }
  }
}

// ============================================================================
// TENANT MANAGER
// ============================================================================

/** Tenant Manager */
export class TenantManager {
  private tenants: Map<ID, Tenant> = new Map();
  
  constructor() {
    this.initializeDefaultTenant();
  }
  
  /** Initialize default tenant */
  private initializeDefaultTenant(): void {
    const defaultTenant: Tenant = {
      id: 'default',
      name: 'Default Tenant',
      description: 'Default tenant for the platform',
      config: {
        theme: {
          primaryColor: '#4F8EF7',
          logo: '',
        },
        features: {
          tda: true,
          ai: true,
          globe: true,
          pipeline: true,
        },
      },
      maxUsers: 100,
      maxGraphs: 1000,
      maxStorage: 1024 * 1024 * 1024, // 1GB
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.tenants.set(defaultTenant.id, defaultTenant);
  }
  
  /** Create tenant */
  public async createTenant(tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const id = this.generateId('tenant');
    const now = new Date().toISOString();
    
    const newTenant: Tenant = {
      ...tenant,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    this.tenants.set(id, newTenant);
    
    logger.info('Tenant created', { id, name: tenant.name });
    
    return newTenant;
  }
  
  /** Get tenant */
  public getTenant(id: ID): Tenant | null {
    return this.tenants.get(id) || null;
  }
  
  /** Get all tenants */
  public getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }
  
  /** Update tenant */
  public updateTenant(id: ID, updates: Partial<Tenant>): Tenant | null {
    const tenant = this.tenants.get(id);
    if (!tenant) return null;
    
    const updated = { ...tenant, ...updates, updatedAt: new Date().toISOString() };
    this.tenants.set(id, updated);
    
    return updated;
  }
  
  /** Delete tenant */
  public deleteTenant(id: ID): boolean {
    return this.tenants.delete(id);
  }
  
  /** Check if tenant exists */
  public hasTenant(id: ID): boolean {
    return this.tenants.has(id);
  }
  
  /** Generate unique ID */
  private generateId(prefix: string): ID {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// AUTH SERVICE
// ============================================================================

/** Auth Service */
export class AuthService {
  private cache: CacheService;
  private eventBus: EventBus;
  private passwordHasher: PasswordHasher;
  private tokenManager: JwtTokenManager;
  private sessionManager: SessionManager;
  private tenantManager: TenantManager;
  private users: Map<ID, User> = new Map();
  
  constructor() {
    this.cache = new CacheService();
    this.eventBus = EventBus.getInstance();
    this.passwordHasher = new PasswordHasher();
    this.tokenManager = new JwtTokenManager();
    this.sessionManager = new SessionManager();
    this.tenantManager = new TenantManager();
    
    this.initializeDefaultUser();
  }
  
  /** Initialize default admin user */
  private initializeDefaultUser(): void {
    const defaultUser: User = {
      id: 'admin',
      email: 'admin@cognitive.local',
      username: 'admin',
      roles: ['admin'],
      tenantId: 'default',
      isActive: true,
      isVerified: true,
      loginCount: 0,
      preferences: {
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        pageSize: 20,
        autoRefresh: true,
        autoRefreshInterval: 30,
        emailNotifications: true,
        pushNotifications: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.users.set(defaultUser.id, defaultUser);
    
    // Set password (in a real app, this would be hashed)
    this.cache.set('user:admin:password', 'admin123');
  }
  
  // ==========================================================================
  // USER MANAGEMENT
  // ==========================================================================
  
  /** Create user */
  public async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'loginCount'>): Promise<User> {
    const id = this.generateId('user');
    const now = new Date().toISOString();
    
    // Validate tenant
    if (user.tenantId && !this.tenantManager.hasTenant(user.tenantId)) {
      throw new CognitiveError(
        'TENANT_NOT_FOUND',
        `Tenant ${user.tenantId} not found`,
        'auth'
      );
    }
    
    const newUser: User = {
      ...user,
      id,
      loginCount: 0,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      isVerified: false,
      preferences: user.preferences || {
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        pageSize: 20,
        autoRefresh: true,
        autoRefreshInterval: 30,
        emailNotifications: true,
        pushNotifications: true,
      },
    };
    
    this.users.set(id, newUser);
    
    // Emit event
    await this.eventBus.emit('auth:user_created', { user: newUser });
    
    logger.info('User created', { id, email: user.email, username: user.username });
    
    return newUser;
  }
  
  /** Get user by ID */
  public getUser(id: ID): User | null {
    return this.users.get(id) || null;
  }
  
  /** Get user by email */
  public getUserByEmail(email: string): User | null {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }
  
  /** Get user by username */
  public getUserByUsername(username: string): User | null {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }
  
  /** Get all users */
  public getAllUsers(): User[] {
    return Array.from(this.users.values());
  }
  
  /** Update user */
  public updateUser(id: ID, updates: Partial<User>): User | null {
    const user = this.users.get(id);
    if (!user) return null;
    
    const updated = { ...user, ...updates, updatedAt: new Date().toISOString() };
    this.users.set(id, updated);
    
    // Emit event
    this.eventBus.emit('auth:user_updated', { user: updated });
    
    return updated;
  }
  
  /** Delete user */
  public async deleteUser(id: ID): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    
    // Delete sessions
    this.sessionManager.deleteUserSessions(id);
    
    this.users.delete(id);
    
    // Emit event
    await this.eventBus.emit('auth:user_deleted', { userId: id });
    
    return true;
  }
  
  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================
  
  /** Login user */
  public async login(credentials: AuthCredentials): Promise<AuthToken & { user: User }> {
    // Get user
    const user = this.getUserByEmail(credentials.email);
    if (!user) {
      throw new CognitiveError(
        'UNAUTHORIZED',
        'Invalid email or password',
        'auth'
      );
    }
    
    // Check if active
    if (!user.isActive) {
      throw new CognitiveError(
        'UNAUTHORIZED',
        'User account is disabled',
        'auth'
      );
    }
    
    // Verify password
    const password = await this.cache.get<string>(`user:${user.id}:password`);
    if (!password || password !== credentials.password) {
      throw new CognitiveError(
        'UNAUTHORIZED',
        'Invalid email or password',
        'auth'
      );
    }
    
    // Update login count
    user.loginCount++;
    user.lastLogin = new Date().toISOString();
    this.users.set(user.id, user);
    
    // Create session
    const session = await this.sessionManager.createSession(
      user,
      credentials.ipAddress,
      credentials.userAgent
    );
    
    // Emit event
    await this.eventBus.emit('auth:user_login', { user, session });
    
    logger.info('User logged in', { userId: user.id, email: user.email });
    
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: this.parseDuration(config.get().auth.jwt.expiresIn),
      tokenType: 'Bearer',
      user,
    };
  }
  
  /** Logout user */
  public async logout(token: string): Promise<boolean> {
    const session = this.sessionManager.getSessionByToken(token);
    if (!session) return false;
    
    const user = this.getUser(session.userId);
    if (!user) return false;
    
    // Delete session
    this.sessionManager.deleteSession(session.id);
    
    // Emit event
    await this.eventBus.emit('auth:user_logout', { user, session });
    
    logger.info('User logged out', { userId: user.id, email: user.email });
    
    return true;
  }
  
  /** Refresh token */
  public async refreshToken(refreshToken: string): Promise<AuthToken> {
    const session = await this.sessionManager.refreshSession(refreshToken);
    if (!session) {
      throw new CognitiveError(
        'UNAUTHORIZED',
        'Invalid refresh token',
        'auth'
      );
    }
    
    const user = this.getUser(session.userId);
    if (!user) {
      throw new CognitiveError(
        'UNAUTHORIZED',
        'User not found',
        'auth'
      );
    }
    
    // Emit event
    await this.eventBus.emit('auth:token_refreshed', { user, session });
    
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: this.parseDuration(config.get().auth.jwt.expiresIn),
      tokenType: 'Bearer',
    };
  }
  
  // ==========================================================================
  // AUTHORIZATION
  // ==========================================================================
  
  /** Check if user has role */
  public hasRole(user: User, role: UserRole | UserRole[]): boolean {
    const roles = Array.isArray(role) ? role : [role];
    return roles.some(r => user.roles.includes(r));
  }
  
  /** Check if user has permission */
  public hasPermission(user: User, permission: string | string[]): boolean {
    const permissions = Array.isArray(permission) ? permission : [permission];
    
    // In a real implementation, check user permissions
    // For now, admins have all permissions
    if (user.roles.includes('admin')) {
      return true;
    }
    
    // Check role-based permissions
    const rolePermissions: Record<UserRole, string[]> = {
      admin: ['*'],
      analyst: ['read:graph', 'write:graph', 'read:analysis', 'write:analysis'],
      investigator: ['read:graph', 'write:graph', 'read:analysis', 'write:analysis', 'read:ai'],
      viewer: ['read:graph', 'read:analysis'],
      guest: ['read:public'],
    };
    
    for (const role of user.roles) {
      const rolePerms = rolePermissions[role] || [];
      if (rolePerms.includes('*') || permissions.some(p => rolePerms.includes(p))) {
        return true;
      }
    }
    
    return false;
  }
  
  // ==========================================================================
  // TOKEN MANAGEMENT
  // ==========================================================================
  
  /** Verify access token */
  public verifyToken(token: string): { user: User; session: Session } | null {
    const session = this.sessionManager.getSessionByToken(token);
    if (!session) return null;
    
    const user = this.getUser(session.userId);
    if (!user) return null;
    
    return { user, session };
  }
  
  /** Decode token */
  public decodeToken(token: string): Record<string, unknown> | null {
    return this.tokenManager.decodeToken(token);
  }
  
  // ==========================================================================
  // TENANT MANAGEMENT
  // ==========================================================================
  
  /** Get tenant manager */
  public getTenantManager(): TenantManager {
    return this.tenantManager;
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /** Generate unique ID */
  private generateId(prefix: string): ID {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /** Parse duration string */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd]?)$/i);
    
    if (!match) return 3600; // Default to 1 hour
    
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 60 * 60;
      case 'd': return num * 24 * 60 * 60;
      default: return num * 60 * 60; // Default to hours
    }
  }
  
  /** Get service status */
  public async getStatus(): Promise<{
    userCount: number;
    tenantCount: number;
    activeSessions: number;
  }> {
    return {
      userCount: this.users.size,
      tenantCount: this.tenantManager.getAllTenants().length,
      activeSessions: this.sessionManager['sessions'].size,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let authServiceInstance: AuthService | null = null;

/** Get singleton instance */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}

// Export singleton
export const authService = getAuthService();

// Export utilities
export {
  PasswordHasher,
  JwtTokenManager,
  SessionManager,
  Session,
  TenantManager,
};
