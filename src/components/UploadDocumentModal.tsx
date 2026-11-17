import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { KLASIFIKASI_ITEMS, getClassificationByCode } from '../data/klasifikasiArsip';
import { ArchiveDocument, ArchiveStatus, MailType } from '../types';
import { apiRequest } from '../utils/api';

interface UploadDocumentModalProps {
  open: boolean;
  initialClassificationCode: string;
  initialMailType: MailType;
  initialFolderId: string | null;
  editingDoc: ArchiveDocument | null;
  onClose: () => void;
  onSaved: (doc: ArchiveDocument) => void;
}

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  open,
  initialClassificationCode,
  initialMailType,
  initialFolderId,
  editingDoc,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(editingDoc);

  const [namaFile, setNamaFile] = useState(editingDoc?.namaFile ?? '');
  const [perihal, setPerihal] = useState(editingDoc?.perihal ?? '');
  const [tanggalSurat, setTanggalSurat] = useState(
    editingDoc?.tanggalSurat ?? new Date().toISOString().slice(0, 10)
  );
  const [jenisSurat, setJenisSurat] = useState<MailType>(
    editingDoc?.jenisSurat ?? initialMailType
  );
  const [klasifikasiKode, setKlasifikasiKode] = useState(
    editingDoc?.klasifikasiKode ?? initialClassificationCode
  );
  const [perusahaanPengirim, setPerusahaanPengirim] = useState(
    editingDoc?.perusahaanPengirim ?? ''
  );
  const [kepadaTujuan, setKepadaTujuan] = useState(editingDoc?.kepadaTujuan ?? '');
  const [status, setStatus] = useState<ArchiveStatus>(editingDoc?.status ?? 'aktif');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const selectedRule = getClassificationByCode(klasifikasiKode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isEditing && editingDoc) {
        const res = await apiRequest<{ document: ArchiveDocument }>(
          `/api/archives/${editingDoc.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              namaFile,
              perihal,
              tanggalSurat,
              perusahaanPengirim,
              kepadaTujuan,
              status,
            }),
          }
        );
        onSaved(res.document);
        onClose();
      } else {
        if (!file) {
          setError('Pilih berkas dokumen terlebih dahulu.');
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('namaFile', namaFile);
        formData.append('perihal', perihal);
        formData.append('tanggalSurat', tanggalSurat);
        formData.append('jenisSurat', jenisSurat);
        formData.append('klasifikasiKode', klasifikasiKode);
        if (initialFolderId) formData.append('folderId', initialFolderId);
        if (jenisSurat === 'masuk') {
          formData.append('perusahaanPengirim', perusahaanPengirim);
        } else {
          formData.append('kepadaTujuan', kepadaTujuan);
        }
        formData.append('status', status);

        const res = await apiRequest<{ document: ArchiveDocument }>('/api/archives', {
          method: 'POST',
          body: formData,
        });
        onSaved(res.document);
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-white border border-[#CBD5E1] rounded-2xl shadow-xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 id="upload-modal-title" className="font-display text-lg font-bold text-[#1F2937]">
            {isEditing ? 'Edit Data Dokumen Arsip' : 'Tambah Dokumen Arsip'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form dokumen"
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F1F5F9]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#B91C1C]">
              {error}
            </div>
          )}

          {!isEditing && (
            <div>
              <label htmlFor="doc-file-input" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Unggah Berkas (PDF, Gambar, Dokumen)
              </label>
              <label
                htmlFor="doc-file-input"
                className="flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed border-[#2E6BD6] bg-[#F8FAFC] hover:bg-[#E8F1FF]/50 cursor-pointer transition-colors"
              >
                <Upload className="w-5 h-5 text-[#0D47A1]" />
                <span className="text-xs font-medium text-[#1F2937] truncate">
                  {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Klik untuk memilih berkas arsip'}
                </span>
                <input
                  id="doc-file-input"
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f && !namaFile) {
                      setNamaFile(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="doc-nama" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Nama File
              </label>
              <input
                id="doc-nama"
                type="text"
                required
                value={namaFile}
                onChange={(e) => setNamaFile(e.target.value)}
                placeholder="Contoh: Surat Lamaran Kerja 2026"
                className="w-full px-3.5 py-2 text-sm border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
              />
            </div>

            <div>
              <label htmlFor="doc-tanggal" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Tanggal Surat
              </label>
              <input
                id="doc-tanggal"
                type="date"
                required
                value={tanggalSurat}
                onChange={(e) => setTanggalSurat(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="doc-perihal" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
              Perihal
            </label>
            <input
              id="doc-perihal"
              type="text"
              required
              value={perihal}
              onChange={(e) => setPerihal(e.target.value)}
              placeholder="Contoh: Permohonan Kerja Sama Pengadaan"
              className="w-full px-3.5 py-2 text-sm border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="doc-jenis" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Jenis Surat
              </label>
              <select
                id="doc-jenis"
                disabled={isEditing}
                value={jenisSurat}
                onChange={(e) => setJenisSurat(e.target.value as MailType)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6] disabled:bg-[#F1F5F9]"
              >
                <option value="masuk">Surat Masuk</option>
                <option value="keluar">Surat Keluar</option>
              </select>
            </div>

            <div>
              <label htmlFor="doc-status" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Status Arsip
              </label>
              <select
                id="doc-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ArchiveStatus)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
              >
                <option value="aktif">Surat Aktif</option>
                <option value="inaktif">Surat Inaktif</option>
              </select>
            </div>
          </div>

          {jenisSurat === 'masuk' ? (
            <div>
              <label htmlFor="doc-pengirim" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Perusahaan / Pengirim Surat Masuk
              </label>
              <input
                id="doc-pengirim"
                type="text"
                required
                value={perusahaanPengirim}
                onChange={(e) => setPerusahaanPengirim(e.target.value)}
                placeholder="Nama perusahaan atau instansi pengirim"
                className="w-full px-3.5 py-2 text-sm border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="doc-tujuan" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Kepada / Tujuan & Pengirim Surat Keluar
              </label>
              <input
                id="doc-tujuan"
                type="text"
                required
                value={kepadaTujuan}
                onChange={(e) => setKepadaTujuan(e.target.value)}
                placeholder="Contoh: PT Nusantara Jaya (Dikirim oleh: Divisi Umum)"
                className="w-full px-3.5 py-2 text-sm border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
              />
            </div>
          )}

          <div>
            <label htmlFor="doc-klasifikasi" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
              Klasifikasi Arsip & Jadwal Retensi Arsip (JRA)
            </label>
            <select
              id="doc-klasifikasi"
              disabled={isEditing}
              value={klasifikasiKode}
              onChange={(e) => setKlasifikasiKode(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6] disabled:bg-[#F1F5F9]"
            >
              {KLASIFIKASI_ITEMS.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} — {item.name} ({item.level1Name})
                </option>
              ))}
            </select>
            {selectedRule && (
              <div className="mt-2 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#475569] flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Aktif: <strong className="text-[#1F2937]">{selectedRule.aktifLabel}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Inaktif: <strong className="text-[#1F2937]">{selectedRule.inaktifLabel}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Pemusnahan: <strong className="text-[#0D47A1]">{selectedRule.pemusnahanLabel}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-xs font-semibold text-[#1F2937] hover:bg-[#F1F5F9]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] disabled:opacity-60 text-white text-xs font-semibold"
            >
              {submitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Unggah Arsip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
