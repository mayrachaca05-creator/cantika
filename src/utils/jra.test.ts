import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTrashRemainingDays,
  evaluateJraStatus,
  formatBytes,
  isTrashExpired,
  parseRetentionYears,
  STORAGE_CAPACITY_BYTES,
} from './jra';

test('parseRetentionYears parses numeric retention periods and returns null for permanent/tenure strings', () => {
  assert.equal(parseRetentionYears('1 Tahun'), 1);
  assert.equal(parseRetentionYears('8 Tahun'), 8);
  assert.equal(parseRetentionYears('10 Tahun setelah berakhir'), 10);
  assert.equal(parseRetentionYears('Selama Bekerja'), null);
  assert.equal(parseRetentionYears('Selama kepemilikan'), null);
});

test('evaluateJraStatus highlights active letter green when entering active JRA window', () => {
  // KP.00.01 has Aktif: 1 Tahun, Inaktif: 2 Tahun
  const result = evaluateJraStatus({
    klasifikasiKode: 'KP.00.01',
    tanggalSurat: '2025-11-01',
    status: 'aktif',
    now: new Date('2026-11-16T00:00:00Z'),
  });
  assert.equal(result.highlight, 'green');
  assert.equal(result.enteredActiveJra, true);
  assert.equal(result.needsDisposalNotification, false);
});

test('evaluateJraStatus keeps recent active letter neutral before JRA window', () => {
  const result = evaluateJraStatus({
    klasifikasiKode: 'KU.00.01', // Aktif: 2 Tahun
    tanggalSurat: '2026-10-01',
    status: 'aktif',
    now: new Date('2026-11-16T00:00:00Z'),
  });
  assert.equal(result.highlight, 'neutral');
  assert.equal(result.enteredActiveJra, false);
});

test('evaluateJraStatus highlights inactive letter yellow and triggers disposal notification when JRA expires', () => {
  // KP.00.01 has Aktif: 1 Tahun + Inaktif: 2 Tahun = 3 Tahun total
  const result = evaluateJraStatus({
    klasifikasiKode: 'KP.00.01',
    tanggalSurat: '2022-01-15',
    status: 'inaktif',
    now: new Date('2026-11-16T00:00:00Z'),
  });
  assert.equal(result.highlight, 'yellow');
  assert.equal(result.needsDisposalNotification, true);
});

test('evaluateJraStatus suppresses pending disposal notification once user decides dipertahankan', () => {
  const result = evaluateJraStatus({
    klasifikasiKode: 'KP.00.01',
    tanggalSurat: '2022-01-15',
    status: 'inaktif',
    disposalDecision: 'dipertahankan',
    now: new Date('2026-11-16T00:00:00Z'),
  });
  assert.equal(result.highlight, 'yellow');
  assert.equal(result.needsDisposalNotification, false);
});

test('30-day trash retention expires at exactly 30 days', () => {
  const deletedAt = '2026-10-01T00:00:00.000Z';
  assert.equal(calculateTrashRemainingDays(deletedAt, new Date('2026-10-20T00:00:00.000Z')), 11);
  assert.equal(isTrashExpired(deletedAt, new Date('2026-10-20T00:00:00.000Z')), false);
  assert.equal(isTrashExpired(deletedAt, new Date('2026-10-31T00:00:00.000Z')), true);
});

test('storage capacity is 100 GB and formats cleanly', () => {
  assert.equal(STORAGE_CAPACITY_BYTES, 100 * 1024 * 1024 * 1024);
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024 * 1024), '1.00 MB');
});
