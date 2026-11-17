import React, { useCallback, useEffect, useState } from 'react';
import {
  ArchiveDocument,
  CustomFolder,
  DashboardPayload,
  DeletedHistoryItem,
  FeedbackItem,
  HistoryAccessRecord,
  MailType,
  NotificationItem,
  StorageSummary,
  UserPublic,
} from './types';
import { apiRequest, setStoredToken } from './utils/api';
import { AuthView } from './components/AuthView';
import { Sidebar, NavSection } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { ArchivesView } from './components/ArchivesView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { DeactivateAccountModal, EditProfileModal } from './components/ProfileModals';

interface SettingsPayload {
  websiteIdentity: {
    name: string;
    fullName: string;
    tagline: string;
    managedBy: string;
    isReadOnly: boolean;
    classificationStandard: string;
  };
  security: {
    emailVerified: boolean;
    roleLabel: string;
    trashRetentionDays: number;
    sessionProtection: string;
  };
  storage: StorageSummary;
  feedback: FeedbackItem[];
}

export default function App() {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [archiveMailFilter, setArchiveMailFilter] = useState<MailType | 'all'>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ArchiveDocument | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [historyData, setHistoryData] = useState<{
    deleted: DeletedHistoryItem[];
    opened: HistoryAccessRecord[];
    downloaded: HistoryAccessRecord[];
  }>({ deleted: [], opened: [], downloaded: [] });
  const [settingsData, setSettingsData] = useState<SettingsPayload | null>(null);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const loadWorkspaceData = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const [dash, arch, flds, notifs, hist, sett] = await Promise.all([
        apiRequest<DashboardPayload>('/api/dashboard'),
        apiRequest<{ documents: ArchiveDocument[] }>('/api/archives'),
        apiRequest<{ folders: CustomFolder[] }>('/api/folders'),
        apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),
        apiRequest<{
          deleted: DeletedHistoryItem[];
          opened: HistoryAccessRecord[];
          downloaded: HistoryAccessRecord[];
        }>('/api/history'),
        apiRequest<SettingsPayload>('/api/settings'),
      ]);
      setDashboardData(dash);
      setDocuments(arch.documents);
      setCustomFolders(flds.folders);
      setNotifications(notifs.notifications);
      setHistoryData(hist);
      setSettingsData(sett);

      setSelectedDocument((prev) =>
        prev ? arch.documents.find((d) => d.id === prev.id) ?? null : null
      );
    } catch {
      // ignore if session expired
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    apiRequest<{ user: UserPublic }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setCheckingSession(false);
      });
  }, []);

  useEffect(() => {
    if (user) {
      loadWorkspaceData();
    }
  }, [user, loadWorkspaceData]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setSelectedDocument(null);
    setActiveSection('dashboard');
  };

  const handleOpenDocumentFromNotification = async (notif: NotificationItem) => {
    try {
      await apiRequest(`/api/notifications/${notif.id}/read`, { method: 'PATCH' });
    } catch {
      // ignore
    }
    if (notif.documentId) {
      const target = documents.find((d) => d.id === notif.documentId) ?? null;
      if (target) {
        setSelectedDocument(target);
        setArchiveMailFilter(target.jenisSurat);
        setActiveSection('arsip');
        try {
          await apiRequest(`/api/archives/${target.id}/log-open`, { method: 'POST' });
        } catch {
          // ignore
        }
      } else {
        setActiveSection('arsip');
      }
    }
    loadWorkspaceData();
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      loadWorkspaceData();
    } catch {
      // ignore
    }
  };

  const handleOpenDocumentById = (docId: string) => {
    const target = documents.find((d) => d.id === docId) ?? null;
    if (target) {
      setSelectedDocument(target);
      setArchiveMailFilter(target.jenisSurat);
      setActiveSection('arsip');
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm font-semibold text-[#0D47A1]">Memuat SIPERSIP...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthView onAuthenticated={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <Sidebar
        activeSection={activeSection}
        activeMailFilter={archiveMailFilter}
        onSelectSection={(section, mailFilter) => {
          setActiveSection(section);
          if (mailFilter) {
            setArchiveMailFilter(mailFilter);
          }
        }}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          user={user}
          activeSection={activeSection}
          notifications={notifications}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenDocumentFromNotification={handleOpenDocumentFromNotification}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onOpenEditProfile={() => setEditProfileOpen(true)}
          onOpenDeactivateModal={() => setDeactivateOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              user={user}
              data={dashboardData}
              loading={dashboardLoading}
              onNavigateArchives={(mailFilter = 'all') => {
                setArchiveMailFilter(mailFilter);
                setActiveSection('arsip');
              }}
            />
          )}

          {activeSection === 'arsip' && (
            <ArchivesView
              userRole={user.role}
              documents={documents}
              customFolders={customFolders}
              sidebarMailFilter={archiveMailFilter}
              selectedDocument={selectedDocument}
              onSelectDocument={setSelectedDocument}
              onRefresh={loadWorkspaceData}
            />
          )}

          {activeSection === 'history' && (
            <HistoryView
              userRole={user.role}
              deleted={historyData.deleted}
              opened={historyData.opened}
              downloaded={historyData.downloaded}
              onRefresh={loadWorkspaceData}
              onOpenDocumentById={handleOpenDocumentById}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              settings={settingsData}
              onRefresh={loadWorkspaceData}
              onOpenEditProfile={() => setEditProfileOpen(true)}
            />
          )}
        </main>
      </div>

      {editProfileOpen && (
        <EditProfileModal
          open={editProfileOpen}
          user={user}
          onClose={() => setEditProfileOpen(false)}
          onUpdated={(updatedUser) => {
            setUser(updatedUser);
            loadWorkspaceData();
          }}
        />
      )}

      {deactivateOpen && (
        <DeactivateAccountModal
          open={deactivateOpen}
          onClose={() => setDeactivateOpen(false)}
          onDeactivated={() => {
            setDeactivateOpen(false);
            setStoredToken(null);
            setUser(null);
          }}
        />
      )}
    </div>
  );
}
