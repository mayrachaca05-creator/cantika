export type UserRole = 'admin' | 'viewer';

export type MailType = 'masuk' | 'keluar';

export type ArchiveStatus = 'aktif' | 'inaktif';

export type JraHighlight = 'green' | 'yellow' | 'neutral';

export type DisposalDecision = 'pending' | 'dipertahankan' | 'dimusnahkan';

export interface UserPublic {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  verifiedAt: string | null;
}

export interface ClassificationItem {
  code: string;
  name: string;
  level1Code: string;
  level1Name: string;
  level2Code: string;
  level2Name: string;
  aktifLabel: string;
  inaktifLabel: string;
  pemusnahanLabel: string;
}

export interface CustomFolder {
  id: string;
  name: string;
  classificationCode: string;
  mailType: MailType;
  parentFolderId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface JraEvaluation {
  status: ArchiveStatus;
  highlight: JraHighlight;
  badgeLabel: string;
  reason: string;
  aktifYears: number | null;
  inaktifYears: number | null;
  activeEndDate: string | null;
  inactiveEndDate: string | null;
  needsDisposalNotification: boolean;
  enteredActiveJra: boolean;
}

export interface ArchiveDocument {
  id: string;
  namaFile: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  storageFileName: string;
  perihal: string;
  tanggalSurat: string;
  jenisSurat: MailType;
  klasifikasiKode: string;
  folderId: string | null;
  perusahaanPengirim: string;
  kepadaTujuan: string;
  status: ArchiveStatus;
  disposalDecision: DisposalDecision;
  uploadedById: string;
  uploadedByName: string;
  uploadedByRole: UserRole;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedByName: string | null;
  jra?: JraEvaluation;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'register' | 'login' | 'upload' | 'view' | 'download' | 'edit' | 'delete' | 'restore' | 'purge' | 'folder' | 'status' | 'disposal';
  description: string;
  documentId: string | null;
  documentName: string | null;
  klasifikasiKode: string | null;
  jenisSurat: MailType | null;
  timestamp: string;
}

export interface HistoryAccessRecord {
  id: string;
  documentId: string;
  documentName: string;
  klasifikasiKode: string;
  jenisSurat: MailType;
  fileSize: number;
  userId: string;
  userName: string;
  userRole: UserRole;
  type: 'open' | 'download';
  timestamp: string;
}

export interface DeletedHistoryItem {
  id: string;
  documentId: string;
  namaFile: string;
  perihal: string;
  klasifikasiKode: string;
  jenisSurat: MailType;
  fileSize: number;
  deletedByName: string;
  deletedByRole: UserRole;
  deletedAt: string;
  expiresAt: string;
  remainingDays: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'surat_masuk' | 'surat_keluar' | 'jra_aktif' | 'jra_pemusnahan';
  documentId: string | null;
  klasifikasiKode: string | null;
  jenisSurat: MailType | null;
  isRead: boolean;
  createdAt: string;
}

export interface StorageSummary {
  capacityBytes: number;
  usedBytes: number;
  activeBytes: number;
  trashBytes: number;
  remainingBytes: number;
  percentUsed: number;
}

export interface MonthlyChartPoint {
  label: string;
  monthKey: string;
  count: number;
}

export interface DashboardPayload {
  totalDokumen: number;
  totalKategori: number;
  totalKategoriTerpakai: number;
  totalSuratMasuk: number;
  totalSuratKeluar: number;
  totalPerluPemusnahan: number;
  chartMasuk: MonthlyChartPoint[];
  chartKeluar: MonthlyChartPoint[];
  activities: ActivityLog[];
  storage: StorageSummary;
}

export interface FeedbackItem {
  id: string;
  userName: string;
  userRole: UserRole;
  subject: string;
  message: string;
  createdAt: string;
}
