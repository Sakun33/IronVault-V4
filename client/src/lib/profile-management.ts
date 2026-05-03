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
    
    const response = await fetch(`${API_URL}/api/public/customers/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profile),
    });

    if (response.ok) {
    } else {
    }
  } catch (error) {
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
      name: 'User',
      email: '',
      phone: '',
      initials: 'U'
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
