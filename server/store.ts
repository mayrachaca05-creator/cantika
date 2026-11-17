import fs from 'node:fs';
import path from 'node:path';
import {
  ActivityLog,
  ArchiveDocument,
  CustomFolder,
  FeedbackItem,
  HistoryAccessRecord,
  NotificationItem,
  UserRole,
} from '../src/types';
import { evaluateJraStatus, isTrashExpired, STORAGE_CAPACITY_BYTES } from '../src/utils/jra';

export interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  verificationCode: string | null;
  resetCode: string | null;
  resetCodeExpiresAt: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export interface EmailMessageRecord {
  id: string;
  to: string;
  subject: string;
  body: string;
  code: string;
  type: 'verify' | 'reset';
  createdAt: string;
}

export interface DatabaseState {
  users: StoredUser[];
  documents: ArchiveDocument[];
  customFolders: CustomFolder[];
  activities: ActivityLog[];
  accessHistory: HistoryAccessRecord[];
  notifications: NotificationItem[];
  feedback: FeedbackItem[];
  emailOutbox: EmailMessageRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'sipersip.db.json');

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

const EMPTY_DB: DatabaseState = {
  users: [],
  documents: [],
  customFolders: [],
  activities: [],
  accessHistory: [],
  notifications: [],
  feedback: [],
  emailOutbox: [],
};

export function readDb(): DatabaseState {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    writeDb(EMPTY_DB);
    return structuredClone(EMPTY_DB);
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseState>;
    return {
      users: parsed.users ?? [],
      documents: parsed.documents ?? [],
      customFolders: parsed.customFolders ?? [],
      activities: parsed.activities ?? [],
      accessHistory: parsed.accessHistory ?? [],
      notifications: parsed.notifications ?? [],
      feedback: parsed.feedback ?? [],
      emailOutbox: parsed.emailOutbox ?? [],
    };
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

export function writeDb(state: DatabaseState): void {
  ensureDirs();
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

export function updateDb<T>(mutator: (db: DatabaseState) => T): T {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}

export function purgeExpiredTrash(db: DatabaseState, now = new Date()): number {
  const toKeep: ArchiveDocument[] = [];
  let purgedCount = 0;

  for (const doc of db.documents) {
    if (doc.deletedAt && isTrashExpired(doc.deletedAt, now)) {
      const filePath = path.join(UPLOADS_DIR, doc.storageFileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore fs unlink failure
        }
      }
      purgedCount += 1;
      db.activities.unshift({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: 'system',
        userName: 'Sistem Retensi 30 Hari',
        userRole: 'admin',
        action: 'purge',
        description: `Dokumen "${doc.namaFile}" (${doc.klasifikasiKode}) otomatis dihapus permanen setelah 30 hari di riwayat sampah.`,
        documentId: doc.id,
        documentName: doc.namaFile,
        klasifikasiKode: doc.klasifikasiKode,
        jenisSurat: doc.jenisSurat,
        timestamp: now.toISOString(),
      });
    } else {
      toKeep.push(doc);
    }
  }

  db.documents = toKeep;
  return purgedCount;
}

export function syncJraNotifications(db: DatabaseState, now = new Date()): void {
  for (const doc of db.documents) {
    if (doc.deletedAt) continue;
    const jra = evaluateJraStatus({
      klasifikasiKode: doc.klasifikasiKode,
      tanggalSurat: doc.tanggalSurat,
      status: doc.status,
      disposalDecision: doc.disposalDecision,
      now,
    });

    if (jra.enteredActiveJra) {
      const existing = db.notifications.find(
        (n) => n.documentId === doc.id && n.category === 'jra_aktif'
      );
      if (!existing) {
        db.notifications.unshift({
          id: `notif-jra-aktif-${doc.id}`,
          title: 'Surat Aktif Memasuki Masa JRA',
          message: `"${doc.namaFile}" (${doc.klasifikasiKode}) telah memasuki masa JRA aktif. Silakan tinjau arsip.`,
          category: 'jra_aktif',
          documentId: doc.id,
          klasifikasiKode: doc.klasifikasiKode,
          jenisSurat: doc.jenisSurat,
          isRead: false,
          createdAt: now.toISOString(),
        });
      }
    }

    if (jra.needsDisposalNotification) {
      const existing = db.notifications.find(
        (n) => n.documentId === doc.id && n.category === 'jra_pemusnahan'
      );
      if (!existing) {
        db.notifications.unshift({
          id: `notif-jra-musnah-${doc.id}`,
          title: 'Masa JRA Habis — Konfirmasi Pemusnahan',
          message: `Surat inaktif "${doc.namaFile}" (${doc.klasifikasiKode}) telah habis masa JRA-nya. Lakukan konfirmasi pemusnahan.`,
          category: 'jra_pemusnahan',
          documentId: doc.id,
          klasifikasiKode: doc.klasifikasiKode,
          jenisSurat: doc.jenisSurat,
          isRead: false,
          createdAt: now.toISOString(),
        });
      }
    }
  }
}

export function computeStorageSummary(db: DatabaseState) {
  let activeBytes = 0;
  let trashBytes = 0;
  for (const doc of db.documents) {
    if (doc.deletedAt) {
      trashBytes += doc.fileSize;
    } else {
      activeBytes += doc.fileSize;
    }
  }
  const usedBytes = activeBytes + trashBytes;
  const remainingBytes = Math.max(0, STORAGE_CAPACITY_BYTES - usedBytes);
  const percentUsed = Number(((usedBytes / STORAGE_CAPACITY_BYTES) * 100).toFixed(4));
  return {
    capacityBytes: STORAGE_CAPACITY_BYTES,
    usedBytes,
    activeBytes,
    trashBytes,
    remainingBytes,
    percentUsed,
  };
}
