import TelegramBot from 'node-telegram-bot-api';
import { ClientService } from '../services/client.service';
import { UserService } from '../services/user.service';
import { BotContext } from './access.middleware';

const clientService = new ClientService();
const userService = new UserService();

// Check if user is authenticated as a client (new contact-based system)
export async function ensureClientAuthenticated(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (!ctx.from) {
    return;
  }

  try {
    const client = await clientService.getByTelegramIdWithAuth(ctx.from.id);
    
    if (!client) {
      if (ctx.message?.chat?.id) {
        await sendAuthenticationPrompt(ctx);
      }
      return;
    }
    
    // Add client to session
    if (!ctx.session) {
      ctx.session = {};
    }
    ctx.session.client = client;
    
    await next();
    
  } catch (error) {
    console.error('Client authentication check error:', error);
    if (ctx.message?.chat?.id) {
      await sendErrorMessage(ctx, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }
}

// Ensure user is NOT authenticated (for authentication process)
export async function ensureNotAuthenticated(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (!ctx.from) {
    return;
  }

  try {
    // Check if user is a client
    const client = await clientService.getByTelegramIdWithAuth(ctx.from.id);
    if (client) {
      // User is already authenticated as client, show main menu
      const { ClientHandler } = await import('../handlers/client.handler');
      const clientHandler = new ClientHandler(ctx.bot as TelegramBot);
      await clientHandler.showMainMenu(ctx);
      return;
    }

    // Check if user is staff
    const staff = await userService.getByTelegramId(ctx.from.id);
    if (staff && ['barista', 'manager', 'admin'].includes(staff.role)) {
      // User is staff, show appropriate interface
      if (ctx.message?.chat?.id) {
        await sendStaffMessage(ctx);
      }
      return;
    }
    
    await next();
    
  } catch (error) {
    console.error('Authentication check error:', error);
    if (ctx.message?.chat?.id) {
      await sendErrorMessage(ctx, '❌ Произошла ошибка при проверке авторизации.');
    }
  }
}

// Handle text input based on current session state (updated for new auth flow)
export async function handleTextInput(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const { waitingFor } = ctx.session || {};
  
  if (!waitingFor) {
    await next();
    return;
  }

  if (!ctx.message?.text && !ctx.message?.contact) {
    await next();
    return;
  }

  try {
    const text = ctx.message.text || ctx.message.contact?.phone_number;
    
    if (!text) {
      await next();
      return;
    }

    // Import handlers dynamically to avoid circular dependencies
    const { ClientHandler } = await import('../handlers/client.handler');
    const { ProfileHandler } = await import('../handlers/profile.handler');
    
    const clientHandler = new ClientHandler(ctx.bot as TelegramBot);
    const profileHandler = new ProfileHandler(ctx.bot as TelegramBot);
    
    switch (waitingFor) {
      // New contact-based auth states
      case 'contact_auth':
        // Contact should be handled by handleContactInput, skip text
        await next();
        break;
        
      case 'contact_auth_name':
        await clientHandler.processContactAuthName(ctx, text);
        break;
        
      case 'profile_full_name':
        await clientHandler.processProfileFullName(ctx, text);
        break;
        
      case 'profile_birth_date':
        await clientHandler.processProfileBirthDate(ctx, text);
        break;
        
      // Legacy registration states (for backwards compatibility)
      case 'full_name':
        await clientHandler.processProfileFullName(ctx, text);
        break;
        
      case 'phone':
        // Redirect to contact sharing for consistency
        await requestContactAuth(ctx);
        break;
        
      case 'birth_date':
        await clientHandler.processProfileBirthDate(ctx, text);
        break;
        
      // Profile editing states
      case 'edit_name':
        await profileHandler.processNameEdit(ctx, text);
        break;
        
      case 'edit_phone':
        await profileHandler.processPhoneEdit(ctx, text);
        break;
        
      case 'edit_birthday':
        await profileHandler.processBirthdayEdit(ctx, text);
        break;
        
      default:
        await next();
    }
    
  } catch (error) {
    console.error('Text input handling error:', error);
    if (ctx.message?.chat?.id) {
      await sendErrorMessage(ctx, '❌ Произошла ошибка при обработке сообщения.');
    }
  }
}

// Handle contact sharing (updated for new auth flow)
export async function handleContactInput(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const { waitingFor } = ctx.session || {};
  
  if (!waitingFor || !ctx.message?.contact) {
    await next();
    return;
  }

  try {
    const contact = ctx.message.contact;
    
    const { ClientHandler } = await import('../handlers/client.handler');
    const { ProfileHandler } = await import('../handlers/profile.handler');
    
    const clientHandler = new ClientHandler(ctx.bot as TelegramBot);
    const profileHandler = new ProfileHandler(ctx.bot as TelegramBot);
    
    switch (waitingFor) {
      case 'contact_auth':
        await clientHandler.processContactAuth(ctx, contact);
        break;
        
      case 'phone':
      case 'edit_phone':
        // Process phone from contact
        if (waitingFor === 'phone') {
          await clientHandler.processContactAuth(ctx, contact);
        } else {
          await profileHandler.processPhoneEdit(ctx, contact.phone_number);
        }
        break;
        
      default:
        await next();
    }
    
  } catch (error) {
    console.error('Contact input handling error:', error);
    if (ctx.message?.chat?.id) {
      await sendErrorMessage(ctx, '❌ Произошла ошибка при обработке контакта.');
    }
  }
}

// Validate client access to specific resource
export async function validateClientAccess(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (!ctx.session?.client) {
    await ensureClientAuthenticated(ctx, next);
    return;
  }

  // Update last activity
  ctx.session.lastActivity = new Date();
  
  await next();
}

// Handle callback queries for client-specific actions (updated for new auth)
export async function handleClientCallbacks(ctx: BotContext, callbackData: string): Promise<boolean> {
  if (!ctx.from) {
    return false;
  }

  try {
    // Import handlers
    const { ClientHandler } = await import('../handlers/client.handler');
    const { ProfileHandler } = await import('../handlers/profile.handler');
    
    const clientHandler = new ClientHandler(ctx.bot as TelegramBot);
    const profileHandler = new ProfileHandler(ctx.bot as TelegramBot);

    // Route client-specific callbacks
    switch (callbackData) {
      case 'client_main_menu':
        await clientHandler.showMainMenu(ctx);
        return true;
        
      case 'my_card':
        await clientHandler.showLoyaltyCard(ctx);
        return true;
        
      case 'my_profile':
        await clientHandler.showProfile(ctx);
        return true;
        
      case 'coffee_shops':
        await clientHandler.showCoffeeShops(ctx);
        return true;
        
      case 'social_media':
        await clientHandler.showSocialMedia(ctx);
        return true;
        
      case 'about_program':
        await clientHandler.showAboutProgram(ctx);
        return true;
        
      // New contact-based auth callbacks
      case 'complete_profile':
        await clientHandler.startProfileCompletion(ctx);
        return true;
        
      case 'skip_profile_completion':
        await clientHandler.showMainMenu(ctx);
        return true;
        
      case 'complete_profile_final':
        await clientHandler.processProfileBirthDate(ctx, 'skip');
        return true;
        
      // Contact auth name callbacks
      case 'skip_name_input':
        await clientHandler.processContactAuthName(ctx, 'skip');
        return true;
        
      // Legacy registration callbacks (for backwards compatibility)
      case 'cancel_registration':
        await clientHandler.showMainMenu(ctx);
        return true;
        
      case 'skip_birthday':
        await clientHandler.processProfileBirthDate(ctx, 'skip');
        return true;
        
      // Profile editing callbacks
      case 'edit_name':
        await profileHandler.editName(ctx);
        return true;
        
      case 'edit_phone':
        await profileHandler.editPhone(ctx);
        return true;
        
      case 'edit_birthday':
        await profileHandler.editBirthday(ctx);
        return true;
        
      case 'remove_birthday':
        await profileHandler.removeBirthday(ctx);
        return true;
        
      default:
        return false;
    }
    
  } catch (error) {
    console.error('Client callback handling error:', error);
    if (ctx.message?.chat?.id) {
      await sendErrorMessage(ctx, '❌ Произошла ошибка при обработке команды.');
    }
    return true; // Return true to indicate we handled the callback (even if with error)
  }
}

// Clean up expired sessions
export function cleanupExpiredSessions(sessions: Map<number, any>): void {
  const expirationTime = 2 * 60 * 60 * 1000; // 2 hours
  const now = Date.now();
  
  for (const [userId, session] of sessions.entries()) {
    if (session.lastActivity) {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (now - lastActivity > expirationTime) {
        sessions.delete(userId);
      }
    }
  }
}

// Helper function to send authentication prompt
async function sendAuthenticationPrompt(ctx: BotContext): Promise<void> {
  if (!ctx.message?.chat?.id) return;

  const message = 
    '👋 Добро пожаловать в Rock Coffee!\n\n' +
    '❌ Вы не авторизованы в программе лояльности.\n\n' +
    '🎯 Авторизуйтесь и получайте:\n' +
    '• Баллы за каждую покупку\n' +
    '• Скидки и специальные предложения\n' +
    '• Бонусы в день рождения\n\n' +
    '▶️ Нажмите /start для входа через контакт';

  await (ctx.bot as TelegramBot).sendMessage(ctx.message.chat.id, message);
}

// Helper function to request contact auth
async function requestContactAuth(ctx: BotContext): Promise<void> {
  if (!ctx.message?.chat?.id) return;

  const message = 
    '📱 *Для безопасности используйте авторизацию через контакт*\n\n' +
    'Нажмите /start и поделитесь контактом для входа в систему.';

  await (ctx.bot as TelegramBot).sendMessage(ctx.message.chat.id, message, {
    parse_mode: 'Markdown'
  });

  // Clear session
  if (ctx.session) {
    delete ctx.session.waitingFor;
  }
}

// Helper function to send staff message
async function sendStaffMessage(ctx: BotContext): Promise<void> {
  if (!ctx.message?.chat?.id) return;

  const message = 
    '👨‍💼 Вы зарегистрированы как сотрудник.\n\n' +
    'Для доступа к рабочей панели используйте команду /start';

  await (ctx.bot as TelegramBot).sendMessage(ctx.message.chat.id, message);
}

// Helper function to send error message
async function sendErrorMessage(ctx: BotContext, message: string): Promise<void> {
  if (!ctx.message?.chat?.id) return;

  await (ctx.bot as TelegramBot).sendMessage(ctx.message.chat.id, message);
}