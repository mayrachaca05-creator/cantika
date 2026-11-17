import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Edit3,
  FileCheck2,
  Inbox,
  Menu,
  Send,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
} from 'lucide-react';
import { NotificationItem, UserPublic } from '../types';
import { NavSection } from './Sidebar';

interface TopBarProps {
  user: UserPublic;
  activeSection: NavSection;
  notifications: NotificationItem[];
  onOpenMobileMenu: () => void;
  onOpenDocumentFromNotification: (notif: NotificationItem) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenEditProfile: () => void;
  onOpenDeactivateModal: () => void;
}

const SECTION_LABELS: Record<NavSection, string> = {
  dashboard: 'Dashboard',
  arsip: 'Manajemen Arsip & Klasifikasi',
  history: 'Riwayat Aktivitas & Sampah 30 Hari',
  settings: 'Pengaturan Sistem',
};

export const TopBar: React.FC<TopBarProps> = ({
  user,
  activeSection,
  notifications,
  onOpenMobileMenu,
  onOpenDocumentFromNotification,
  onMarkAllNotificationsRead,
  onOpenEditProfile,
  onOpenDeactivateModal,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#CBD5E1] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Buka menu navigasi"
          className="lg:hidden p-2 rounded-lg border border-[#CBD5E1] text-[#1F2937] hover:bg-[#F1F5F9]"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="text-xs text-[#6B7280] font-medium truncate">
            SIPERSIP / {SECTION_LABELS[activeSection]}
          </div>
        </div>
      </div>

      {/* Right Icons: Notification & User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((o) => !o);
              setProfileOpen(false);
            }}
            aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
            className="relative w-10 h-10 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#E8F1FF] text-[#1F2937] hover:text-[#0D47A1] flex items-center justify-center transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E63946] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#CBD5E1] rounded-2xl shadow-lg overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="font-display font-bold text-sm text-[#1F2937]">
                  Notifikasi Arsip & JRA
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllNotificationsRead}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E6BD6] hover:text-[#0D47A1]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tandai dibaca</span>
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-[#F1F5F9]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#6B7280]">
                    Belum ada notifikasi surat masuk, surat keluar, atau pengingat JRA.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onOpenDocumentFromNotification(n);
                        setNotifOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-[#F8FAFC] transition-colors flex items-start gap-3 ${
                        !n.isRead ? 'bg-[#E8F1FF]/45' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          n.category === 'jra_pemusnahan'
                            ? 'bg-[#FEF9C3] text-[#A16207]'
                            : n.category === 'jra_aktif'
                              ? 'bg-[#DFF5E1] text-[#2E7D32]'
                              : 'bg-[#E8F1FF] text-[#0D47A1]'
                        }`}
                      >
                        {n.category === 'jra_pemusnahan' ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : n.category === 'jra_aktif' ? (
                          <FileCheck2 className="w-4 h-4" />
                        ) : n.jenisSurat === 'keluar' ? (
                          <Send className="w-4 h-4" />
                        ) : (
                          <Inbox className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#1F2937]">{n.title}</div>
                        <p className="text-[11px] text-[#6B7280] mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <div className="text-[10px] text-[#6B7280] mt-1 font-mono tabular-nums">
                          {formatDate(n.createdAt)} · Klik untuk buka dokumen
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Icon */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((o) => !o);
              setNotifOpen(false);
            }}
            aria-label={`Profil pengguna ${user.fullName}`}
            className="flex items-center gap-2.5 pl-2.5 pr-3 h-10 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#E8F1FF] transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-[#0D47A1] text-white flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <div className="text-xs font-semibold text-[#1F2937] truncate max-w-[130px]">
                {user.fullName}
              </div>
              <div className="text-[10px] font-medium text-[#6B7280] capitalize">
                {user.role === 'admin' ? 'Admin' : 'Viewer'}
              </div>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#CBD5E1] rounded-2xl shadow-lg overflow-hidden z-50">
              <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#0D47A1] text-white flex items-center justify-center shrink-0">
                    {user.role === 'admin' ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <UserCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-[#1F2937] truncate">
                      {user.fullName}
                    </div>
                    <div className="text-xs text-[#6B7280] truncate">{user.email}</div>
                    <div className="text-[11px] font-semibold text-[#0D47A1] mt-0.5">
                      Status Pengguna: {user.role === 'admin' ? 'Admin' : 'Viewer'}
                    </div>
                  </div>
                </div>

                {/* Registration Verification Info */}
                <div className="mt-3 pt-3 border-t border-[#E2E8F0] text-[11px] text-[#6B7280] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Hasil Registrasi:</span>
                    <span className="font-semibold text-[#43A047]">
                      {user.isVerified ? 'Email Terverifikasi' : 'Menunggu Verifikasi'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span>Tanggal Daftar:</span>
                    <span className="font-medium text-[#1F2937]">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>
                  {user.verifiedAt && (
                    <div className="flex items-center justify-between tabular-nums">
                      <span>Terverifikasi:</span>
                      <span className="font-medium text-[#1F2937]">
                        {formatDate(user.verifiedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-2 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenEditProfile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#1F2937] hover:bg-[#E8F1FF] hover:text-[#0D47A1] transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
                <div className="pt-1 mt-1 border-t border-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenDeactivateModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#E63946] hover:bg-[#FEF2F2] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Akun / Nonaktifkan Akun</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
