import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  Folder,
  FolderPlus,
  Inbox,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { KLASIFIKASI_TREE, getClassificationByCode } from '../data/klasifikasiArsip';
import {
  ArchiveDocument,
  ArchiveStatus,
  CustomFolder,
  DisposalDecision,
  MailType,
  UserRole,
} from '../types';
import { apiRequest, getAuthorizedFileUrl } from '../utils/api';
import { formatBytes } from '../utils/jra';
import { DocumentPreviewPane } from './DocumentPreviewPane';
import { UploadDocumentModal } from './UploadDocumentModal';

interface ArchivesViewProps {
  userRole: UserRole;
  documents: ArchiveDocument[];
  customFolders: CustomFolder[];
  sidebarMailFilter: MailType | 'all';
  selectedDocument: ArchiveDocument | null;
  onSelectDocument: (doc: ArchiveDocument | null) => void;
  onRefresh: () => void;
}

export const ArchivesView: React.FC<ArchivesViewProps> = ({
  userRole,
  documents,
  customFolders,
  sidebarMailFilter,
  selectedDocument,
  onSelectDocument,
  onRefresh,
}) => {
  const [level1Code, setLevel1Code] = useState<string | null>(null);
  const [level2Code, setLevel2Code] = useState<string | null>(null);
  const [level3Code, setLevel3Code] = useState<string | null>(null);
  const [leafMailType, setLeafMailType] = useState<MailType | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ArchiveStatus>('all');
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ArchiveDocument | null>(null);

  const isAdmin = userRole === 'admin';
  const effectiveMailFilter: MailType | null =
    leafMailType ?? (sidebarMailFilter === 'all' ? null : sidebarMailFilter);

  const currentL1 = KLASIFIKASI_TREE.find((l1) => l1.code === level1Code) ?? null;
  const currentL2 = currentL1?.groups.find((l2) => l2.code === level2Code) ?? null;
  const currentL3 = currentL2?.items.find((l3) => l3.code === level3Code) ?? null;

  // Is user drilled down to the final leaf folder (Level 3 + Surat Masuk / Surat Keluar)?
  const isAtFinalLeafFolder = Boolean(currentL3 && effectiveMailFilter);

  const leafCustomFolders = useMemo(() => {
    if (!currentL3 || !effectiveMailFilter) return [];
    return customFolders.filter(
      (f) =>
        f.classificationCode === currentL3.code &&
        f.mailType === effectiveMailFilter &&
        f.parentFolderId === activeFolderId
    );
  }, [customFolders, currentL3, effectiveMailFilter, activeFolderId]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (currentL3) {
        if (doc.klasifikasiKode !== currentL3.code) return false;
      } else if (currentL2) {
        if (!doc.klasifikasiKode.startsWith(`${currentL2.code}.`)) return false;
      } else if (currentL1) {
        if (!doc.klasifikasiKode.startsWith(`${currentL1.code}.`)) return false;
      }

      if (effectiveMailFilter && doc.jenisSurat !== effectiveMailFilter) {
        return false;
      }

      if (activeFolderId && doc.folderId !== activeFolderId) {
        return false;
      }

      if (statusFilter !== 'all' && doc.status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          doc.namaFile.toLowerCase().includes(q) ||
          doc.perihal.toLowerCase().includes(q) ||
          doc.klasifikasiKode.toLowerCase().includes(q) ||
          doc.perusahaanPengirim.toLowerCase().includes(q) ||
          doc.kepadaTujuan.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    documents,
    currentL1,
    currentL2,
    currentL3,
    effectiveMailFilter,
    activeFolderId,
    statusFilter,
    searchQuery,
  ]);

  const handleOpenPreview = async (doc: ArchiveDocument) => {
    onSelectDocument(doc);
    try {
      await apiRequest(`/api/archives/${doc.id}/log-open`, { method: 'POST' });
    } catch {
      // ignore logging errors
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentL3 || !effectiveMailFilter) return;
    setFolderError(null);
    try {
      await apiRequest('/api/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: newFolderName,
          classificationCode: currentL3.code,
          mailType: effectiveMailFilter,
          parentFolderId: activeFolderId,
        }),
      });
      setNewFolderName('');
      setShowNewFolderForm(false);
      onRefresh();
    } catch (err) {
      setFolderError((err as Error).message);
    }
  };

  const handleDeleteDoc = async (doc: ArchiveDocument) => {
    try {
      await apiRequest(`/api/archives/${doc.id}`, { method: 'DELETE' });
      if (selectedDocument?.id === doc.id) {
        onSelectDocument(null);
      }
      onRefresh();
    } catch {
      // ignore
    }
  };

  const handleChangeStatus = async (doc: ArchiveDocument, nextStatus: ArchiveStatus) => {
    try {
      const res = await apiRequest<{ document: ArchiveDocument }>(`/api/archives/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      onSelectDocument(res.document);
      onRefresh();
    } catch {
      // ignore
    }
  };

  const handleDisposalDecision = async (doc: ArchiveDocument, decision: DisposalDecision) => {
    try {
      const res = await apiRequest<{ document: ArchiveDocument }>(`/api/archives/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ disposalDecision: decision }),
      });
      if (decision === 'dimusnahkan') {
        onSelectDocument(null);
      } else {
        onSelectDocument(res.document);
      }
      onRefresh();
    } catch {
      // ignore
    }
  };

  const countDocsForPrefix = (prefix: string) =>
    documents.filter((d) => {
      const matchPrefix =
        d.klasifikasiKode === prefix || d.klasifikasiKode.startsWith(`${prefix}.`);
      const matchMail = effectiveMailFilter ? d.jenisSurat === effectiveMailFilter : true;
      return matchPrefix && matchMail;
    }).length;

  const activeCustomFolder = activeFolderId
    ? customFolders.find((f) => f.id === activeFolderId) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* Top Toolbar & Breadcrumb */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#CBD5E1] rounded-2xl p-5 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-[#1F2937]">
              Direktori Arsip Klasifikasi
              {effectiveMailFilter && (
                <span className="text-[#2E6BD6]">
                  {' '}
                  · {effectiveMailFilter === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}
                </span>
              )}
            </h1>
            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb folder arsip" className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-[#6B7280]">
              <button
                type="button"
                onClick={() => {
                  setLevel1Code(null);
                  setLevel2Code(null);
                  setLevel3Code(null);
                  setLeafMailType(null);
                  setActiveFolderId(null);
                }}
                className="font-semibold text-[#0D47A1] hover:underline"
              >
                Semua Klasifikasi
              </button>
              {currentL1 && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setLevel2Code(null);
                      setLevel3Code(null);
                      setLeafMailType(null);
                      setActiveFolderId(null);
                    }}
                    className="font-semibold text-[#0D47A1] hover:underline"
                  >
                    {currentL1.code} — {currentL1.name}
                  </button>
                </>
              )}
              {currentL2 && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setLevel3Code(null);
                      setLeafMailType(null);
                      setActiveFolderId(null);
                    }}
                    className="font-semibold text-[#0D47A1] hover:underline"
                  >
                    {currentL2.code} — {currentL2.name}
                  </button>
                </>
              )}
              {currentL3 && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setLeafMailType(null);
                      setActiveFolderId(null);
                    }}
                    className="font-semibold text-[#0D47A1] hover:underline"
                  >
                    {currentL3.code} — {currentL3.name}
                  </button>
                </>
              )}
              {currentL3 && leafMailType && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(null)}
                    className="font-semibold text-[#2E6BD6] hover:underline"
                  >
                    {leafMailType === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}
                  </button>
                </>
              )}
              {activeCustomFolder && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-semibold text-[#1F2937]">{activeCustomFolder.name}</span>
                </>
              )}
            </nav>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2.5 shrink-0">
              {isAtFinalLeafFolder && (
                <button
                  type="button"
                  onClick={() => setShowNewFolderForm((v) => !v)}
                  aria-label="Tambah folder baru"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#2E6BD6] text-[#0D47A1] hover:bg-[#E8F1FF] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Tambah Folder</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setEditingDoc(null);
                  setUploadModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Tambah File</span>
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter Strip */}
        <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari arsip, perihal, kode..."
              aria-label="Cari dokumen arsip"
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30"
            />
          </div>

          <select
            aria-label="Filter status arsip"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ArchiveStatus)}
            className="px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-xl focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="aktif">Surat Aktif</option>
            <option value="inaktif">Surat Inaktif</option>
          </select>
        </div>

        {/* Inline Add Folder Form (at final leaf folder) */}
        {isAdmin && isAtFinalLeafFolder && showNewFolderForm && (
          <form
            onSubmit={handleCreateFolder}
            className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-2.5"
          >
            <input
              type="text"
              required
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nama folder baru di dalam folder ini..."
              className="flex-1 min-w-[220px] px-3.5 py-2 text-xs border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#2E6BD6] hover:bg-[#0D47A1] text-white text-xs font-semibold"
            >
              Simpan Folder
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolderForm(false)}
              className="px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs font-semibold text-[#6B7280]"
            >
              Batal
            </button>
            {folderError && <span className="text-xs text-[#E63946]">{folderError}</span>}
          </form>
        )}
      </motion.section>

      {/* Folder Grid for Current Depth */}
      <section aria-label="Daftar Folder Klasifikasi" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* Depth 0: Level 1 */}
        {!currentL1 &&
          KLASIFIKASI_TREE.map((l1, idx) => (
            <motion.button
              key={l1.code}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
              onClick={() => setLevel1Code(l1.code)}
              className="text-left bg-white border border-[#CBD5E1] hover:border-[#2E6BD6] hover:bg-[#E8F1FF]/35 rounded-2xl p-4 transition-all group"
            >
              <div className="flex items-center justify-between">
                <Folder className="w-7 h-7 text-[#2E6BD6] group-hover:text-[#0D47A1]" />
                <span className="font-mono text-xs font-bold text-[#0D47A1] tabular-nums">
                  {countDocsForPrefix(l1.code)} file
                </span>
              </div>
              <div className="font-display font-bold text-sm text-[#1F2937] mt-3">
                {l1.code} · {l1.name}
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 tabular-nums">
                {l1.groups.length} sub-klasifikasi
              </div>
            </motion.button>
          ))}

        {/* Depth 1: Level 2 */}
        {currentL1 &&
          !currentL2 &&
          currentL1.groups.map((l2) => (
            <button
              key={l2.code}
              type="button"
              onClick={() => setLevel2Code(l2.code)}
              className="text-left bg-white border border-[#CBD5E1] hover:border-[#2E6BD6] hover:bg-[#E8F1FF]/35 rounded-2xl p-4 transition-all"
            >
              <div className="flex items-center justify-between">
                <Folder className="w-7 h-7 text-[#2E6BD6]" />
                <span className="font-mono text-xs font-bold text-[#0D47A1] tabular-nums">
                  {countDocsForPrefix(l2.code)} file
                </span>
              </div>
              <div className="font-display font-bold text-sm text-[#1F2937] mt-3">
                {l2.code} · {l2.name}
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 tabular-nums">
                {l2.items.length} jenis arsip
              </div>
            </button>
          ))}

        {/* Depth 2: Level 3 */}
        {currentL2 &&
          !currentL3 &&
          currentL2.items.map((l3) => (
            <button
              key={l3.code}
              type="button"
              onClick={() => setLevel3Code(l3.code)}
              className="text-left bg-white border border-[#CBD5E1] hover:border-[#2E6BD6] hover:bg-[#E8F1FF]/35 rounded-2xl p-4 transition-all"
            >
              <div className="flex items-center justify-between">
                <Folder className="w-7 h-7 text-[#2E6BD6]" />
                <span className="font-mono text-xs font-bold text-[#0D47A1] tabular-nums">
                  {countDocsForPrefix(l3.code)} file
                </span>
              </div>
              <div className="font-display font-bold text-sm text-[#1F2937] mt-3">
                {l3.code} · {l3.name}
              </div>
              <div className="text-[11px] text-[#6B7280] mt-1">
                JRA: {l3.aktifLabel} / {l3.inaktifLabel}
              </div>
            </button>
          ))}

        {/* Depth 3: Surat Masuk & Surat Keluar sub-folders inside Level 3 */}
        {currentL3 && !effectiveMailFilter && (
          <>
            <button
              type="button"
              onClick={() => setLeafMailType('masuk')}
              className="text-left bg-white border border-[#CBD5E1] hover:border-[#2E6BD6] hover:bg-[#E8F1FF]/35 rounded-2xl p-4 transition-all"
            >
              <div className="flex items-center justify-between">
                <Inbox className="w-7 h-7 text-[#43A047]" />
                <span className="font-mono text-xs font-bold text-[#0D47A1] tabular-nums">
                  {
                    documents.filter(
                      (d) => d.klasifikasiKode === currentL3.code && d.jenisSurat === 'masuk'
                    ).length
                  }{' '}
                  file
                </span>
              </div>
              <div className="font-display font-bold text-sm text-[#1F2937] mt-3">
                Surat Masuk
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">
                {currentL3.code} · {currentL3.name}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLeafMailType('keluar')}
              className="text-left bg-white border border-[#CBD5E1] hover:border-[#2E6BD6] hover:bg-[#E8F1FF]/35 rounded-2xl p-4 transition-all"
            >
              <div className="flex items-center justify-between">
                <Send className="w-7 h-7 text-[#2E6BD6]" />
                <span className="font-mono text-xs font-bold text-[#0D47A1] tabular-nums">
                  {
                    documents.filter(
                      (d) => d.klasifikasiKode === currentL3.code && d.jenisSurat === 'keluar'
                    ).length
                  }{' '}
                  file
                </span>
              </div>
              <div className="font-display font-bold text-sm text-[#1F2937] mt-3">
                Surat Keluar
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">
                {currentL3.code} · {currentL3.name}
              </div>
            </button>
          </>
        )}

        {/* Depth 4: Custom Sub-folders created inside the final leaf folder */}
        {isAtFinalLeafFolder &&
          leafCustomFolders.map((fld) => (
            <button
              key={fld.id}
              type="button"
              onClick={() => setActiveFolderId(fld.id)}
              className="text-left bg-white border border-[#CBD5E1] hover:border-[#2E6BD6] hover:bg-[#E8F1FF]/35 rounded-2xl p-4 transition-all"
            >
              <div className="flex items-center justify-between">
                <Folder className="w-7 h-7 text-[#F4C430]" />
                <span className="font-mono text-xs font-bold text-[#0D47A1] tabular-nums">
                  {documents.filter((d) => d.folderId === fld.id).length} file
                </span>
              </div>
              <div className="font-display font-bold text-sm text-[#1F2937] mt-3 truncate">
                {fld.name}
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Folder Tambahan</div>
            </button>
          ))}
      </section>

      {/* Main Split: Document List + Sticky Document Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-base text-[#1F2937]">
                Daftar Dokumen Arsip
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5 tabular-nums">
                {filteredDocuments.length} dokumen ditampilkan
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#43A047]" />
                <span>Aktif (Masa JRA)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#F4C430]" />
                <span>Inaktif (Habis JRA)</span>
              </span>
            </div>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="w-9 h-9 text-[#94A3B8] mx-auto mb-2.5" />
              <div className="text-sm font-semibold text-[#1F2937]">
                Belum ada dokumen di folder ini
              </div>
              <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                {isAdmin
                  ? 'Klik tombol "Tambah File" di atas untuk mengunggah arsip surat masuk atau surat keluar.'
                  : 'Belum ada dokumen yang tersedia untuk dilihat atau diunduh pada kategori ini.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {filteredDocuments.map((doc) => {
                const jraColor = doc.jra?.highlight ?? 'neutral';
                const isSelected = selectedDocument?.id === doc.id;
                const rule = getClassificationByCode(doc.klasifikasiKode);

                return (
                  <div
                    key={doc.id}
                    className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      jraColor === 'yellow'
                        ? 'bg-[#FEF9C3]/75 hover:bg-[#FEF9C3]'
                        : jraColor === 'green'
                          ? 'bg-[#DFF5E1]/75 hover:bg-[#DFF5E1]'
                          : isSelected
                            ? 'bg-[#E8F1FF]/60'
                            : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(doc)}
                      className="text-left min-w-0 flex-1"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#0D47A1]">
                        <span className="font-bold">{doc.klasifikasiKode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{doc.jenisSurat === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{doc.tanggalSurat}</span>
                      </div>
                      <div className="font-display font-bold text-sm text-[#1F2937] mt-1 truncate">
                        {doc.namaFile}
                      </div>
                      <div className="text-xs text-[#475569] mt-0.5 truncate">
                        Perihal: {doc.perihal} ·{' '}
                        {doc.jenisSurat === 'masuk'
                          ? `Dari: ${doc.perusahaanPengirim}`
                          : `Kepada: ${doc.kepadaTujuan}`}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`font-semibold ${
                            jraColor === 'yellow'
                              ? 'text-[#854D0E]'
                              : jraColor === 'green'
                                ? 'text-[#1B5E20]'
                                : 'text-[#6B7280]'
                          }`}
                        >
                          {doc.jra?.badgeLabel ?? doc.status}
                        </span>
                        {rule && (
                          <>
                            <span aria-hidden="true" className="text-[#94A3B8]">
                              ·
                            </span>
                            <span className="text-[#6B7280] tabular-nums">
                              {formatBytes(doc.fileSize)}
                            </span>
                          </>
                        )}
                      </div>
                    </button>

                    {/* Document Row Icons: Preview, Edit (Admin), Download, Delete (Admin) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(doc)}
                        aria-label={`Pratinjau ${doc.namaFile}`}
                        title="Lihat Pratinjau"
                        className="p-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#E8F1FF] text-[#0D47A1] transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <a
                        href={getAuthorizedFileUrl(`/api/archives/${doc.id}/download`)}
                        download={doc.originalFileName}
                        aria-label={`Unduh ${doc.namaFile}`}
                        title="Unduh Dokumen"
                        className="p-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#E8F1FF] text-[#0D47A1] transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDoc(doc);
                              setUploadModalOpen(true);
                            }}
                            aria-label={`Edit ${doc.namaFile}`}
                            title="Edit Dokumen"
                            className="p-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#E8F1FF] text-[#2E6BD6] transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            aria-label={`Hapus ${doc.namaFile}`}
                            title="Hapus Dokumen"
                            className="p-2 rounded-lg border border-[#FECACA] bg-white hover:bg-[#FEF2F2] text-[#E63946] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Preview Pane */}
        <div className="lg:col-span-5">
          <DocumentPreviewPane
            document={selectedDocument}
            userRole={userRole}
            onClose={() => onSelectDocument(null)}
            onEdit={(doc) => {
              setEditingDoc(doc);
              setUploadModalOpen(true);
            }}
            onDelete={handleDeleteDoc}
            onChangeStatus={handleChangeStatus}
            onDisposalDecision={handleDisposalDecision}
          />
        </div>
      </div>

      {uploadModalOpen && (
        <UploadDocumentModal
          open={uploadModalOpen}
          initialClassificationCode={currentL3?.code ?? 'KP.00.01'}
          initialMailType={effectiveMailFilter ?? 'masuk'}
          initialFolderId={activeFolderId}
          editingDoc={editingDoc}
          onClose={() => {
            setUploadModalOpen(false);
            setEditingDoc(null);
          }}
          onSaved={(savedDoc) => {
            onSelectDocument(savedDoc);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
