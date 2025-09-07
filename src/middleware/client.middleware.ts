import TelegramBot from 'node-telegram-bot-api';
import { ClientService } from '../services/client.service';
import { UserService } from '../services/user.service';
import { BotContext } from './access.middleware';

const clientService = new ClientService();
const userService = new UserService();

// Check if user is registered as a client
export async function ensureClientRegistered(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (!ctx.from) {
    return;
  }

  try {
    const client = await clientService.getByTelegramId(ctx.from.id);
    
    if (!client) {
      if (ctx.message?.chat?.id) {
        await sendRegistrationPrompt(ctx);
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
    console.error('Client check error:', error);
    if (ctx.message?.chat?.id) {
      await sendErrorMessage(ctx, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }
}

// Ensure user is NOT registered (for registration process)
export async function ensureNotRegistered(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (!ctx.from) {
    return;
  }

  try {
    // Check if user is a client
    const client = await clientService.getByTelegramId(ctx.from.id);
    if (client) {
      // User is already registered as client, show main menu
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
    console.error('Registration check error:', error);
    if (ctx.message?.chat?.id) {
      await sendErrorMessage(ctx, '❌ Произошла ошибка при проверке регистрации.');
    }
  }
}

// Handle text input based on current session state
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
      case 'full_name':
        await clientHandler.processFullName(ctx, text);
        break;
        
      case 'phone':
        await clientHandler.processPhone(ctx, text);
        break;
        
      case 'birth_date':
        await clientHandler.processBirthDate(ctx, text);
        break;
        
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

// Handle contact sharing
export async function handleContactInput(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const { waitingFor } = ctx.session || {};
  
  if (!waitingFor || !ctx.message?.contact) {
    await next();
    return;
  }

  try {
    const phoneNumber = ctx.message.contact.phone_number;
    
    const { ClientHandler } = await import('../handlers/client.handler');
    const { ProfileHandler } = await import('../handlers/profile.handler');
    
    const clientHandler = new ClientHandler(ctx.bot as TelegramBot);
    const profileHandler = new ProfileHandler(ctx.bot as TelegramBot);
    
    switch (waitingFor) {
      case 'phone':
        await clientHandler.processPhone(ctx, phoneNumber);
        break;
        
      case 'edit_phone':
        await profileHandler.processPhoneEdit(ctx, phoneNumber);
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
    await ensureClientRegistered(ctx, next);
    return;
  }

  // Update last activity
  ctx.session.lastActivity = new Date();
  
  await next();
}

// Handle callback queries for client-specific actions
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
        
      // Registration callbacks
      case 'cancel_registration':
        await clientHandler.cancelRegistration(ctx);
        return true;
        
      case 'skip_birthday':
        await clientHandler.processBirthDate(ctx, 'skip');
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

// Helper function to send registration prompt
async function sendRegistrationPrompt(ctx: BotContext): Promise<void> {
  if (!ctx.message?.chat?.id) return;

  const message = 
    '👋 Добро пожаловать в Rock Coffee!\n\n' +
    '❌ Вы не зарегистрированы в программе лояльности.\n\n' +
    '🎯 Зарегистрируйтесь и получайте:\n' +
    '• Баллы за каждую покупку\n' +
    '• Скидки и специальные предложения\n' +
    '• Бонусы в день рождения\n\n' +
    '▶️ Нажмите /start для регистрации';

  await (ctx.bot as TelegramBot).sendMessage(ctx.message.chat.id, message);
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