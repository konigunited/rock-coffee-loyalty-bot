import { UserRole } from '../types/user.types';

export interface RolePermissions {
  canView: string[];
  canEdit: string[];
  dataAccess: 'none' | 'limited' | 'full';
}

export const PERMISSIONS: Record<UserRole, RolePermissions> = {
  client: {
    canView: ['own_profile', 'own_balance', 'coffee_info', 'own_transactions'],
    canEdit: ['own_profile'],
    dataAccess: 'none'
  },
  
  barista: {
    canView: [
      'client_card_limited',      // Only card#, name, balance, notes
      'client_balance', 
      'client_notes', 
      'point_operations',
      'own_statistics'
    ],
    canEdit: [
      'client_notes', 
      'point_operations'          // Earn/spend points only
    ],
    dataAccess: 'limited'         // NO access to phone, birth_date, full history
  },
  
  manager: {
    canView: [
      'all_clients',              // Full client data access
      'all_client_data',          // Including phone, birth_date
      'staff_management', 
      'statistics', 
      'reports',
      'all_transactions'
    ],
    canEdit: [
      'all_clients', 
      'staff_data', 
      'promotions',
      'client_full_profile'
    ],
    dataAccess: 'full'            // Complete access to all personal data
  },
  
  admin: {
    canView: ['everything'],
    canEdit: ['everything'],
    dataAccess: 'full'
  }
};

// Data fields accessible by role
export const DATA_ACCESS_FIELDS = {
  barista: [
    'id',
    'card_number',
    'full_name', 
    'balance',
    'notes',
    'last_visit',
    'visit_count',
    'is_active'
  ],
  
  manager: [
    'id',
    'telegram_id',
    'card_number',
    'full_name',
    'phone',
    'birth_date',
    'balance',
    'total_spent',
    'visit_count',
    'last_visit',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'is_birthday_soon'
  ]
};

export function hasPermission(userRole: UserRole, action: string): boolean {
  const permissions = PERMISSIONS[userRole];
  return permissions.canView.includes(action) || 
         permissions.canEdit.includes(action) ||
         permissions.canView.includes('everything');
}

export function canEditData(userRole: UserRole, action: string): boolean {
  const permissions = PERMISSIONS[userRole];
  return permissions.canEdit.includes(action) || 
         permissions.canEdit.includes('everything');
}

export function getDataAccessLevel(userRole: UserRole): 'none' | 'limited' | 'full' {
  return PERMISSIONS[userRole].dataAccess;
}