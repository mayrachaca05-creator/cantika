import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Globe,
  HardDrive,
  HelpCircle,
  Lock,
  MessageSquarePlus,
  ShieldCheck,
} from 'lucide-react';
import { FeedbackItem, StorageSummary } from '../types';
import { apiRequest } from '../utils/api';
import { formatBytes } from '../utils/jra';

interface SettingsData {
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

interface SettingsViewProps {
  settings: SettingsData | null;
  onRefresh: () => void;
  onOpenEditProfile: () => void;
}

const QA_ITEMS = [
  {
    q: 'Bagaimana cara kerja perubahan warna otomatis JRA pada Surat Aktif dan Surat Inaktif?',
    a: 'Setiap arsip yang diunggah mengikuti aturan Jadwal Retensi Arsip (JRA) pada Daftar Klasifikasi Arsip. Surat berstatus Aktif yang telah memasuki ambang batas masa JRA otomatis berwarna hijau sebagai pengingat peninjauan. Surat berstatus Inaktif yang masa retensinya telah habis otomatis berwarna kuning dan memicu notifikasi konfirmasi pemusnahan agar tidak langsung terhapus tanpa persetujuan.',
  },
  {
    q: 'Apa perbedaan hak akses antara Admin dan Viewer?',
    a: 'Admin memiliki akses penuh untuk menambah folder, mengunggah dokumen surat masuk/keluar, mengedit metadata, mengubah status aktif/inaktif, mengonfirmasi pemusnahan JRA, dan menghapus arsip. Viewer hanya diperbolehkan melihat daftar arsip, membuka pratinjau dokumen, dan mengunduh berkas.',
  },
  {
    q: 'Berapa lama arsip yang dihapus disimpan sebelum hilang permanen?',
    a: 'Dokumen yang dihapus akan masuk ke menu History → Riwayat Dihapus dan dipertahankan selama 30 hari kalender. Setelah melewati 30 hari, sistem akan membersihkannya secara permanen.',
  },
  {
    q: 'Apakah Identitas Website dapat diubah oleh Admin?',
    a: 'Tidak. Identitas website SIPERSIP bersifat informasi resmi tetap dan hanya dapat dikelola oleh penyedia sistem (provider).',
  },
  {
    q: 'Berapa total kapasitas penyimpanan yang tersedia pada SIPERSIP?',
    a: 'SIPERSIP menyediakan kapasitas penyimpanan sebesar 100 GB yang dipantau secara langsung pada menu Pengaturan Penyimpanan.',
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefresh,
  onOpenEditProfile,
}) => {
  const [openQaIndex, setOpenQaIndex] = useState<number | null>(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackNotice(null);
    try {
      await apiRequest('/api/settings/feedback', {
        method: 'POST',
        body: JSON.stringify({ subject, message }),
      });
      setSubject('');
      setMessage('');
      setFeedbackNotice('Terima kasih! Masukan Anda telah tersimpan.');
      onRefresh();
    } catch {
      setFeedbackNotice('Gagal mengirim masukan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const storage = settings?.storage;
  const percentDisplay = storage ? Math.min(100, storage.percentUsed) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#CBD5E1] rounded-2xl p-6"
      >
        <h1 className="font-display text-xl font-bold text-[#1F2937]">Pengaturan Sistem</h1>
        <p className="text-xs text-[#6B7280] mt-1">
          Informasi identitas resmi website, keamanan akun, pemantauan kapasitas penyimpanan 100 GB, serta pusat bantuan Q&A.
        </p>
      </motion.section>

      {/* 1. Identitas Website (Strictly Read-Only, Provider-Only) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F1FF] text-[#0D47A1] flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2937]">
                Identitas Website
              </h2>
              <p className="text-xs text-[#6B7280]">
                Informasi terlampir tetap — hanya dapat diubah oleh penyedia sistem (provider).
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Terkunci (Provider)</span>
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <dt className="text-[#6B7280]">Nama Singkatan</dt>
            <dd className="font-display font-bold text-sm text-[#0D47A1] mt-1">
              {settings?.websiteIdentity.name ?? 'SIPERSIP'}
            </dd>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <dt className="text-[#6B7280]">Nama Resmi Sistem</dt>
            <dd className="font-semibold text-sm text-[#1F2937] mt-1">
              {settings?.websiteIdentity.fullName ?? 'Sistem Penyimpanan Arsip'}
            </dd>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <dt className="text-[#6B7280]">Slogan Layanan</dt>
            <dd className="font-medium text-[#1F2937] mt-1">
              {settings?.websiteIdentity.tagline ?? 'Kelola Arsip dengan Mudah, Lebih Teratur.'}
            </dd>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <dt className="text-[#6B7280]">Standar Klasifikasi</dt>
            <dd className="font-medium text-[#1F2937] mt-1">
              {settings?.websiteIdentity.classificationStandard ??
                'Daftar Klasifikasi Arsip & JRA Terintegrasi'}
            </dd>
          </div>
        </dl>
      </motion.section>

      {/* 2. Pengaturan Keamanan (NO Admin/Viewer secret codes shown!) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DFF5E1] text-[#2E7D32] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2937]">
                Pengaturan Keamanan
              </h2>
              <p className="text-xs text-[#6B7280]">
                Status keamanan sesi akun pribadi, verifikasi email, dan perlindungan retensi arsip.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenEditProfile}
            className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] hover:bg-[#E8F1FF] text-xs font-semibold text-[#0D47A1] whitespace-nowrap shrink-0"
          >
            Ubah Password Akun Pribadi
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-[#6B7280]">Status Peran Anda</div>
            <div className="font-semibold text-[#1F2937] mt-1">
              {settings?.security.roleLabel ?? '—'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-[#6B7280]">Verifikasi Email</div>
            <div className="font-semibold text-[#43A047] mt-1">
              {settings?.security.emailVerified ? 'Terverifikasi Aktif' : 'Belum Terverifikasi'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-[#6B7280]">Proteksi Sesi & Sampah</div>
            <div className="font-semibold text-[#1F2937] mt-1">
              Enkripsi Aktif · Retensi Sampah 30 Hari
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3. Pengaturan Penyimpanan (100 GB Capacity) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F1FF] text-[#2E6BD6] flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2937]">
                Pengaturan Penyimpanan
              </h2>
              <p className="text-xs text-[#6B7280]">
                Alokasi kapasitas penyimpanan arsip digital sebesar 100 GB.
              </p>
            </div>
          </div>
          <div className="text-right tabular-nums">
            <div className="font-display font-bold text-sm text-[#0D47A1]">
              {storage ? formatBytes(storage.usedBytes) : '0 B'} / 100 GB
            </div>
            <div className="text-[11px] text-[#6B7280]">
              {percentDisplay.toFixed(2)}% terpakai
            </div>
          </div>
        </div>

        <div className="w-full h-3 rounded-full bg-[#F1F5F9] overflow-hidden border border-[#E2E8F0]">
          <div
            style={{ width: `${Math.max(storage && storage.usedBytes > 0 ? 1.5 : 0, percentDisplay)}%` }}
            className="h-full bg-[#2E6BD6] transition-all duration-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs tabular-nums">
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-[#6B7280]">Arsip Aktif & Inaktif</div>
            <div className="font-bold text-sm text-[#1F2937] mt-1">
              {storage ? formatBytes(storage.activeBytes) : '0 B'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-[#6B7280]">Sampah Retensi 30 Hari</div>
            <div className="font-bold text-sm text-[#1F2937] mt-1">
              {storage ? formatBytes(storage.trashBytes) : '0 B'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="text-[#6B7280]">Sisa Kapasitas Tersedia</div>
            <div className="font-bold text-sm text-[#43A047] mt-1">
              {storage ? formatBytes(storage.remainingBytes) : '100.00 GB'}
            </div>
          </div>
        </div>
      </motion.section>

      {/* 4. Bantuan & Masukan (Q&A) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-6"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
          <div className="w-10 h-10 rounded-xl bg-[#FEF9C3] text-[#A16207] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-[#1F2937]">
              Bantuan & Masukan (Q&A)
            </h2>
            <p className="text-xs text-[#6B7280]">
              Pertanyaan yang sering diajukan serta formulir masukan untuk pengembangan SIPERSIP.
            </p>
          </div>
        </div>

        {/* Q&A Accordion */}
        <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl overflow-hidden">
          {QA_ITEMS.map((item, idx) => {
            const isOpen = openQaIndex === idx;
            return (
              <div key={item.q} className="bg-white">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenQaIndex(isOpen ? null : idx)}
                  className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-4 hover:bg-[#F8FAFC]"
                >
                  <span className="text-xs sm:text-sm font-semibold text-[#1F2937]">{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#6B7280] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B7280] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-[#475569] leading-relaxed bg-[#F8FAFC]/60">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback Form */}
        <form onSubmit={handleSubmitFeedback} className="pt-2 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1F2937]">
            <MessageSquarePlus className="w-4 h-4 text-[#2E6BD6]" />
            <span>Kirim Masukan atau Pertanyaan</span>
          </div>

          {feedbackNotice && (
            <div className="p-3 rounded-xl bg-[#E8F1FF] text-[#0D47A1] text-xs font-medium">
              {feedbackNotice}
            </div>
          )}

          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subjek masukan..."
            aria-label="Subjek masukan"
            className="w-full px-3.5 py-2 text-xs border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30"
          />
          <textarea
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tuliskan pertanyaan, kendala, atau saran Anda..."
            aria-label="Isi masukan"
            className="w-full px-3.5 py-2 text-xs border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] text-white text-xs font-semibold transition-colors"
          >
            {submitting ? 'Mengirim...' : 'Kirim Masukan'}
          </button>
        </form>
      </motion.section>
    </div>
  );
};
