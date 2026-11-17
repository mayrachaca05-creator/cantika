import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FolderArchive,
  Inbox,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
  X,
} from 'lucide-react';
import { MailType } from '../types';
import { SipersipLogo } from './SipersipLogo';

export type NavSection = 'dashboard' | 'arsip' | 'history' | 'settings';

interface SidebarProps {
  activeSection: NavSection;
  activeMailFilter: MailType | 'all';
  onSelectSection: (section: NavSection, mailFilter?: MailType | 'all') => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  activeMailFilter,
  onSelectSection,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const [arsipExpanded, setArsipExpanded] = useState(true);

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#CBD5E1] w-[264px]">
      <div className="px-5 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
        <SipersipLogo />
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu navigasi"
          className="lg:hidden p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F1F5F9]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Navigasi utama" className="flex-1 px-3.5 py-5 space-y-1.5 overflow-y-auto">
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => {
            onSelectSection('dashboard');
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
            activeSection === 'dashboard'
              ? 'bg-[#0D47A1] text-white'
              : 'text-[#1F2937] hover:bg-[#E8F1FF] hover:text-[#0D47A1]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </button>

        {/* 2. Arsip (with Surat Masuk & Surat Keluar sub-options) */}
        <div className="space-y-1">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                setArsipExpanded(true);
                onSelectSection('arsip', 'all');
                onCloseMobile();
              }}
              className={`flex-1 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'arsip' && activeMailFilter === 'all'
                  ? 'bg-[#0D47A1] text-white'
                  : activeSection === 'arsip'
                    ? 'bg-[#E8F1FF] text-[#0D47A1]'
                    : 'text-[#1F2937] hover:bg-[#E8F1FF] hover:text-[#0D47A1]'
              }`}
            >
              <span className="flex items-center gap-3">
                <FolderArchive className="w-4 h-4 shrink-0" />
                <span>Arsip</span>
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setArsipExpanded((prev) => !prev);
                }}
                aria-hidden="true"
                className="p-0.5 rounded hover:bg-black/10"
              >
                {arsipExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            </button>
          </div>

          {arsipExpanded && (
            <div className="pl-5 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onSelectSection('arsip', 'masuk');
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeSection === 'arsip' && activeMailFilter === 'masuk'
                    ? 'bg-[#2E6BD6] text-white'
                    : 'text-[#6B7280] hover:bg-[#F1F5F9] hover:text-[#0D47A1]'
                }`}
              >
                <Inbox className="w-3.5 h-3.5 shrink-0" />
                <span>Surat Masuk</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectSection('arsip', 'keluar');
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeSection === 'arsip' && activeMailFilter === 'keluar'
                    ? 'bg-[#2E6BD6] text-white'
                    : 'text-[#6B7280] hover:bg-[#F1F5F9] hover:text-[#0D47A1]'
                }`}
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>Surat Keluar</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. History */}
        <button
          type="button"
          onClick={() => {
            onSelectSection('history');
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
            activeSection === 'history'
              ? 'bg-[#0D47A1] text-white'
              : 'text-[#1F2937] hover:bg-[#E8F1FF] hover:text-[#0D47A1]'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>History</span>
        </button>

        {/* 4. Pengaturan Sistem */}
        <button
          type="button"
          onClick={() => {
            onSelectSection('settings');
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
            activeSection === 'settings'
              ? 'bg-[#0D47A1] text-white'
              : 'text-[#1F2937] hover:bg-[#E8F1FF] hover:text-[#0D47A1]'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Pengaturan Sistem</span>
        </button>
      </nav>

      {/* 5. Logout Akun */}
      <div className="p-3.5 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-[#E63946] hover:bg-[#FEF2F2] transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout Akun</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block sticky top-0 h-screen shrink-0 z-20">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
};
