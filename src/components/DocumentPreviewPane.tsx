import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { getClassificationByCode } from '../data/klasifikasiArsip';
import { ArchiveDocument, ArchiveStatus, DisposalDecision, UserRole } from '../types';
import { getAuthorizedFileUrl } from '../utils/api';
import { formatBytes } from '../utils/jra';

interface DocumentPreviewPaneProps {
  document: ArchiveDocument | null;
  userRole: UserRole;
  onClose: () => void;
  onEdit: (doc: ArchiveDocument) => void;
  onDelete: (doc: ArchiveDocument) => void;
  onChangeStatus: (doc: ArchiveDocument, nextStatus: ArchiveStatus) => void;
  onDisposalDecision: (doc: ArchiveDocument, decision: DisposalDecision) => void;
}

export const DocumentPreviewPane: React.FC<DocumentPreviewPaneProps> = ({
  document: doc,
  userRole,
  onClose,
  onEdit,
  onDelete,
  onChangeStatus,
  onDisposalDecision,
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    setTextContent(null);
    if (!doc) return;
    if (doc.mimeType.startsWith('text/') || doc.originalFileName.endsWith('.txt') || doc.originalFileName.endsWith('.csv')) {
      fetch(getAuthorizedFileUrl(`/api/archives/${doc.id}/preview`))
        .then((r) => (r.ok ? r.text() : null))
        .then((txt) => {
          if (txt !== null) setTextContent(txt.slice(0, 8000));
        })
        .catch(() => {});
    }
  }, [doc?.id]);

  if (!doc) {
    return (
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 text-center lg:sticky lg:top-20">
        <FileText className="w-9 h-9 text-[#94A3B8] mx-auto mb-3" />
        <div className="font-display font-bold text-sm text-[#1F2937]">
          Pratinjau Dokumen Arsip
        </div>
        <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
          Pilih salah satu dokumen pada daftar di samping untuk melihat isi berkas, detail surat, serta jadwal retensi (JRA).
        </p>
      </div>
    );
  }

  const rule = getClassificationByCode(doc.klasifikasiKode);
  const previewUrl = getAuthorizedFileUrl(`/api/archives/${doc.id}/preview`);
  const downloadUrl = getAuthorizedFileUrl(`/api/archives/${doc.id}/download`);
  const isPdf = doc.mimeType.includes('pdf') || doc.originalFileName.toLowerCase().endsWith('.pdf');
  const isImage = doc.mimeType.startsWith('image/');
  const isAdmin = userRole === 'admin';

  const jraHighlight = doc.jra?.highlight ?? 'neutral';

  return (
    <aside
      aria-label="Pratinjau dokumen"
      className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden lg:sticky lg:top-20"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#0D47A1] font-semibold">
            <span>{doc.klasifikasiKode}</span>
            <span aria-hidden="true">·</span>
            <span>{doc.jenisSurat === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}</span>
          </div>
          <h3 className="font-display font-bold text-base text-[#1F2937] mt-0.5 truncate">
            {doc.namaFile}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pratinjau dokumen"
          className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F1F5F9]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Automatic JRA Status Banner (Green for Active entering JRA, Yellow for Inactive expired JRA) */}
      {doc.jra && (
        <div
          className={`px-5 py-3.5 border-b text-xs ${
            jraHighlight === 'yellow'
              ? 'bg-[#FEF9C3] border-[#F4C430] text-[#713F12]'
              : jraHighlight === 'green'
                ? 'bg-[#DFF5E1] border-[#43A047] text-[#1B5E20]'
                : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {jraHighlight === 'yellow' ? (
              <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
            ) : jraHighlight === 'green' ? (
              <CheckCircle2 className="w-4 h-4 text-[#43A047] shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-[#2E6BD6] shrink-0" />
            )}
            <span>{doc.jra.badgeLabel}</span>
          </div>
          <p className="mt-1 leading-relaxed text-[11px]">{doc.jra.reason}</p>

          {/* Disposal Confirmation Controls (never auto-deleted) */}
          {doc.jra.needsDisposalNotification && isAdmin && (
            <div className="mt-3 pt-2.5 border-t border-[#F4C430]/50 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onDisposalDecision(doc, 'dimusnahkan')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E63946] hover:bg-[#C62828] text-white text-[11px] font-semibold transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Konfirmasi Pemusnahan Arsip</span>
              </button>
              <button
                type="button"
                onClick={() => onDisposalDecision(doc, 'dipertahankan')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#1F2937] text-[11px] font-semibold transition-colors"
              >
                <span>Pertahankan Arsip</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Visual Document Preview Area */}
      <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        {isPdf ? (
          <iframe
            title={`Pratinjau ${doc.namaFile}`}
            src={previewUrl}
            className="w-full h-72 rounded-xl border border-[#CBD5E1] bg-white"
          />
        ) : isImage ? (
          <div className="rounded-xl border border-[#CBD5E1] bg-white overflow-hidden flex items-center justify-center p-2">
            <img
              src={previewUrl}
              alt={doc.namaFile}
              referrerPolicy="no-referrer"
              className="max-h-72 object-contain rounded-lg"
            />
          </div>
        ) : textContent !== null ? (
          <pre className="w-full h-60 overflow-auto p-3.5 rounded-xl border border-[#CBD5E1] bg-white text-xs font-mono text-[#1F2937] whitespace-pre-wrap">
            {textContent}
          </pre>
        ) : (
          <div className="p-6 rounded-xl border border-[#CBD5E1] bg-white text-center">
            <FileText className="w-8 h-8 text-[#2E6BD6] mx-auto mb-2" />
            <div className="text-xs font-semibold text-[#1F2937]">{doc.originalFileName}</div>
            <div className="text-[11px] text-[#6B7280] mt-1 tabular-nums">
              {formatBytes(doc.fileSize)} · {doc.mimeType}
            </div>
          </div>
        )}
      </div>

      {/* Metadata Details */}
      <div className="p-5 space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] text-[#6B7280]">Perihal</div>
            <div className="font-semibold text-[#1F2937] mt-0.5">{doc.perihal}</div>
          </div>
          <div>
            <div className="text-[11px] text-[#6B7280]">Tanggal Surat</div>
            <div className="font-mono font-semibold text-[#1F2937] mt-0.5 tabular-nums">
              {doc.tanggalSurat}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#6B7280]">
              {doc.jenisSurat === 'masuk' ? 'Perusahaan / Pengirim' : 'Kepada / Tujuan'}
            </div>
            <div className="font-semibold text-[#1F2937] mt-0.5">
              {doc.jenisSurat === 'masuk' ? doc.perusahaanPengirim : doc.kepadaTujuan}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#6B7280]">Klasifikasi & JRA</div>
            <div className="font-semibold text-[#1F2937] mt-0.5">
              {rule ? `${rule.aktifLabel} Aktif / ${rule.inaktifLabel} Inaktif` : doc.klasifikasiKode}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-2">
          <a
            href={downloadUrl}
            download={doc.originalFileName}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] text-white text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh</span>
          </a>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() =>
                  onChangeStatus(doc, doc.status === 'aktif' ? 'inaktif' : 'aktif')
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#1F2937] text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  Ubah ke {doc.status === 'aktif' ? 'Inaktif' : 'Aktif'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onEdit(doc)}
                aria-label={`Edit ${doc.namaFile}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#CBD5E1] hover:bg-[#E8F1FF] text-[#0D47A1] text-xs font-semibold transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(doc)}
                aria-label={`Hapus ${doc.namaFile}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#FECACA] hover:bg-[#FEF2F2] text-[#E63946] text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
