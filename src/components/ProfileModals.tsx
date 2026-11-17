import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { UserPublic } from '../types';
import { apiRequest } from '../utils/api';

interface EditProfileModalProps {
  open: boolean;
  user: UserPublic;
  onClose: () => void;
  onUpdated: (user: UserPublic) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  open,
  user,
  onClose,
  onUpdated,
}) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ user: UserPublic }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
          confirmNewPassword: confirmNewPassword || undefined,
        }),
      });
      onUpdated(res.user);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white border border-[#CBD5E1] rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 id="edit-profile-title" className="font-display text-base font-bold text-[#1F2937]">
            Edit Profile Pengguna
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup edit profile"
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F1F5F9]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="profile-fullname" className="block text-xs font-semibold text-[#1F2937] mb-1">
              Nama Lengkap
            </label>
            <input
              id="profile-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30"
            />
          </div>

          <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
            <div className="text-xs font-semibold text-[#6B7280]">
              Ubah Password Akun (Opsional)
            </div>
            <div>
              <label htmlFor="profile-curr-pw" className="block text-xs font-semibold text-[#1F2937] mb-1">
                Password Saat Ini
              </label>
              <input
                id="profile-curr-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30"
              />
            </div>
            <div>
              <label htmlFor="profile-new-pw" className="block text-xs font-semibold text-[#1F2937] mb-1">
                Password Baru
              </label>
              <input
                id="profile-new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30"
              />
            </div>
            <div>
              <label htmlFor="profile-confirm-pw" className="block text-xs font-semibold text-[#1F2937] mb-1">
                Konfirmasi Password Baru
              </label>
              <input
                id="profile-confirm-pw"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-xs font-semibold text-[#1F2937]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] text-white text-xs font-semibold"
            >
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeactivateModalProps {
  open: boolean;
  onClose: () => void;
  onDeactivated: () => void;
}

export const DeactivateAccountModal: React.FC<DeactivateModalProps> = ({
  open,
  onClose,
  onDeactivated,
}) => {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleAction = async (mode: 'deactivate' | 'delete') => {
    setLoading(true);
    try {
      await apiRequest('/api/auth/deactivate', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      onDeactivated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-title"
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white border border-[#CBD5E1] rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#E63946] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 id="deactivate-title" className="font-display text-base font-bold text-[#1F2937]">
              Nonaktifkan atau Hapus Akun
            </h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              Pilih untuk menonaktifkan akun sementara atau menghapus akun Anda secara permanen dari SIPERSIP.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAction('deactivate')}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-xs font-semibold text-[#1F2937]"
          >
            Nonaktifkan Akun
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAction('delete')}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#E63946] hover:bg-[#C62828] text-white text-xs font-semibold"
          >
            Hapus Akun Permanen
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-xs font-semibold text-[#6B7280] hover:text-[#1F2937]"
        >
          Batalkan
        </button>
      </div>
    </div>
  );
};
