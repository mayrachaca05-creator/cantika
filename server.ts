import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { KLASIFIKASI_ITEMS, getClassificationByCode } from './src/data/klasifikasiArsip';
import { ArchiveDocument, ArchiveStatus, DisposalDecision, MailType, UserRole } from './src/types';
import { validateRegistrationInput, validateResetPasswordInput } from './src/utils/authValidation';
import {
  calculateTrashExpirationIso,
  calculateTrashRemainingDays,
  evaluateJraStatus,
} from './src/utils/jra';
import {
  AuthenticatedRequest,
  extractToken,
  requireAdmin,
  requireAuth,
  SESSION_COOKIE_NAME,
  signSessionToken,
  toPublicUser,
  verifyRoleAccessCode,
  verifySessionToken,
} from './server/auth';
import {
  computeStorageSummary,
  purgeExpiredTrash,
  readDb,
  syncJraNotifications,
  updateDb,
  UPLOADS_DIR,
} from './server/store';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB per single request upload
  },
});

function generate6DigitCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

function setSessionCookie(res: express.Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Initialize DB & purge any expired 30-day trash on startup
  updateDb((db) => {
    purgeExpiredTrash(db);
    syncJraNotifications(db);
  });

  // ==================== AUTH ROUTES ====================

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { fullName, email, password, confirmPassword, role, roleAccessCode } = req.body as {
        fullName: string;
        email: string;
        password: string;
        confirmPassword: string;
        role: UserRole;
        roleAccessCode: string;
      };

      const validationError = validateRegistrationInput({
        fullName: fullName ?? '',
        email: email ?? '',
        password: password ?? '',
        confirmPassword: confirmPassword ?? '',
        role,
        roleAccessCode: roleAccessCode ?? '',
      });
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      if (!verifyRoleAccessCode(role, roleAccessCode)) {
        res.status(403).json({
          error: `Password khusus ${role === 'admin' ? 'Admin' : 'Viewer'} tidak valid.`,
        });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const db = readDb();
      const existing = db.users.find((u) => u.email === normalizedEmail && u.isActive);
      if (existing && existing.isVerified) {
        res.status(409).json({ error: 'Email sudah terdaftar dan terverifikasi. Silakan masuk.' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const verificationCode = generate6DigitCode();
      const nowIso = new Date().toISOString();

      const emailMessage = updateDb((state) => {
        // Remove unverified stale account with same email if exists
        state.users = state.users.filter((u) => u.email !== normalizedEmail || u.isVerified);

        const userId = `usr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        state.users.push({
          id: userId,
          fullName: fullName.trim(),
          email: normalizedEmail,
          passwordHash,
          role,
          isVerified: false,
          isActive: true,
          verificationCode,
          resetCode: null,
          resetCodeExpiresAt: null,
          createdAt: nowIso,
          verifiedAt: null,
        });

        const msg = {
          id: `mail-${Date.now()}`,
          to: normalizedEmail,
          subject: 'Konfirmasi Pendaftaran Akun SIPERSIP',
          body: `Halo ${fullName.trim()}, terima kasih telah mendaftar sebagai ${role === 'admin' ? 'Admin' : 'Viewer'} di SIPERSIP. Gunakan kode konfirmasi berikut untuk mengaktifkan akun dan masuk ke sistem: ${verificationCode}`,
          code: verificationCode,
          type: 'verify' as const,
          createdAt: nowIso,
        };
        state.emailOutbox.unshift(msg);
        return msg;
      });

      res.status(201).json({
        requiresVerification: true,
        email: normalizedEmail,
        previewEmail: emailMessage,
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mendaftarkan akun.' });
    }
  });

  app.post('/api/auth/verify-email', (req, res) => {
    const { email, code } = req.body as { email?: string; code?: string };
    if (!email || !code) {
      res.status(400).json({ error: 'Email dan kode konfirmasi wajib diisi.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();

    const result = updateDb((db) => {
      const user = db.users.find((u) => u.email === normalizedEmail && u.isActive);
      if (!user) {
        return { error: 'Akun tidak ditemukan.', status: 404 as const };
      }
      if (user.isVerified) {
        const token = signSessionToken(user);
        return { user: toPublicUser(user), token, status: 200 as const };
      }
      if (user.verificationCode !== code.trim()) {
        return { error: 'Kode konfirmasi email tidak sesuai.', status: 400 as const };
      }

      const nowIso = new Date().toISOString();
      user.isVerified = true;
      user.verifiedAt = nowIso;
      user.verificationCode = null;

      db.activities.unshift({
        id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: 'register',
        description: `${user.fullName} (${user.role === 'admin' ? 'Admin' : 'Viewer'}) menyelesaikan konfirmasi email dan bergabung ke SIPERSIP.`,
        documentId: null,
        documentName: null,
        klasifikasiKode: null,
        jenisSurat: null,
        timestamp: nowIso,
      });

      const token = signSessionToken(user);
      return { user: toPublicUser(user), token, status: 200 as const };
    });

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    setSessionCookie(res, result.token);
    res.json({ user: result.user, token: result.token });
  });

  app.post('/api/auth/resend-verification', (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: 'Email wajib diisi.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const out = updateDb((db) => {
      const user = db.users.find((u) => u.email === normalizedEmail && u.isActive);
      if (!user) return { error: 'Akun tidak ditemukan.', status: 404 as const };
      if (user.isVerified) return { error: 'Akun sudah terverifikasi.', status: 400 as const };
      const newCode = generate6DigitCode();
      user.verificationCode = newCode;
      const msg = {
        id: `mail-${Date.now()}`,
        to: normalizedEmail,
        subject: 'Kirim Ulang Konfirmasi Email SIPERSIP',
        body: `Halo ${user.fullName}, berikut adalah kode konfirmasi email baru Anda untuk masuk ke SIPERSIP: ${newCode}`,
        code: newCode,
        type: 'verify' as const,
        createdAt: new Date().toISOString(),
      };
      db.emailOutbox.unshift(msg);
      return { previewEmail: msg, status: 200 as const };
    });

    if ('error' in out) {
      res.status(out.status).json({ error: out.error });
      return;
    }
    res.json({ previewEmail: out.previewEmail });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, role, roleAccessCode } = req.body as {
        email?: string;
        password?: string;
        role?: UserRole;
        roleAccessCode?: string;
      };

      if (!email || !password || !role || !roleAccessCode) {
        res.status(400).json({
          error: 'Email, password akun, opsi peran, dan password khusus peran wajib diisi.',
        });
        return;
      }

      if (!verifyRoleAccessCode(role, roleAccessCode)) {
        res.status(403).json({
          error: `Password khusus ${role === 'admin' ? 'Admin' : 'Viewer'} salah.`,
        });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const db = readDb();
      const user = db.users.find((u) => u.email === normalizedEmail);
      if (!user || !user.isActive) {
        res.status(401).json({ error: 'Akun tidak ditemukan atau telah dinonaktifkan.' });
        return;
      }

      if (user.role !== role) {
        res.status(403).json({
          error: `Akun ini terdaftar sebagai ${user.role === 'admin' ? 'Admin' : 'Viewer'}, bukan ${role === 'admin' ? 'Admin' : 'Viewer'}.`,
        });
        return;
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        res.status(401).json({ error: 'Password akun tidak sesuai.' });
        return;
      }

      if (!user.isVerified) {
        const latestMail = db.emailOutbox.find(
          (m) => m.to === normalizedEmail && m.type === 'verify'
        );
        res.status(403).json({
          error: 'Email belum dikonfirmasi. Silakan cek pesan konfirmasi email terlebih dahulu.',
          requiresVerification: true,
          email: normalizedEmail,
          previewEmail: latestMail ?? null,
        });
        return;
      }

      const token = signSessionToken(user);
      updateDb((state) => {
        state.activities.unshift({
          id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          userId: user.id,
          userName: user.fullName,
          userRole: user.role,
          action: 'login',
          description: `${user.fullName} masuk ke SIPERSIP sebagai ${user.role === 'admin' ? 'Admin' : 'Viewer'}.`,
          documentId: null,
          documentName: null,
          klasifikasiKode: null,
          jenisSurat: null,
          timestamp: new Date().toISOString(),
        });
      });

      setSessionCookie(res, token);
      res.json({ user: toPublicUser(user), token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Gagal memproses login.' });
    }
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: 'Masukkan email yang terdaftar.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const result = updateDb((db) => {
      const user = db.users.find((u) => u.email === normalizedEmail && u.isActive);
      if (!user) {
        return { error: 'Email tidak ditemukan atau akun tidak aktif.', status: 404 as const };
      }
      const resetCode = generate6DigitCode();
      user.resetCode = resetCode;
      user.resetCodeExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const msg = {
        id: `mail-${Date.now()}`,
        to: normalizedEmail,
        subject: 'Reset Password Akun SIPERSIP',
        body: `Halo ${user.fullName}, kami menerima permintaan reset password. Gunakan kode verifikasi berikut untuk membuat ulang password Anda: ${resetCode}`,
        code: resetCode,
        type: 'reset' as const,
        createdAt: new Date().toISOString(),
      };
      db.emailOutbox.unshift(msg);
      return { previewEmail: msg, status: 200 as const };
    });

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ previewEmail: result.previewEmail });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { email, code, newPassword, confirmPassword } = req.body as {
      email?: string;
      code?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!email || !code) {
      res.status(400).json({ error: 'Email dan kode reset wajib diisi.' });
      return;
    }
    const pwErr = validateResetPasswordInput({
      newPassword: newPassword ?? '',
      confirmPassword: confirmPassword ?? '',
    });
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const newHash = await bcrypt.hash(newPassword!, 10);

    const out = updateDb((db) => {
      const user = db.users.find((u) => u.email === normalizedEmail && u.isActive);
      if (!user) return { error: 'Akun tidak ditemukan.', status: 404 as const };
      if (!user.resetCode || user.resetCode !== code.trim()) {
        return { error: 'Kode verifikasi reset password tidak valid.', status: 400 as const };
      }
      if (user.resetCodeExpiresAt && Date.now() > new Date(user.resetCodeExpiresAt).getTime()) {
        return { error: 'Kode reset password sudah kedaluwarsa.', status: 400 as const };
      }

      user.passwordHash = newHash;
      user.resetCode = null;
      user.resetCodeExpiresAt = null;
      if (!user.isVerified) {
        user.isVerified = true;
        user.verifiedAt = new Date().toISOString();
      }
      return { success: true, status: 200 as const };
    });

    if ('error' in out) {
      res.status(out.status).json({ error: out.error });
      return;
    }
    res.json({ message: 'Password berhasil diperbarui. Silakan masuk dengan password baru.' });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const token = extractToken(req);
    if (!token) {
      res.json({ user: null });
      return;
    }
    const payload = verifySessionToken(token);
    if (!payload) {
      res.json({ user: null });
      return;
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === payload.userId && u.isActive && u.isVerified);
    res.json({ user: user ? toPublicUser(user) : null });
  });

  app.patch('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { fullName, currentPassword, newPassword, confirmNewPassword } = req.body as {
      fullName?: string;
      currentPassword?: string;
      newPassword?: string;
      confirmNewPassword?: string;
    };

    if (!fullName || fullName.trim().length < 2) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }

    let updatedHash: string | null = null;
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Masukkan password saat ini untuk mengganti password.' });
        return;
      }
      const match = await bcrypt.compare(currentPassword, req.currentUser!.passwordHash);
      if (!match) {
        res.status(400).json({ error: 'Password saat ini tidak sesuai.' });
        return;
      }
      const pwErr = validateResetPasswordInput({
        newPassword,
        confirmPassword: confirmNewPassword ?? '',
      });
      if (pwErr) {
        res.status(400).json({ error: pwErr });
        return;
      }
      updatedHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = updateDb((db) => {
      const user = db.users.find((u) => u.id === req.currentUser!.id);
      if (!user) return null;
      user.fullName = fullName.trim();
      if (updatedHash) {
        user.passwordHash = updatedHash;
      }
      return toPublicUser(user);
    });

    res.json({ user: updated });
  });

  app.post('/api/auth/deactivate', requireAuth, (req: AuthenticatedRequest, res) => {
    const { mode } = req.body as { mode?: 'deactivate' | 'delete' };
    updateDb((db) => {
      if (mode === 'delete') {
        db.users = db.users.filter((u) => u.id !== req.currentUser!.id);
      } else {
        const user = db.users.find((u) => u.id === req.currentUser!.id);
        if (user) user.isActive = false;
      }
    });
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true });
  });

  // ==================== DASHBOARD ROUTE ====================

  app.get('/api/dashboard', requireAuth, (_req, res) => {
    const payload = updateDb((db) => {
      purgeExpiredTrash(db);
      syncJraNotifications(db);

      const activeDocs = db.documents.filter((d) => !d.deletedAt);
      const usedCategories = new Set(activeDocs.map((d) => d.klasifikasiKode));

      let totalSuratMasuk = 0;
      let totalSuratKeluar = 0;
      let totalPerluPemusnahan = 0;

      const masukByMonth = new Map<string, number>();
      const keluarByMonth = new Map<string, number>();

      for (const doc of activeDocs) {
        const jra = evaluateJraStatus({
          klasifikasiKode: doc.klasifikasiKode,
          tanggalSurat: doc.tanggalSurat,
          status: doc.status,
          disposalDecision: doc.disposalDecision,
        });
        if (jra.needsDisposalNotification) {
          totalPerluPemusnahan += 1;
        }
        const monthKey = doc.tanggalSurat.slice(0, 7) || doc.createdAt.slice(0, 7);
        if (doc.jenisSurat === 'masuk') {
          totalSuratMasuk += 1;
          masukByMonth.set(monthKey, (masukByMonth.get(monthKey) ?? 0) + 1);
        } else {
          totalSuratKeluar += 1;
          keluarByMonth.set(monthKey, (keluarByMonth.get(monthKey) ?? 0) + 1);
        }
      }

      const toSeries = (map: Map<string, number>) => {
        const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        return entries.map(([monthKey, count]) => {
          const [y, m] = monthKey.split('-');
          const monthNames = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'Mei',
            'Jun',
            'Jul',
            'Agu',
            'Sep',
            'Okt',
            'Nov',
            'Des',
          ];
          const monthIdx = Number.parseInt(m ?? '1', 10) - 1;
          const label = `${monthNames[monthIdx] ?? m} ${y}`;
          return { monthKey, label, count };
        });
      };

      return {
        totalDokumen: activeDocs.length,
        totalKategori: KLASIFIKASI_ITEMS.length,
        totalKategoriTerpakai: usedCategories.size,
        totalSuratMasuk,
        totalSuratKeluar,
        totalPerluPemusnahan,
        chartMasuk: toSeries(masukByMonth),
        chartKeluar: toSeries(keluarByMonth),
        activities: db.activities.slice(0, 50),
        storage: computeStorageSummary(db),
      };
    });

    res.json(payload);
  });

  // ==================== FOLDERS & ARCHIVES ROUTES ====================

  app.get('/api/folders', requireAuth, (req, res) => {
    const { classificationCode, mailType } = req.query as {
      classificationCode?: string;
      mailType?: MailType;
    };
    const db = readDb();
    let folders = db.customFolders;
    if (classificationCode) {
      folders = folders.filter((f) => f.classificationCode === classificationCode);
    }
    if (mailType) {
      folders = folders.filter((f) => f.mailType === mailType);
    }
    res.json({ folders });
  });

  app.post('/api/folders', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const { name, classificationCode, mailType, parentFolderId } = req.body as {
      name?: string;
      classificationCode?: string;
      mailType?: MailType;
      parentFolderId?: string | null;
    };

    if (!name || name.trim().length < 1) {
      res.status(400).json({ error: 'Nama folder tidak boleh kosong.' });
      return;
    }
    if (!classificationCode || !getClassificationByCode(classificationCode)) {
      res.status(400).json({ error: 'Kode klasifikasi arsip tidak valid.' });
      return;
    }
    if (mailType !== 'masuk' && mailType !== 'keluar') {
      res.status(400).json({ error: 'Pilih sub folder Surat Masuk atau Surat Keluar.' });
      return;
    }

    const folder = updateDb((db) => {
      const newFolder = {
        id: `fld-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        name: name.trim(),
        classificationCode,
        mailType,
        parentFolderId: parentFolderId ?? null,
        createdBy: req.currentUser!.fullName,
        createdAt: new Date().toISOString(),
      };
      db.customFolders.push(newFolder);
      db.activities.unshift({
        id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userId: req.currentUser!.id,
        userName: req.currentUser!.fullName,
        userRole: req.currentUser!.role,
        action: 'folder',
        description: `${req.currentUser!.fullName} membuat folder "${newFolder.name}" di ${classificationCode} (${mailType === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}).`,
        documentId: null,
        documentName: null,
        klasifikasiKode: classificationCode,
        jenisSurat: mailType,
        timestamp: new Date().toISOString(),
      });
      return newFolder;
    });

    res.status(201).json({ folder });
  });

  app.get('/api/archives', requireAuth, (req, res) => {
    const { klasifikasiKode, jenisSurat, folderId, q, status } = req.query as {
      klasifikasiKode?: string;
      jenisSurat?: MailType;
      folderId?: string;
      q?: string;
      status?: ArchiveStatus;
    };

    const docs = updateDb((db) => {
      purgeExpiredTrash(db);
      syncJraNotifications(db);

      let list = db.documents.filter((d) => !d.deletedAt);
      if (klasifikasiKode) {
        list = list.filter(
          (d) =>
            d.klasifikasiKode === klasifikasiKode ||
            d.klasifikasiKode.startsWith(`${klasifikasiKode}.`)
        );
      }
      if (jenisSurat === 'masuk' || jenisSurat === 'keluar') {
        list = list.filter((d) => d.jenisSurat === jenisSurat);
      }
      if (folderId) {
        list = list.filter((d) => d.folderId === folderId);
      }
      if (status === 'aktif' || status === 'inaktif') {
        list = list.filter((d) => d.status === status);
      }
      if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        list = list.filter(
          (d) =>
            d.namaFile.toLowerCase().includes(term) ||
            d.perihal.toLowerCase().includes(term) ||
            d.klasifikasiKode.toLowerCase().includes(term) ||
            d.perusahaanPengirim.toLowerCase().includes(term) ||
            d.kepadaTujuan.toLowerCase().includes(term)
        );
      }

      return list
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((doc) => ({
          ...doc,
          jra: evaluateJraStatus({
            klasifikasiKode: doc.klasifikasiKode,
            tanggalSurat: doc.tanggalSurat,
            status: doc.status,
            disposalDecision: doc.disposalDecision,
          }),
        }));
    });

    res.json({ documents: docs });
  });

  app.post(
    '/api/archives',
    requireAuth,
    requireAdmin,
    upload.single('file'),
    (req: AuthenticatedRequest, res) => {
      try {
        const file = req.file;
        const {
          namaFile,
          perihal,
          tanggalSurat,
          jenisSurat,
          klasifikasiKode,
          folderId,
          perusahaanPengirim,
          kepadaTujuan,
          status,
        } = req.body as {
          namaFile?: string;
          perihal?: string;
          tanggalSurat?: string;
          jenisSurat?: MailType;
          klasifikasiKode?: string;
          folderId?: string;
          perusahaanPengirim?: string;
          kepadaTujuan?: string;
          status?: ArchiveStatus;
        };

        if (!file) {
          res.status(400).json({ error: 'Berkas dokumen wajib diunggah.' });
          return;
        }
        if (!namaFile?.trim() || !perihal?.trim() || !tanggalSurat?.trim()) {
          fs.unlinkSync(file.path);
          res.status(400).json({ error: 'Nama file, perihal, dan tanggal surat wajib diisi.' });
          return;
        }
        if (jenisSurat !== 'masuk' && jenisSurat !== 'keluar') {
          fs.unlinkSync(file.path);
          res.status(400).json({ error: 'Jenis surat harus Surat Masuk atau Surat Keluar.' });
          return;
        }
        if (!klasifikasiKode || !getClassificationByCode(klasifikasiKode)) {
          fs.unlinkSync(file.path);
          res.status(400).json({ error: 'Kode klasifikasi arsip tidak valid.' });
          return;
        }
        if (jenisSurat === 'masuk' && !perusahaanPengirim?.trim()) {
          fs.unlinkSync(file.path);
          res.status(400).json({ error: 'Perusahaan / Pengirim wajib diisi untuk Surat Masuk.' });
          return;
        }
        if (jenisSurat === 'keluar' && !kepadaTujuan?.trim()) {
          fs.unlinkSync(file.path);
          res.status(400).json({ error: 'Kepada / Tujuan pengiriman wajib diisi untuk Surat Keluar.' });
          return;
        }

        const storage = computeStorageSummary(readDb());
        if (storage.usedBytes + file.size > storage.capacityBytes) {
          fs.unlinkSync(file.path);
          res.status(400).json({ error: 'Kapasitas penyimpanan 100 GB penuh.' });
          return;
        }

        const docStatus: ArchiveStatus = status === 'inaktif' ? 'inaktif' : 'aktif';
        const nowIso = new Date().toISOString();

        const createdDoc = updateDb((db) => {
          const doc: ArchiveDocument = {
            id: `doc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            namaFile: namaFile.trim(),
            originalFileName: file.originalname,
            mimeType: file.mimetype || 'application/octet-stream',
            fileSize: file.size,
            storageFileName: file.filename,
            perihal: perihal.trim(),
            tanggalSurat: tanggalSurat.trim(),
            jenisSurat,
            klasifikasiKode,
            folderId: folderId?.trim() || null,
            perusahaanPengirim: jenisSurat === 'masuk' ? perusahaanPengirim!.trim() : req.currentUser!.fullName,
            kepadaTujuan: jenisSurat === 'keluar' ? kepadaTujuan!.trim() : 'Internal Organisasi',
            status: docStatus,
            disposalDecision: 'pending',
            uploadedById: req.currentUser!.id,
            uploadedByName: req.currentUser!.fullName,
            uploadedByRole: req.currentUser!.role,
            createdAt: nowIso,
            updatedAt: nowIso,
            deletedAt: null,
            deletedByName: null,
          };

          db.documents.unshift(doc);
          db.activities.unshift({
            id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            userId: req.currentUser!.id,
            userName: req.currentUser!.fullName,
            userRole: req.currentUser!.role,
            action: 'upload',
            description: `${req.currentUser!.fullName} mengunggah ${jenisSurat === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'} "${doc.namaFile}" (${doc.klasifikasiKode}) — Perihal: ${doc.perihal}.`,
            documentId: doc.id,
            documentName: doc.namaFile,
            klasifikasiKode: doc.klasifikasiKode,
            jenisSurat: doc.jenisSurat,
            timestamp: nowIso,
          });

          db.notifications.unshift({
            id: `notif-upload-${doc.id}`,
            title: doc.jenisSurat === 'masuk' ? 'Surat Masuk Baru' : 'Surat Keluar Baru',
            message: `"${doc.namaFile}" (${doc.klasifikasiKode}) — ${doc.perihal}`,
            category: doc.jenisSurat === 'masuk' ? 'surat_masuk' : 'surat_keluar',
            documentId: doc.id,
            klasifikasiKode: doc.klasifikasiKode,
            jenisSurat: doc.jenisSurat,
            isRead: false,
            createdAt: nowIso,
          });

          syncJraNotifications(db);

          return {
            ...doc,
            jra: evaluateJraStatus({
              klasifikasiKode: doc.klasifikasiKode,
              tanggalSurat: doc.tanggalSurat,
              status: doc.status,
              disposalDecision: doc.disposalDecision,
            }),
          };
        });

        res.status(201).json({ document: createdDoc });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Gagal mengunggah dokumen arsip.' });
      }
    }
  );

  app.patch('/api/archives/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const {
      namaFile,
      perihal,
      tanggalSurat,
      perusahaanPengirim,
      kepadaTujuan,
      status,
      disposalDecision,
    } = req.body as {
      namaFile?: string;
      perihal?: string;
      tanggalSurat?: string;
      perusahaanPengirim?: string;
      kepadaTujuan?: string;
      status?: ArchiveStatus;
      disposalDecision?: DisposalDecision;
    };

    const result = updateDb((db) => {
      const doc = db.documents.find((d) => d.id === id && !d.deletedAt);
      if (!doc) return null;

      const prevStatus = doc.status;
      if (namaFile?.trim()) doc.namaFile = namaFile.trim();
      if (perihal?.trim()) doc.perihal = perihal.trim();
      if (tanggalSurat?.trim()) doc.tanggalSurat = tanggalSurat.trim();
      if (perusahaanPengirim !== undefined && doc.jenisSurat === 'masuk') {
        doc.perusahaanPengirim = perusahaanPengirim.trim();
      }
      if (kepadaTujuan !== undefined && doc.jenisSurat === 'keluar') {
        doc.kepadaTujuan = kepadaTujuan.trim();
      }
      if (status === 'aktif' || status === 'inaktif') {
        doc.status = status;
      }
      if (disposalDecision === 'pending' || disposalDecision === 'dipertahankan' || disposalDecision === 'dimusnahkan') {
        doc.disposalDecision = disposalDecision;
      }
      doc.updatedAt = new Date().toISOString();

      if (disposalDecision === 'dimusnahkan') {
        // Admin confirmed disposal from JRA notification: move to 30-day deleted history or record disposal
        doc.deletedAt = doc.updatedAt;
        doc.deletedByName = `${req.currentUser!.fullName} (Pemusnahan JRA)`;
      }

      db.activities.unshift({
        id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userId: req.currentUser!.id,
        userName: req.currentUser!.fullName,
        userRole: req.currentUser!.role,
        action:
          disposalDecision === 'dimusnahkan' || disposalDecision === 'dipertahankan'
            ? 'disposal'
            : prevStatus !== doc.status
              ? 'status'
              : 'edit',
        description:
          disposalDecision === 'dimusnahkan'
            ? `${req.currentUser!.fullName} mengonfirmasi pemusnahan JRA untuk "${doc.namaFile}" (${doc.klasifikasiKode}).`
            : disposalDecision === 'dipertahankan'
              ? `${req.currentUser!.fullName} memilih mempertahankan arsip "${doc.namaFile}" setelah evaluasi JRA.`
              : prevStatus !== doc.status
                ? `${req.currentUser!.fullName} mengubah status "${doc.namaFile}" menjadi ${doc.status.toUpperCase()}.`
                : `${req.currentUser!.fullName} memperbarui data dokumen "${doc.namaFile}" (${doc.klasifikasiKode}).`,
        documentId: doc.id,
        documentName: doc.namaFile,
        klasifikasiKode: doc.klasifikasiKode,
        jenisSurat: doc.jenisSurat,
        timestamp: doc.updatedAt,
      });

      syncJraNotifications(db);

      return {
        ...doc,
        jra: evaluateJraStatus({
          klasifikasiKode: doc.klasifikasiKode,
          tanggalSurat: doc.tanggalSurat,
          status: doc.status,
          disposalDecision: doc.disposalDecision,
        }),
      };
    });

    if (!result) {
      res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
      return;
    }

    res.json({ document: result });
  });

  // Record preview/open & stream inline
  app.post('/api/archives/:id/log-open', requireAuth, (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const db = readDb();
    const doc = db.documents.find((d) => d.id === id && !d.deletedAt);
    if (!doc) {
      res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
      return;
    }

    updateDb((state) => {
      const nowIso = new Date().toISOString();
      state.accessHistory.unshift({
        id: `hist-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        documentId: doc.id,
        documentName: doc.namaFile,
        klasifikasiKode: doc.klasifikasiKode,
        jenisSurat: doc.jenisSurat,
        fileSize: doc.fileSize,
        userId: req.currentUser!.id,
        userName: req.currentUser!.fullName,
        userRole: req.currentUser!.role,
        type: 'open',
        timestamp: nowIso,
      });
      state.activities.unshift({
        id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userId: req.currentUser!.id,
        userName: req.currentUser!.fullName,
        userRole: req.currentUser!.role,
        action: 'view',
        description: `${req.currentUser!.fullName} (${req.currentUser!.role === 'admin' ? 'Admin' : 'Viewer'}) membuka pratinjau "${doc.namaFile}".`,
        documentId: doc.id,
        documentName: doc.namaFile,
        klasifikasiKode: doc.klasifikasiKode,
        jenisSurat: doc.jenisSurat,
        timestamp: nowIso,
      });
    });

    res.json({ success: true });
  });

  app.get('/api/archives/:id/preview', requireAuth, (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const doc = db.documents.find((d) => d.id === id && !d.deletedAt);
    if (!doc) {
      res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
      return;
    }
    const filePath = path.join(UPLOADS_DIR, doc.storageFileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Berkas fisik tidak ditemukan di penyimpanan.' });
      return;
    }
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFileName)}"`);
    res.sendFile(filePath);
  });

  app.get('/api/archives/:id/download', requireAuth, (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const db = readDb();
    const doc = db.documents.find((d) => d.id === id && !d.deletedAt);
    if (!doc) {
      res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
      return;
    }
    const filePath = path.join(UPLOADS_DIR, doc.storageFileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Berkas fisik tidak ditemukan.' });
      return;
    }

    updateDb((state) => {
      const nowIso = new Date().toISOString();
      state.accessHistory.unshift({
        id: `hist-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        documentId: doc.id,
        documentName: doc.namaFile,
        klasifikasiKode: doc.klasifikasiKode,
        jenisSurat: doc.jenisSurat,
        fileSize: doc.fileSize,
        userId: req.currentUser!.id,
        userName: req.currentUser!.fullName,
        userRole: req.currentUser!.role,
        type: 'download',
        timestamp: nowIso,
      });
      state.activities.unshift({
        id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userId: req.currentUser!.id,
        userName: req.currentUser!.fullName,
        userRole: req.currentUser!.role,
        action: 'download',
        description: `${req.currentUser!.fullName} (${req.currentUser!.role === 'admin' ? 'Admin' : 'Viewer'}) mengunduh "${doc.namaFile}".`,
        documentId: doc.id,
        documentName: doc.namaFile,
        klasifikasiKode: doc.klasifikasiKode,
        jenisSurat: doc.jenisSurat,
        timestamp: nowIso,
      });
    });

    res.download(filePath, doc.originalFileName);
  });

  app.delete('/api/archives/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const removed = updateDb((db) => {
      const doc = db.documents.find((d) => d.id === id && !d.deletedAt);
      if (!doc) return null;
      const nowIso = new Date().toISOString();
      doc.deletedAt = nowIso;
      doc.deletedByName = req.currentUser!.fullName;
      doc.updatedAt = nowIso;

      db.activities.unshift({
        id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userId: req.currentUser!.id,
        userName: req.currentUser!.fullName,
        userRole: req.currentUser!.role,
        action: 'delete',
        description: `${req.currentUser!.fullName} menghapus "${doc.namaFile}" (${doc.klasifikasiKode}) — disimpan di Riwayat Sampah selama 30 hari.`,
        documentId: doc.id,
        documentName: doc.namaFile,
        klasifikasiKode: doc.klasifikasiKode,
        jenisSurat: doc.jenisSurat,
        timestamp: nowIso,
      });

      return doc;
    });

    if (!removed) {
      res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
      return;
    }
    res.json({ success: true });
  });

  // ==================== HISTORY ROUTES ====================

  app.get('/api/history', requireAuth, (_req, res) => {
    const payload = updateDb((db) => {
      purgeExpiredTrash(db);
      const now = new Date();
      const deleted = db.documents
        .filter((d) => Boolean(d.deletedAt))
        .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
        .map((d) => ({
          id: `del-${d.id}`,
          documentId: d.id,
          namaFile: d.namaFile,
          perihal: d.perihal,
          klasifikasiKode: d.klasifikasiKode,
          jenisSurat: d.jenisSurat,
          fileSize: d.fileSize,
          deletedByName: d.deletedByName ?? d.uploadedByName,
          deletedByRole: 'admin' as const,
          deletedAt: d.deletedAt!,
          expiresAt: calculateTrashExpirationIso(d.deletedAt!),
          remainingDays: calculateTrashRemainingDays(d.deletedAt!, now),
        }));

      const opened = db.accessHistory.filter((h) => h.type === 'open').slice(0, 100);
      const downloaded = db.accessHistory.filter((h) => h.type === 'download').slice(0, 100);

      return { deleted, opened, downloaded };
    });

    res.json(payload);
  });

  app.post(
    '/api/history/deleted/:docId/restore',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const { docId } = req.params;
      const restored = updateDb((db) => {
        const doc = db.documents.find((d) => d.id === docId && Boolean(d.deletedAt));
        if (!doc) return null;
        doc.deletedAt = null;
        doc.deletedByName = null;
        if (doc.disposalDecision === 'dimusnahkan') {
          doc.disposalDecision = 'dipertahankan';
        }
        doc.updatedAt = new Date().toISOString();

        db.activities.unshift({
          id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          userId: req.currentUser!.id,
          userName: req.currentUser!.fullName,
          userRole: req.currentUser!.role,
          action: 'restore',
          description: `${req.currentUser!.fullName} memulihkan "${doc.namaFile}" dari Riwayat Dihapus.`,
          documentId: doc.id,
          documentName: doc.namaFile,
          klasifikasiKode: doc.klasifikasiKode,
          jenisSurat: doc.jenisSurat,
          timestamp: doc.updatedAt,
        });
        return doc;
      });

      if (!restored) {
        res.status(404).json({ error: 'Arsip di riwayat terhapus tidak ditemukan.' });
        return;
      }
      res.json({ document: restored });
    }
  );

  app.delete(
    '/api/history/deleted/:docId/permanent',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const { docId } = req.params;
      const purged = updateDb((db) => {
        const doc = db.documents.find((d) => d.id === docId && Boolean(d.deletedAt));
        if (!doc) return false;
        const filePath = path.join(UPLOADS_DIR, doc.storageFileName);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            // ignore
          }
        }
        db.documents = db.documents.filter((d) => d.id !== docId);
        db.notifications = db.notifications.filter((n) => n.documentId !== docId);
        db.activities.unshift({
          id: `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          userId: req.currentUser!.id,
          userName: req.currentUser!.fullName,
          userRole: req.currentUser!.role,
          action: 'purge',
          description: `${req.currentUser!.fullName} menghapus permanen arsip "${doc.namaFile}" (${doc.klasifikasiKode}).`,
          documentId: doc.id,
          documentName: doc.namaFile,
          klasifikasiKode: doc.klasifikasiKode,
          jenisSurat: doc.jenisSurat,
          timestamp: new Date().toISOString(),
        });
        return true;
      });

      if (!purged) {
        res.status(404).json({ error: 'Arsip tidak ditemukan.' });
        return;
      }
      res.json({ success: true });
    }
  );

  // ==================== NOTIFICATIONS ROUTES ====================

  app.get('/api/notifications', requireAuth, (_req, res) => {
    const notifications = updateDb((db) => {
      syncJraNotifications(db);
      return db.notifications.slice(0, 60);
    });
    res.json({ notifications });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req, res) => {
    const { id } = req.params;
    updateDb((db) => {
      const item = db.notifications.find((n) => n.id === id);
      if (item) item.isRead = true;
    });
    res.json({ success: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (_req, res) => {
    updateDb((db) => {
      for (const n of db.notifications) {
        n.isRead = true;
      }
    });
    res.json({ success: true });
  });

  // ==================== SETTINGS & FEEDBACK ROUTES ====================

  app.get('/api/settings', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    // STRICTLY NO admin/viewer secret access codes returned in settings payload!
    res.json({
      websiteIdentity: {
        name: 'SIPERSIP',
        fullName: 'Sistem Penyimpanan Arsip',
        tagline: 'Kelola Arsip dengan Mudah, Lebih Teratur.',
        managedBy: 'Penyedia Sistem (Provider)',
        isReadOnly: true,
        classificationStandard: 'Daftar Klasifikasi Arsip & JRA Terintegrasi',
      },
      security: {
        emailVerified: req.currentUser!.isVerified,
        roleLabel: req.currentUser!.role === 'admin' ? 'Admin (Akses Penuh)' : 'Viewer (Lihat & Unduh)',
        trashRetentionDays: 30,
        sessionProtection: 'Token HMAC-SHA256 & Enkripsi Bcrypt Aktif',
      },
      storage: computeStorageSummary(db),
      feedback: db.feedback.slice(0, 30),
    });
  });

  app.post('/api/settings/feedback', requireAuth, (req: AuthenticatedRequest, res) => {
    const { subject, message } = req.body as { subject?: string; message?: string };
    if (!subject?.trim() || !message?.trim()) {
      res.status(400).json({ error: 'Subjek dan isi masukan wajib diisi.' });
      return;
    }

    const item = updateDb((db) => {
      const entry = {
        id: `fb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userName: req.currentUser!.fullName,
        userRole: req.currentUser!.role,
        subject: subject.trim(),
        message: message.trim(),
        createdAt: new Date().toISOString(),
      };
      db.feedback.unshift(entry);
      return entry;
    });

    res.status(201).json({ feedback: item });
  });

  // ==================== VITE / STATIC SERVING ====================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIPERSIP server listening on http://localhost:${PORT}`);
  });
}

startServer();
