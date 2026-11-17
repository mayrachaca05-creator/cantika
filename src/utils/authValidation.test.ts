import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRolePermissions,
  validateRegistrationInput,
  validateResetPasswordInput,
} from './authValidation';

test('viewer permissions restrict edit, delete, upload, and folder creation', () => {
  const viewer = getRolePermissions('viewer');
  assert.equal(viewer.canView, true);
  assert.equal(viewer.canDownload, true);
  assert.equal(viewer.canUpload, false);
  assert.equal(viewer.canEdit, false);
  assert.equal(viewer.canDelete, false);
  assert.equal(viewer.canCreateFolder, false);
  assert.equal(viewer.canManageDisposal, false);
});

test('admin permissions grant full archive lifecycle access', () => {
  const admin = getRolePermissions('admin');
  assert.equal(admin.canView, true);
  assert.equal(admin.canDownload, true);
  assert.equal(admin.canUpload, true);
  assert.equal(admin.canEdit, true);
  assert.equal(admin.canDelete, true);
  assert.equal(admin.canCreateFolder, true);
  assert.equal(admin.canManageDisposal, true);
});

test('registration validation catches mismatched passwords and invalid email', () => {
  const badEmail = validateRegistrationInput({
    fullName: 'Budi Santoso',
    email: 'not-an-email',
    password: 'password123',
    confirmPassword: 'password123',
    role: 'admin',
    roleAccessCode: 'secret',
  });
  assert.ok(badEmail);

  const mismatch = validateRegistrationInput({
    fullName: 'Budi Santoso',
    email: 'budi@example.com',
    password: 'password123',
    confirmPassword: 'password999',
    role: 'viewer',
    roleAccessCode: 'secret',
  });
  assert.ok(mismatch);

  const valid = validateRegistrationInput({
    fullName: 'Budi Santoso',
    email: 'budi@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    role: 'admin',
    roleAccessCode: 'secret',
  });
  assert.equal(valid, null);
});

test('reset password validation enforces minimum length and matching confirmation', () => {
  assert.ok(validateResetPasswordInput({ newPassword: '123', confirmPassword: '123' }));
  assert.ok(
    validateResetPasswordInput({ newPassword: 'newpassword', confirmPassword: 'different' })
  );
  assert.equal(
    validateResetPasswordInput({ newPassword: 'newpassword', confirmPassword: 'newpassword' }),
    null
  );
});
