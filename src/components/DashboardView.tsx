import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  Inbox,
  Send,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { DashboardPayload, MailType, UserPublic } from '../types';
import { formatBytes } from '../utils/jra';

interface DashboardViewProps {
  user: UserPublic;
  data: DashboardPayload | null;
  loading: boolean;
  onNavigateArchives: (mailFilter?: MailType | 'all') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  data,
  loading,
  onNavigateArchives,
}) => {
  const [chartType, setChartType] = useState<MailType>('masuk');

  const activeSeries =
    chartType === 'masuk' ? data?.chartMasuk ?? [] : data?.chartKeluar ?? [];
  const maxCount = Math.max(1, ...activeSeries.map((pt) => pt.count));

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      {/* Greeting Banner */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-[#CBD5E1] rounded-2xl p-6 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F2937] tracking-tight [text-wrap:balance]">
            Selamat datang, {user.fullName}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5">
            Ringkasan dokumen arsip, distribusi surat masuk & keluar, serta catatan aktivitas terbaru di SIPERSIP.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateArchives('all')}
            className="px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            Buka Folder Arsip
          </button>
        </div>
      </motion.section>

      {/* Primary Stat Cards */}
      <section aria-label="Statistik Arsip" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.3, delay: 0.03 }}
          className="bg-white border border-[#CBD5E1] rounded-2xl p-5 flex items-start justify-between gap-4"
        >
          <div>
            <div className="text-xs font-semibold text-[#6B7280]">Total Dokumen</div>
            <div className="font-display text-3xl font-bold text-[#1F2937] mt-2 tabular-nums">
              {loading ? '—' : data?.totalDokumen ?? 0}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {data ? `${formatBytes(data.storage.usedBytes)} terpakai` : '0 B terpakai'}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E8F1FF] text-[#0D47A1] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="bg-white border border-[#CBD5E1] rounded-2xl p-5 flex items-start justify-between gap-4"
        >
          <div>
            <div className="text-xs font-semibold text-[#6B7280]">Total Kategori</div>
            <div className="font-display text-3xl font-bold text-[#1F2937] mt-2 tabular-nums">
              {loading ? '—' : data?.totalKategori ?? 53}
            </div>
            <div className="text-xs text-[#6B7280] mt-1 tabular-nums">
              {data?.totalKategoriTerpakai ?? 0} kategori terisi arsip
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E8F1FF] text-[#2E6BD6] flex items-center justify-center shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.button
          type="button"
          onClick={() => onNavigateArchives('masuk')}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.3, delay: 0.13 }}
          className="text-left bg-white border border-[#CBD5E1] hover:border-[#2E6BD6] rounded-2xl p-5 flex items-start justify-between gap-4 transition-colors"
        >
          <div>
            <div className="text-xs font-semibold text-[#6B7280]">Surat Masuk</div>
            <div className="font-display text-3xl font-bold text-[#1F2937] mt-2 tabular-nums">
              {loading ? '—' : data?.totalSuratMasuk ?? 0}
            </div>
            <div className="text-xs text-[#2E6BD6] font-medium mt-1">Lihat arsip masuk</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#DFF5E1] text-[#2E7D32] flex items-center justify-center shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onNavigateArchives('keluar')}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.3, delay: 0.18 }}
          className="text-left bg-white border border-[#CBD5E1] hover:border-[#2E6BD6] rounded-2xl p-5 flex items-start justify-between gap-4 transition-colors"
        >
          <div>
            <div className="text-xs font-semibold text-[#6B7280]">Surat Keluar</div>
            <div className="font-display text-3xl font-bold text-[#1F2937] mt-2 tabular-nums">
              {loading ? '—' : data?.totalSuratKeluar ?? 0}
            </div>
            <div className="text-xs text-[#2E6BD6] font-medium mt-1">Lihat arsip keluar</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#FEF9C3] text-[#A16207] flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
        </motion.button>
      </section>

      {/* Main Content Grid: Bar Chart (Slideable Surat Masuk / Surat Keluar) + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Bar Chart Section */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.35 }}
          className="xl:col-span-7 bg-white border border-[#CBD5E1] rounded-2xl p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-display text-lg font-bold text-[#1F2937]">
                Grafik {chartType === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Diagram batang jumlah arsip terunggah berdasarkan bulan surat. Geser untuk beralih tampilan.
              </p>
            </div>

            {/* Slide / Toggle Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-label="Geser ke grafik sebelumnya"
                onClick={() => setChartType((t) => (t === 'masuk' ? 'keluar' : 'masuk'))}
                className="p-2 rounded-lg border border-[#CBD5E1] text-[#6B7280] hover:text-[#0D47A1] hover:bg-[#F8FAFC]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="inline-flex p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
                <button
                  type="button"
                  onClick={() => setChartType('masuk')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    chartType === 'masuk'
                      ? 'bg-[#0D47A1] text-white'
                      : 'text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                >
                  Surat Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('keluar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    chartType === 'keluar'
                      ? 'bg-[#0D47A1] text-white'
                      : 'text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                >
                  Surat Keluar
                </button>
              </div>

              <button
                type="button"
                aria-label="Geser ke grafik berikutnya"
                onClick={() => setChartType((t) => (t === 'masuk' ? 'keluar' : 'masuk'))}
                className="p-2 rounded-lg border border-[#CBD5E1] text-[#6B7280] hover:text-[#0D47A1] hover:bg-[#F8FAFC]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={chartType}
                initial={{ opacity: 0, x: chartType === 'masuk' ? -18 : 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: chartType === 'masuk' ? 18 : -18 }}
                transition={{ duration: 0.25 }}
              >
                {activeSeries.length === 0 ? (
                  <div className="h-64 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] flex flex-col items-center justify-center text-center p-6">
                    <ArrowLeftRight className="w-8 h-8 text-[#94A3B8] mb-2" />
                    <div className="text-sm font-semibold text-[#1F2937]">
                      Belum ada data {chartType === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1 max-w-xs">
                      Diagram batang akan terisi otomatis saat dokumen {chartType === 'masuk' ? 'surat masuk' : 'surat keluar'} diunggah ke arsip.
                    </p>
                  </div>
                ) : (
                  <div className="relative h-64 pt-6 pb-2 px-2">
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-2 top-8 bottom-8 flex flex-col justify-between pointer-events-none"
                    >
                      <div className="border-b border-dashed border-[#E2E8F0] w-full" />
                      <div className="border-b border-dashed border-[#E2E8F0] w-full" />
                      <div className="border-b border-[#CBD5E1] w-full" />
                    </div>
                    <div className="relative z-10 h-full flex items-end justify-start gap-6 overflow-x-auto px-3">
                      {activeSeries.map((pt) => {
                        const heightPct = Math.max(12, Math.round((pt.count / maxCount) * 100));
                        return (
                          <div
                            key={pt.monthKey}
                            className="w-20 shrink-0 h-full flex flex-col items-center justify-end gap-2 group"
                          >
                            <span className="text-xs font-mono font-bold text-[#0D47A1] tabular-nums">
                              {pt.count}
                            </span>
                            <div className="w-12 h-40 bg-[#F1F5F9]/85 rounded-t-xl flex items-end overflow-hidden p-1">
                              <motion.div
                                initial={{ scaleY: 0 }}
                                animate={{ scaleY: 1 }}
                                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                style={{ height: `${heightPct}%`, transformOrigin: 'bottom' }}
                                className={`w-full rounded-t-lg transition-colors ${
                                  chartType === 'masuk'
                                    ? 'bg-[#2E6BD6] group-hover:bg-[#0D47A1]'
                                    : 'bg-[#0D47A1] group-hover:bg-[#2E6BD6]'
                                }`}
                              />
                            </div>
                            <span className="text-[11px] font-medium text-[#6B7280] whitespace-nowrap">
                              {pt.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Activity Feed Section */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="xl:col-span-5 bg-white border border-[#CBD5E1] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-display text-lg font-bold text-[#1F2937]">Activity Feed</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Riwayat akses Admin & Viewer serta dokumen yang terunggah secara rinci.
              </p>
            </div>
            <Activity className="w-5 h-5 text-[#2E6BD6] shrink-0" />
          </div>

          <div className="mt-4 max-h-[340px] overflow-y-auto divide-y divide-[#F1F5F9]">
            {!data || data.activities.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-[#1F2937]">Belum ada aktivitas tercatat</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Setiap aktivitas masuk, unggah, buka pratinjau, edit, dan unduh dokumen akan tampil di sini.
                </p>
              </div>
            ) : (
              data.activities.map((act) => (
                <div key={act.id} className="py-3 first:pt-1 last:pb-1 flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      act.userRole === 'admin'
                        ? 'bg-[#E8F1FF] text-[#0D47A1]'
                        : 'bg-[#F1F5F9] text-[#475569]'
                    }`}
                  >
                    {act.userRole === 'admin' ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#1F2937] leading-relaxed">{act.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B7280] tabular-nums">
                      <span>{act.userRole === 'admin' ? 'Admin' : 'Viewer'}</span>
                      {act.klasifikasiKode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[#0D47A1]">{act.klasifikasiKode}</span>
                        </>
                      )}
                      {act.jenisSurat && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{act.jenisSurat === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{formatTime(act.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};
