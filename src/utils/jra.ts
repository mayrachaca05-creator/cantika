import { ArchiveStatus, DisposalDecision, JraEvaluation } from '../types';
import { getClassificationByCode } from '../data/klasifikasiArsip';

export const TRASH_RETENTION_DAYS = 30;
export const STORAGE_CAPACITY_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

export function parseRetentionYears(label: string): number | null {
  const match = label.match(/(\d+)\s*Tahun/i);
  if (!match) {
    return null;
  }
  const years = Number.parseInt(match[1], 10);
  return Number.isFinite(years) ? years : null;
}

function addYearsIso(dateStr: string, years: number): string {
  const base = new Date(dateStr);
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString();
  }
  const copy = new Date(base.getTime());
  copy.setFullYear(copy.getFullYear() + years);
  return copy.toISOString();
}

export function evaluateJraStatus(params: {
  klasifikasiKode: string;
  tanggalSurat: string;
  status: ArchiveStatus;
  disposalDecision?: DisposalDecision;
  now?: Date;
}): JraEvaluation {
  const rule = getClassificationByCode(params.klasifikasiKode);
  const now = params.now ?? new Date();
  const suratDate = new Date(params.tanggalSurat);
  const validSuratDate = Number.isNaN(suratDate.getTime()) ? now : suratDate;

  const aktifYears = rule ? parseRetentionYears(rule.aktifLabel) : 1;
  const inaktifYears = rule ? parseRetentionYears(rule.inaktifLabel) : 2;

  const activeEndDateObj =
    aktifYears !== null
      ? new Date(new Date(validSuratDate.getTime()).setFullYear(validSuratDate.getFullYear() + aktifYears))
      : null;

  const inactiveEndDateObj =
    aktifYears !== null && inaktifYears !== null
      ? new Date(
          new Date(validSuratDate.getTime()).setFullYear(
            validSuratDate.getFullYear() + aktifYears + inaktifYears
          )
        )
      : inaktifYears !== null && params.status === 'inaktif'
        ? new Date(
            new Date(validSuratDate.getTime()).setFullYear(validSuratDate.getFullYear() + inaktifYears)
          )
        : null;

  const activeEndDate = activeEndDateObj ? activeEndDateObj.toISOString() : null;
  const inactiveEndDate = inactiveEndDateObj ? inactiveEndDateObj.toISOString() : null;

  // Check if inactive document has expired its JRA retention period -> Yellow + Disposal Alert
  if (params.status === 'inaktif') {
    const isExpired =
      inactiveEndDateObj !== null ? now.getTime() >= inactiveEndDateObj.getTime() : false;

    if (isExpired) {
      const alreadyDecided =
        params.disposalDecision === 'dimusnahkan' || params.disposalDecision === 'dipertahankan';
      return {
        status: 'inaktif',
        highlight: 'yellow',
        badgeLabel:
          params.disposalDecision === 'dipertahankan'
            ? 'Inaktif · Masa JRA Habis (Dipertahankan)'
            : 'Inaktif · Masa JRA Habis (Perlu Pemusnahan)',
        reason: rule
          ? `Masa retensi inaktif (${rule.inaktifLabel}) telah berakhir. Jadwal pemusnahan: ${rule.pemusnahanLabel}. Memerlukan konfirmasi petugas sebelum dimusnahkan.`
          : 'Masa retensi inaktif JRA telah berakhir dan menunggu konfirmasi pemusnahan.',
        aktifYears,
        inaktifYears,
        activeEndDate,
        inactiveEndDate,
        needsDisposalNotification: !alreadyDecided,
        enteredActiveJra: false,
      };
    }

    return {
      status: 'inaktif',
      highlight: 'neutral',
      badgeLabel: 'Inaktif · Dalam Masa Retensi',
      reason: rule
        ? `Arsip berstatus inaktif dengan retensi ${rule.inaktifLabel} (${rule.pemusnahanLabel}).`
        : 'Arsip berstatus inaktif dalam masa simpan.',
      aktifYears,
      inaktifYears,
      activeEndDate,
      inactiveEndDate,
      needsDisposalNotification: false,
      enteredActiveJra: false,
    };
  }

  // Status is 'aktif':
  // Automatically highlight GREEN when entering active JRA milestone (within 90 days before activeEndDate or past activeEndDate, or active period has started for time-bound JRA)
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const enteredActiveJra =
    activeEndDateObj !== null
      ? now.getTime() >= activeEndDateObj.getTime() - ninetyDaysMs
      : false;

  if (enteredActiveJra) {
    return {
      status: 'aktif',
      highlight: 'green',
      badgeLabel: 'Aktif · Memasuki Masa JRA',
      reason: rule
        ? `Surat aktif telah memasuki ambang batas masa JRA aktif (${rule.aktifLabel}). Siapkan peninjauan status menuju inaktif / retensi lanjutan.`
        : 'Surat aktif telah memasuki masa JRA.',
      aktifYears,
      inaktifYears,
      activeEndDate,
      inactiveEndDate,
      needsDisposalNotification: false,
      enteredActiveJra: true,
    };
  }

  return {
    status: 'aktif',
    highlight: 'neutral',
    badgeLabel: 'Aktif',
    reason: rule
      ? `Arsip aktif (${rule.aktifLabel}). Akan memasuki masa JRA aktif sesuai jadwal.`
      : 'Arsip berstatus aktif.',
    aktifYears,
    inaktifYears,
    activeEndDate,
    inactiveEndDate,
    needsDisposalNotification: false,
    enteredActiveJra: false,
  };
}

export function calculateTrashExpirationIso(deletedAtIso: string): string {
  const deletedDate = new Date(deletedAtIso);
  const expires = new Date(deletedDate.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return expires.toISOString();
}

export function calculateTrashRemainingDays(deletedAtIso: string, now = new Date()): number {
  const deletedTime = new Date(deletedAtIso).getTime();
  const expiresTime = deletedTime + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const diffMs = expiresTime - now.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function isTrashExpired(deletedAtIso: string, now = new Date()): boolean {
  const deletedTime = new Date(deletedAtIso).getTime();
  const expiresTime = deletedTime + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= expiresTime;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 10 || idx === 0 ? val.toFixed(0) : val.toFixed(2)} ${units[idx]}`;
}

export function computeNextYearIso(dateStr: string, years: number): string {
  return addYearsIso(dateStr, years);
}
