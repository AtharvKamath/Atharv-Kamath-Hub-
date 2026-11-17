/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AdminPermissionsMap,
  AdminRole,
  AdminUser,
  PermissionAction,
  PermissionSection,
  SectionPermissions,
} from '../types';

export const PERMISSION_SECTIONS: {
  key: PermissionSection;
  label: string;
  description: string;
}[] = [
  { key: 'home', label: 'Home Content', description: 'Hero banners, titles, brand logo' },
  { key: 'about', label: 'About', description: 'Bio, mission statement, stats counters' },
  { key: 'links', label: 'Links & Videos', description: 'Content Hub links and YouTube videos' },
  { key: 'gallery', label: 'Gallery', description: 'Photo stream uploads and captions' },
  { key: 'projects', label: 'Projects', description: 'Portfolio project cards' },
  { key: 'library', label: 'Library', description: 'Downloadable assets & Favorites/Gear' },
  { key: 'gamingZone', label: 'Gaming Zone', description: 'Arcade links, game file uploads & publishing' },
  { key: 'blogs', label: 'Blogs', description: 'Editorial articles & markdown posts' },
  { key: 'journey', label: 'Journey', description: 'Creative timeline milestones' },
  { key: 'contact', label: 'Contact Info', description: 'Location & business email display' },
  { key: 'directInquiry', label: 'Direct Inquiry', description: 'Private visitor messages inbox' },
];

export const PERMISSION_ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'publish', label: 'Publish' },
];

export function createEmptySectionPerm(): SectionPermissions {
  return { view: false, create: false, edit: false, delete: false, publish: false };
}

export function createFullSectionPerm(): SectionPermissions {
  return { view: true, create: true, edit: true, delete: true, publish: true };
}

export function createEmptyPermissions(): AdminPermissionsMap {
  return {
    home: createEmptySectionPerm(),
    about: createEmptySectionPerm(),
    links: createEmptySectionPerm(),
    gallery: createEmptySectionPerm(),
    projects: createEmptySectionPerm(),
    videos: createEmptySectionPerm(),
    library: createEmptySectionPerm(),
    gamingZone: createEmptySectionPerm(),
    blogs: createEmptySectionPerm(),
    journey: createEmptySectionPerm(),
    contact: createEmptySectionPerm(),
    directInquiry: createEmptySectionPerm(),
  };
}

export function createFullPermissions(): AdminPermissionsMap {
  return {
    home: createFullSectionPerm(),
    about: createFullSectionPerm(),
    links: createFullSectionPerm(),
    gallery: createFullSectionPerm(),
    projects: createFullSectionPerm(),
    videos: createFullSectionPerm(),
    library: createFullSectionPerm(),
    gamingZone: createFullSectionPerm(),
    blogs: createFullSectionPerm(),
    journey: createFullSectionPerm(),
    contact: createFullSectionPerm(),
    directInquiry: createFullSectionPerm(),
  };
}

export function hasAdminPermission(
  adminUser: AdminUser | null,
  isOwner: boolean,
  section: PermissionSection,
  action: PermissionAction
): boolean {
  if (isOwner) return true;
  if (!adminUser || adminUser.status !== 'active') return false;
  if (adminUser.role === 'owner' || adminUser.role === 'full_admin') return true;
  return Boolean(adminUser.permissions?.[section]?.[action]);
}

export function hasAnyContentPermission(adminUser: AdminUser | null, isOwner: boolean): boolean {
  if (isOwner) return true;
  if (!adminUser || adminUser.status !== 'active') return false;
  if (adminUser.role === 'full_admin') return true;
  const contentSections: PermissionSection[] = [
    'home',
    'about',
    'links',
    'gallery',
    'projects',
    'videos',
    'library',
    'blogs',
    'journey',
    'contact',
  ];
  return contentSections.some((sec) =>
    Object.values(adminUser.permissions?.[sec] || {}).some(Boolean)
  );
}

export function formatRoleLabel(role: AdminRole): string {
  switch (role) {
    case 'owner':
      return 'Owner / Super Admin';
    case 'full_admin':
      return 'Full Administrator';
    case 'limited_admin':
      return 'Limited Administrator';
    default:
      return role;
  }
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('At least one special character');
  return { valid: errors.length === 0, errors };
}
