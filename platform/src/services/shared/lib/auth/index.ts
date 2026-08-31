// platform/src/services/shared/lib/auth/index.ts
// [38;5;240mAuthentication and Authorization Service[0m
// [38;5;240mJWT-based auth with multi-tenant support for OSINT platform[0m

import {
  UserRole,
  PermissionLevel,
  AccessControlEntry,
} from '../../types';
import { getConfig } from '../../config';

// ============================================================================
// [38;5;220mTYPES[0m
// ============================================================================

/**
 * [38;5;220mUser Credentials[0m
 */
export interface UserCredentials {
  email: string;
  password: string;
}

/**
 * [38;5;220mUser Registration Data[0m
 */
export interface UserRegistrationData extends UserCredentials {
  firstName: string;
  lastName: string;
  role?: UserRole;
}

/**
 * [38;5;220mUser Profile[0m
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  avatar?: string;
}

/**
 * [38;5;220mAuthentication Token[0m
 */
export interface AuthToken {
  token: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * [38;5;220mRefresh Token[0m
 */
export interface RefreshToken {
  token: string;
  expiresIn: number;
}

/**
 * [38;5;220mToken Pair (Access + Refresh)[0m
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * [38;5;220mToken Payload (Decoded JWT)[0m
 */
export interface TokenPayload {
  sub: string; // user ID
  email: string;
  role: UserRole;
  tenantId?: string;
  permissions?: PermissionLevel[];
  iat: number;
  exp: number;
  [key: string]: unknown;
}

/**
 * [38;5;220mTenant Information[0m
 */
export interface Tenant {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  settings?: Record<string, unknown>;
}

/**
 * [38;5;220mTenant Membership[0m
 */
export interface TenantMembership {
  tenantId: string;
  userId: string;
  role: UserRole;
  permissions: PermissionLevel[];
  joinedAt: string;
}

/**
 * [38;5;220mPassword Reset Request[0m
 */
export interface PasswordResetRequest {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

/**
 * [38;5;220mEmail Verification Request[0m
 */
export interface EmailVerificationRequest {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  verified: boolean;
  createdAt: string;
}

// ============================================================================
// [38;5;220mJWT SERVICE[0m
// ============================================================================

/**
 * [38;5;220mJWT Service for token management[0m
 */
export class JwtService {
  private secret: string;
  private expiresIn: number; // in seconds

  constructor(secret?: string, expiresIn?: number) {
    const config = getConfig();
    this.secret = secret || config.JWT_SECRET;
    this.expiresIn = expiresIn || this.parseExpiresIn(config.JWT_EXPIRES_IN);
  }

  /**
   * [38;5;220mParse expiresIn string to seconds[0m
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default: 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600;
    }
  }

  /**
   * [38;5;220mGenerate Access Token[0m
   */
  async generateAccessToken(
    payload: Omit<TokenPayload, 'iat' | 'exp'>
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    const tokenPayload: TokenPayload = {
      ...payload,
      iat: now,
      exp: now + this.expiresIn,
    };
    
    return this.signToken(tokenPayload);
  }

  /**
   * [38;5;220mGenerate Refresh Token[0m
   */
  async generateRefreshToken(
    userId: string
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = this.expiresIn * 24 * 7; // 7 days for refresh token
    
    const payload = {
      sub: userId,
      type: 'refresh',
      iat: now,
      exp: now + expiresIn,
    };
    
    return this.signToken(payload);
  }

  /**
   * [38;5;220mGenerate Token Pair[0m
   */
  async generateTokenPair(
    payload: Omit<TokenPayload, 'iat' | 'exp'>
  ): Promise<TokenPair> {
    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(payload.sub);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: this.expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * [38;5;220mSign JWT Token[0m
   */
  private async signToken(payload: Record<string, unknown>): Promise<string> {
    // This is a simple implementation
    // In production, you should use a proper JWT library
    
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };
    
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = await this.generateSignature(
      `${encodedHeader}.${encodedPayload}`
    );
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * [38;5;220mGenerate HMAC-SHA256 Signature[0m
   */
  private async generateSignature(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = encoder.encode(this.secret);
    const message = encoder.encode(data);
    
    const hashBuffer = await crypto.subtle.sign(
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign']),
      message
    );
    
    return this.base64UrlEncode(
      Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  /**
   * [38;5;220mVerify JWT Token[0m
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const expectedSignature = await this.generateSignature(
      `${encodedHeader}.${encodedPayload}`
    );
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }
    
    // Decode payload
    const payload = JSON.parse(
      this.base64UrlDecode(encodedPayload)
    ) as TokenPayload;
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    
    return payload;
  }

  /**
   * [38;5;220mDecode JWT Token (without verification)[0m
   */
  decodeToken(token: string): TokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const payload = JSON.parse(
      this.base64UrlDecode(parts[1])
    ) as TokenPayload;
    
    return payload;
  }

  /**
   * [38;5;220mBase64 URL Encode[0m
   */
  private base64UrlEncode(data: string): string {
    return btoa(data)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * [38;5;220mBase64 URL Decode[0m
   */
  private base64UrlDecode(data: string): string {
    const padded = data.padEnd(data.length + (4 - (data.length % 4)) % 4, '=');
    return atob(
      padded
        .replace(/-/g, '+')
        .replace(/_/g, '/')
    );
  }
}

// ============================================================================
// [38;5;220mAUTH SERVICE[0m
// ============================================================================

/**
 * [38;5;220mAuthentication Service[0m
 */
export class AuthService {
  private jwtService: JwtService;
  private users: Map<string, UserProfile> = new Map();
  private tenants: Map<string, Tenant> = new Map();
  private memberships: Map<string, TenantMembership[]> = new Map();

  constructor(jwtService?: JwtService) {
    this.jwtService = jwtService || new JwtService();
  }

  // ==========================================================================
  // [38;5;220mUSER MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mRegister a new user[0m
   */
  async registerUser(data: UserRegistrationData): Promise<{
    user: UserProfile;
    tokens: TokenPair;
  }> {
    // Check if user already exists
    if (this.users.has(data.email)) {
      throw new Error('User already exists');
    }
    
    // Create user profile
    const user: UserProfile = {
      id: `user_${Date.now()}`,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'viewer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.users.set(user.id, user);
    this.users.set(data.email, user);
    
    // Generate tokens
    const tokens = await this.jwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    
    return { user, tokens };
  }

  /**
   * [38;5;220mLogin user with credentials[0m
   */
  async login(credentials: UserCredentials): Promise<{
    user: UserProfile;
    tokens: TokenPair;
  }> {
    // Find user by email
    const user = this.users.get(credentials.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    // In a real implementation, verify password hash
    // For now, we'll just check if password is not empty
    if (!credentials.password) {
      throw new Error('Invalid credentials');
    }
    
    // Update last login
    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    
    // Generate tokens
    const tokens = await this.jwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    
    return { user, tokens };
  }

  /**
   * [38;5;220mLogout user[0m
   */
  async logout(token: string): Promise<void> {
    // In a real implementation, this would add the token to a blacklist
    // For now, we'll just do nothing
    console.log(`[38;5;220m[AuthService] User logged out: ${token.substring(0, 8)}...[0m`);
  }

  /**
   * [38;5;220mGet user by ID[0m
   */
  getUserById(id: string): UserProfile | undefined {
    return this.users.get(id);
  }

  /**
   * [38;5;220mGet user by email[0m
   */
  getUserByEmail(email: string): UserProfile | undefined {
    return this.users.get(email);
  }

  /**
   * [38;5;220mList all users[0m
   */
  listUsers(): UserProfile[] {
    return Array.from(this.users.values()).filter((_, index, self) => {
      // Remove duplicates (users are stored by both ID and email)
      return index === self.findIndex(u => u.id === _.id);
    });
  }

  /**
   * [38;5;220mUpdate user profile[0m
   */
  async updateUser(
    id: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    this.users.set(id, updatedUser);
    this.users.set(updatedUser.email, updatedUser);
    
    return updatedUser;
  }

  /**
   * [38;5;220mDelete user[0m
   */
  async deleteUser(id: string): Promise<void> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    this.users.delete(id);
    this.users.delete(user.email);
  }

  // ==========================================================================
  // [38;5;220mTENANT MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mCreate a new tenant[0m
   */
  async createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const tenant: Tenant = {
      id: `tenant_${Date.now()}`,
      name: data.name,
      description: data.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: data.settings,
    };
    
    this.tenants.set(tenant.id, tenant);
    this.tenants.set(data.name, tenant);
    
    return tenant;
  }

  /**
   * [38;5;220mGet tenant by ID[0m
   */
  getTenantById(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  /**
   * [38;5;220mGet tenant by name[0m
   */
  getTenantByName(name: string): Tenant | undefined {
    return this.tenants.get(name);
  }

  /**
   * [38;5;220mList all tenants[0m
   */
  listTenants(): Tenant[] {
    return Array.from(this.tenants.values()).filter((_, index, self) => {
      // Remove duplicates (tenants are stored by both ID and name)
      return index === self.findIndex(t => t.id === _.id);
    });
  }

  /**
   * [38;5;220mUpdate tenant[0m
   */
  async updateTenant(
    id: string,
    updates: Partial<Tenant>
  ): Promise<Tenant> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    
    const updatedTenant = {
      ...tenant,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    this.tenants.set(id, updatedTenant);
    this.tenants.set(updatedTenant.name, updatedTenant);
    
    return updatedTenant;
  }

  /**
   * [38;5;220mDelete tenant[0m
   */
  async deleteTenant(id: string): Promise<void> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    
    this.tenants.delete(id);
    this.tenants.delete(tenant.name);
    
    // Also delete all memberships for this tenant
    for (const [userId, memberships] of this.memberships) {
      const filtered = memberships.filter(m => m.tenantId !== id);
      if (filtered.length > 0) {
        this.memberships.set(userId, filtered);
      } else {
        this.memberships.delete(userId);
      }
    }
  }

  // ==========================================================================
  // [38;5;220mMEMBERSHIP MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mAdd user to tenant[0m
   */
  async addUserToTenant(
    tenantId: string,
    userId: string,
    role: UserRole,
    permissions: PermissionLevel[] = []
  ): Promise<TenantMembership> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const membership: TenantMembership = {
      tenantId,
      userId,
      role,
      permissions: permissions.length > 0 ? permissions : this.getDefaultPermissions(role),
      joinedAt: new Date().toISOString(),
    };
    
    const userMemberships = this.memberships.get(userId) || [];
    userMemberships.push(membership);
    this.memberships.set(userId, userMemberships);
    
    return membership;
  }

  /**
   * [38;5;220mRemove user from tenant[0m
   */
  async removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
    const userMemberships = this.memberships.get(userId);
    if (!userMemberships) {
      throw new Error('User is not a member of any tenant');
    }
    
    const filtered = userMemberships.filter(m => m.tenantId !== tenantId);
    
    if (filtered.length > 0) {
      this.memberships.set(userId, filtered);
    } else {
      this.memberships.delete(userId);
    }
  }

  /**
   * [38;5;220mGet user's tenant memberships[0m
   */
  getUserMemberships(userId: string): TenantMembership[] {
    return this.memberships.get(userId) || [];
  }

  /**
   * [38;5;220mGet tenant members[0m
   */
  getTenantMembers(tenantId: string): Array<TenantMembership & { user: UserProfile }> {
    const members: Array<TenantMembership & { user: UserProfile }> = [];
    
    for (const [userId, memberships] of this.memberships) {
      const tenantMembership = memberships.find(m => m.tenantId === tenantId);
      if (tenantMembership) {
        const user = this.users.get(userId);
        if (user) {
          members.push({
            ...tenantMembership,
            user,
          });
        }
      }
    }
    
    return members;
  }

  // ==========================================================================
  // [38;5;220mTOKEN MANAGEMENT[0m
  // ==========================================================================

  /**
   * [38;5;220mVerify access token[0m
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    return this.jwtService.verifyToken(token);
  }

  /**
   * [38;5;220mDecode access token (without verification)[0m
   */
  decodeToken(token: string): TokenPayload {
    return this.jwtService.decodeToken(token);
  }

  /**
   * [38;5;220mRefresh access token[0m
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const payload = this.jwtService.decodeToken(refreshToken);
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    
    // Check if user exists
    const user = this.users.get(payload.sub);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate new tokens
    const tokens = await this.jwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    
    return tokens;
  }

  // ==========================================================================
  // [38;5;220mACCESS CONTROL[0m
  // ==========================================================================

  /**
   * [38;5;220mCheck if user has permission for a resource[0m
   */
  async checkPermission(
    userId: string,
    resourceType: string,
    resourceId: string,
    permission: PermissionLevel
  ): Promise<boolean> {
    // Get user's memberships
    const memberships = this.getUserMemberships(userId);
    
    // Check each membership for the required permission
    for (const membership of memberships) {
      if (membership.permissions.includes(permission)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * [38;5;220mCheck if user has role for a resource[0m
   */
  async checkRole(
    userId: string,
    resourceType: string,
    resourceId: string,
    role: UserRole
  ): Promise<boolean> {
    // Get user's memberships
    const memberships = this.getUserMemberships(userId);
    
    // Check each membership for the required role
    for (const membership of memberships) {
      if (membership.role === role) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * [38;5;220mGet user's access control entries for a graph[0m
   */
  async getAccessControlEntries(
    graphId: string
  ): Promise<AccessControlEntry[]> {
    // In a real implementation, this would query the database
    // For now, we'll return an empty array
    return [];
  }

  /**
   * [38;5;220mSet access control for a graph[0m
   */
  async setAccessControl(
    graphId: string,
    entry: Omit<AccessControlEntry, 'grantedAt' | 'grantedBy'>
  ): Promise<AccessControlEntry> {
    const accessEntry: AccessControlEntry = {
      ...entry,
      grantedAt: new Date().toISOString(),
      grantedBy: 'system', // Would be the current user in a real implementation
    };
    
    // In a real implementation, this would save to the database
    
    return accessEntry;
  }

  // ==========================================================================
  // [38;5;220mUTILITY METHODS[0m
  // ==========================================================================

  /**
   * [38;5;220mGet default permissions for a role[0m
   */
  private getDefaultPermissions(role: UserRole): PermissionLevel[] {
    switch (role) {
      case 'admin':
        return ['read', 'write', 'delete', 'admin'];
      case 'editor':
        return ['read', 'write', 'delete'];
      case 'viewer':
        return ['read'];
      case 'guest':
        return [];
      default:
        return [];
    }
  }

  /**
   * [38;5;220mHash password (simple implementation)[0m
   */
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * [38;5;220mVerify password (simple implementation)[0m
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const hashed = await this.hashPassword(password);
    return hashed === hash;
  }
}

// ============================================================================
// [38;5;220mAUTH MIDDLEWARE[0m
// ============================================================================

/**
 * [38;5;220mAuthentication Middleware Options[0m
 */
export interface AuthMiddlewareOptions {
  roles?: UserRole[];
  permissions?: PermissionLevel[];
  tenantId?: string;
}

/**
 * [38;5;220mAuthentication Middleware[0m
 * [38;5;240mMiddleware for Express/HTTP handlers[0m
 */
export function createAuthMiddleware(
  authService: AuthService,
  options: AuthMiddlewareOptions = {}
) {
  return async (req: Request, res: Response, next: () => void) => {
    try {
      // Get token from header
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      // Verify token
      const payload = await authService.verifyToken(token);
      
      // Check role if required
      if (options.roles && !options.roles.includes(payload.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check tenant if required
      if (options.tenantId && payload.tenantId !== options.tenantId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Attach user to request
      (req as any).user = payload;
      
      next();
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

// ============================================================================
// [38;5;220mSINGLETON INSTANCES[0m
// ============================================================================

let jwtService: JwtService | null = null;
let authService: AuthService | null = null;

export function getJwtService(secret?: string, expiresIn?: number): JwtService {
  if (!jwtService) {
    jwtService = new JwtService(secret, expiresIn);
  }
  return jwtService;
}

export function getAuthService(jwtService?: JwtService): AuthService {
  if (!authService) {
    authService = new AuthService(jwtService);
  }
  return authService;
}

export function resetAuthService(): void {
  jwtService = null;
  authService = null;
}

// ============================================================================
// [38;5;220mEXPORTS[0m
// ============================================================================

export {
  JwtService,
  AuthService,
  createAuthMiddleware,
  getJwtService,
  getAuthService,
  resetAuthService,
};

export type {
  UserCredentials,
  UserRegistrationData,
  UserProfile,
  AuthToken,
  RefreshToken,
  TokenPair,
  TokenPayload,
  Tenant,
  TenantMembership,
  PasswordResetRequest,
  EmailVerificationRequest,
  AuthMiddlewareOptions,
};
