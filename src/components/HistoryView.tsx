import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Download, Eye, RotateCcw, Trash2 } from 'lucide-react';
import { DeletedHistoryItem, HistoryAccessRecord, UserRole } from '../types';
import { apiRequest } from '../utils/api';
import { formatBytes } from '../utils/jra';

interface HistoryViewProps {
  userRole: UserRole;
  deleted: DeletedHistoryItem[];
  opened: HistoryAccessRecord[];
  downloaded: HistoryAccessRecord[];
  onRefresh: () => void;
  onOpenDocumentById: (docId: string) => void;
}

type HistoryTab = 'deleted' | 'opened' | 'downloaded';

export const HistoryView: React.FC<HistoryViewProps> = ({
  userRole,
  deleted,
  opened,
  downloaded,
  onRefresh,
  onOpenDocumentById,
}) => {
  const [activeTab, setActiveTab] = useState<HistoryTab>('deleted');
  const isAdmin = userRole === 'admin';

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleRestore = async (docId: string) => {
    try {
      await apiRequest(`/api/history/deleted/${docId}/restore`, { method: 'POST' });
      onRefresh();
    } catch {
      // ignore
    }
  };

  const handlePermanentDelete = async (docId: string) => {
    try {
      await apiRequest(`/api/history/deleted/${docId}/permanent`, { method: 'DELETE' });
      onRefresh();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#CBD5E1] rounded-2xl p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-[#1F2937]">
              Riwayat & Retensi Arsip
            </h1>
            <p className="text-xs text-[#6B7280] mt-1">
              Pantau arsip terhapus (disimpan 30 hari sebelum hapus permanen otomatis), dokumen baru saja dibuka, dan riwayat pengunduhan.
            </p>
          </div>

          <div className="inline-flex flex-wrap p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('deleted')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'deleted'
                  ? 'bg-[#0D47A1] text-white'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Riwayat Dihapus ({deleted.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('opened')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'opened'
                  ? 'bg-[#0D47A1] text-white'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Baru Saja Terbuka ({opened.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('downloaded')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'downloaded'
                  ? 'bg-[#0D47A1] text-white'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Riwayat Pengunduhan ({downloaded.length})
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section
        key={activeTab}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden"
      >
        {activeTab === 'deleted' && (
          <div>
            <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
              <div className="text-xs font-semibold text-[#1F2937]">
                Arsip Terhapus · Masa Retensi 30 Hari Sebelum Pembersihan Otomatis
              </div>
              <Clock className="w-4 h-4 text-[#6B7280]" />
            </div>

            {deleted.length === 0 ? (
              <div className="p-10 text-center">
                <Trash2 className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                <div className="text-sm font-semibold text-[#1F2937]">
                  Tidak ada arsip dalam daftar terhapus
                </div>
                <p className="text-xs text-[#6B7280] mt-1">
                  Dokumen yang dihapus akan bertahan di sini selama 30 hari sebelum dihapus permanen oleh sistem.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {deleted.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F8FAFC]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#0D47A1]">
                        <span>{item.klasifikasiKode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.jenisSurat === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#E63946] font-semibold tabular-nums">
                          Sisa {item.remainingDays} hari sebelum hapus permanen
                        </span>
                      </div>
                      <div className="font-display font-bold text-sm text-[#1F2937] mt-1">
                        {item.namaFile}
                      </div>
                      <div className="text-xs text-[#6B7280] mt-0.5 tabular-nums">
                        Dihapus oleh {item.deletedByName} pada {formatDateTime(item.deletedAt)} ·{' '}
                        {formatBytes(item.fileSize)}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestore(item.documentId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#2E6BD6] text-[#0D47A1] hover:bg-[#E8F1FF] text-xs font-semibold transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Pulihkan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(item.documentId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#FECACA] text-[#E63946] hover:bg-[#FEF2F2] text-xs font-semibold transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Permanen</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'opened' && (
          <div>
            <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
              <div className="text-xs font-semibold text-[#1F2937]">
                Riwayat Dokumen yang Baru Saja Terbuka
              </div>
              <Eye className="w-4 h-4 text-[#2E6BD6]" />
            </div>

            {opened.length === 0 ? (
              <div className="p-10 text-center">
                <Eye className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                <div className="text-sm font-semibold text-[#1F2937]">
                  Belum ada dokumen yang dibuka
                </div>
                <p className="text-xs text-[#6B7280] mt-1">
                  Setiap pratinjau dokumen yang Anda buka akan tercatat di sini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {opened.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-[#F8FAFC]"
                  >
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm text-[#1F2937] truncate">
                        {rec.documentName}
                      </div>
                      <div className="text-xs text-[#6B7280] mt-0.5 tabular-nums">
                        <span className="font-mono text-[#0D47A1]">{rec.klasifikasiKode}</span> ·{' '}
                        {rec.jenisSurat === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'} · Dibuka oleh{' '}
                        {rec.userName} ({rec.userRole === 'admin' ? 'Admin' : 'Viewer'}) ·{' '}
                        {formatDateTime(rec.timestamp)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenDocumentById(rec.documentId)}
                      className="px-3 py-1.5 rounded-xl border border-[#CBD5E1] hover:bg-[#E8F1FF] text-[#0D47A1] text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      Buka Lagi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'downloaded' && (
          <div>
            <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
              <div className="text-xs font-semibold text-[#1F2937]">
                Riwayat Pengunduhan Dokumen
              </div>
              <Download className="w-4 h-4 text-[#43A047]" />
            </div>

            {downloaded.length === 0 ? (
              <div className="p-10 text-center">
                <Download className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                <div className="text-sm font-semibold text-[#1F2937]">
                  Belum ada riwayat pengunduhan
                </div>
                <p className="text-xs text-[#6B7280] mt-1">
                  Dokumen yang diunduh oleh Admin atau Viewer akan tercatat secara otomatis.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {downloaded.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-[#F8FAFC]"
                  >
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm text-[#1F2937] truncate">
                        {rec.documentName}
                      </div>
                      <div className="text-xs text-[#6B7280] mt-0.5 tabular-nums">
                        <span className="font-mono text-[#0D47A1]">{rec.klasifikasiKode}</span> ·{' '}
                        {rec.jenisSurat === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'} · Diunduh oleh{' '}
                        {rec.userName} ({rec.userRole === 'admin' ? 'Admin' : 'Viewer'}) ·{' '}
                        {formatBytes(rec.fileSize)} · {formatDateTime(rec.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.section>
    </div>
  );
};
