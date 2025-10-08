import TelegramBot from 'node-telegram-bot-api';
import { UserService } from '../services/user.service';
import { UserRole, User } from '../types/user.types';

const userService = new UserService();

// Extended context type for bot
export interface BotContext {
  from?: TelegramBot.User;
  message?: TelegramBot.Message;
  bot?: TelegramBot;
  session?: {
    user?: User;
    client?: any;
    selectedClientId?: number;
    waitingFor?: string;
    broadcastSegment?: string;
    operation?: any;
    editing?: any;
    registration?: any;
    clientData?: any;
    lastActivity?: Date;
  };
}

// Check if user is authorized staff member (barista, manager, admin)
export async function checkStaffAccess(ctx: BotContext): Promise<User | null> {
  if (!ctx.from) {
    return null;
  }

  const user = await userService.getByTelegramId(ctx.from.id);
  
  if (!user || !userService.canAccessBarista(user)) {
    return null;
  }

  // Initialize session if not exists
  if (!ctx.session) {
    ctx.session = {};
  }
  
  ctx.session.user = user;
  ctx.session.lastActivity = new Date();
  
  return user;
}

// Check if user has barista access
export async function checkBaristaAccess(ctx: BotContext): Promise<boolean> {
  const user = await checkStaffAccess(ctx);
  return user !== null && userService.canAccessBarista(user);
}

// Check if user has manager access
export async function checkManagerAccess(ctx: BotContext): Promise<boolean> {
  const user = await checkStaffAccess(ctx);
  return user !== null && userService.canAccessManager(user);
}

// Check if user is admin
export async function checkAdminAccess(ctx: BotContext): Promise<boolean> {
  const user = await checkStaffAccess(ctx);
  return user !== null && userService.isAdmin(user);
}

// Middleware factory for role-based access control
export function requireRole(requiredRoles: UserRole[]) {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    const user = await checkStaffAccess(ctx);
    
    if (!user) {
      if (ctx.message?.chat) {
        // Send access denied message
        return;
      }
      return;
    }

    if (!userService.hasRole(user, requiredRoles)) {
      if (ctx.message?.chat) {
        // Send insufficient permissions message
        return;
      }
      return;
    }

    await next();
  };
}

// Middleware for barista access
export const requireBaristaAccess = requireRole(['barista', 'manager', 'admin']);

// Middleware for manager access
export const requireManagerAccess = requireRole(['manager', 'admin']);

// Middleware for admin access
export const requireAdminAccess = requireRole(['admin']);

// Check if session is valid and not expired
export function checkSessionValidity(ctx: BotContext): boolean {
  if (!ctx.session?.user || !ctx.session?.lastActivity) {
    return false;
  }

  const sessionTimeout = 2 * 60 * 60 * 1000; // 2 hours
  const timeSinceLastActivity = Date.now() - ctx.session.lastActivity.getTime();
  
  if (timeSinceLastActivity > sessionTimeout) {
    // Session expired
    ctx.session = {};
    return false;
  }

  // Update last activity
  ctx.session.lastActivity = new Date();
  return true;
}

// Get current user from session
export function getCurrentUser(ctx: BotContext): User | null {
  if (!checkSessionValidity(ctx)) {
    return null;
  }
  
  return ctx.session?.user || null;
}

// Log user action for audit trail
export async function logUserAction(
  ctx: BotContext,
  action: string,
  targetType?: string,
  targetId?: number,
  details?: any
): Promise<void> {
  const user = getCurrentUser(ctx);
  if (!user) {
    return;
  }

  await userService.logActivity(
    user.id,
    action,
    targetType,
    targetId,
    details
  );
}

// Access control helper functions
export class AccessControl {
  
  // Check if user can view client data
  static async canViewClient(user: User, clientId: number): Promise<boolean> {
    // All staff can view clients (but with different data levels)
    return userService.canAccessBarista(user);
  }

  // Check if user can edit client data
  static async canEditClient(user: User, clientId: number): Promise<'none' | 'limited' | 'full'> {
    if (!userService.canAccessBarista(user)) {
      return 'none';
    }
    
    if (user.role === 'barista') {
      return 'limited'; // Only notes
    }
    
    if (userService.canAccessManager(user)) {
      return 'full'; // All client data
    }
    
    return 'none';
  }

  // Check if user can perform point operations
  static async canManagePoints(user: User): Promise<boolean> {
    return userService.canAccessBarista(user);
  }

  // Check if user can view statistics
  static async canViewStats(user: User, scope: 'own' | 'all'): Promise<boolean> {
    if (scope === 'own') {
      return userService.canAccessBarista(user);
    }
    
    if (scope === 'all') {
      return userService.canAccessManager(user);
    }
    
    return false;
  }

  // Check if user can manage staff
  static async canManageStaff(user: User): Promise<boolean> {
    return userService.canAccessManager(user);
  }
}

// Error messages for access control
export const ACCESS_DENIED_MESSAGES = {
  NOT_STAFF: '❌ Access denied. Staff authorization required.',
  NOT_BARISTA: '❌ This function requires barista access or higher.',
  NOT_MANAGER: '❌ This function is available only to managers and administrators.',
  NOT_ADMIN: '❌ Administrator access required.',
  SESSION_EXPIRED: '⏰ Your session has expired. Please authenticate again.',
  INSUFFICIENT_PERMISSIONS: '❌ You do not have sufficient permissions for this action.'
};