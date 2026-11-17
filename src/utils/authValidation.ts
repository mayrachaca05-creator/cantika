import { UserRole } from '../types';

export interface RolePermissions {
  canView: boolean;
  canDownload: boolean;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreateFolder: boolean;
  canManageDisposal: boolean;
}

export function getRolePermissions(role: UserRole): RolePermissions {
  if (role === 'admin') {
    return {
      canView: true,
      canDownload: true,
      canUpload: true,
      canEdit: true,
      canDelete: true,
      canCreateFolder: true,
      canManageDisposal: true,
    };
  }
  return {
    canView: true,
    canDownload: true,
    canUpload: false,
    canEdit: false,
    canDelete: false,
    canCreateFolder: false,
    canManageDisposal: false,
  };
}

export function validateRegistrationInput(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  roleAccessCode: string;
}): string | null {
  if (!input.fullName.trim() || input.fullName.trim().length < 2) {
    return 'Nama lengkap minimal 2 karakter.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email.trim())) {
    return 'Format email tidak valid.';
  }
  if (!input.password || input.password.length < 6) {
    return 'Password akun minimal 6 karakter.';
  }
  if (input.password !== input.confirmPassword) {
    return 'Konfirmasi password tidak cocok.';
  }
  if (input.role !== 'admin' && input.role !== 'viewer') {
    return 'Pilih peran Admin atau Viewer.';
  }
  if (!input.roleAccessCode.trim()) {
    return `Password khusus ${input.role === 'admin' ? 'Admin' : 'Viewer'} wajib diisi.`;
  }
  return null;
}

export function validateResetPasswordInput(input: {
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (!input.newPassword || input.newPassword.length < 6) {
    return 'Password baru minimal 6 karakter.';
  }
  if (input.newPassword !== input.confirmPassword) {
    return 'Konfirmasi password baru tidak cocok.';
  }
  return null;
}
