/**
 * Profile Management API
 * 
 * This module handles profile updates and syncs with the CRM backend
 */

const API_URL = import.meta.env.VITE_BACKEND_API_URL || '';

export interface ProfileData {
  email: string;
  name?: string;
  phone?: string;
  subscription?: string;
}

/**
 * Save profile to localStorage
 */
export function saveProfileLocally(profile: ProfileData): void {
  try {
    const profileData = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('customerProfile', JSON.stringify(profileData));
    console.log('💾 Profile saved locally:', profileData);
  } catch (error) {
    console.error('❌ Error saving profile locally:', error);
  }
}

/**
 * Load profile from localStorage
 */
export function loadProfileLocally(): ProfileData | null {
  try {
    const saved = localStorage.getItem('customerProfile');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('❌ Error loading profile:', error);
  }
  return null;
}

/**
 * Update profile and sync with CRM backend
 */
export async function updateProfile(profile: ProfileData): Promise<void> {
  // Save locally first
  saveProfileLocally(profile);
  
  // Sync with backend (non-blocking)
  try {
    console.log('🔄 Syncing profile with backend:', profile);
    
    const response = await fetch(`${API_URL}/api/public/customers/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profile),
    });

    if (response.ok) {
      console.log('✅ Profile synced with backend');
    } else {
      console.warn('⚠️ Profile sync failed (non-critical)');
    }
  } catch (error) {
    console.log('ℹ️ Backend sync unavailable (non-critical)');
  }
}

/**
 * Get profile display data
 */
export function getProfileDisplay(profile: ProfileData | null): {
  name: string;
  email: string;
  phone: string;
  initials: string;
} {
  if (!profile || !profile.email) {
    return {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      initials: 'JD'
    };
  }

  const name = profile.name || profile.email.split('@')[0];
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return {
    name,
    email: profile.email,
    phone: profile.phone || 'Not provided',
    initials
  };
}
