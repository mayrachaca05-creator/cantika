import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FolderArchive,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { UserPublic, UserRole } from '../types';
import { apiRequest, setStoredToken } from '../utils/api';
import { SipersipLogo } from './SipersipLogo';

interface PreviewEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  code: string;
  type: 'verify' | 'reset';
  createdAt: string;
}

interface AuthViewProps {
  onAuthenticated: (user: UserPublic) => void;
}

type AuthScreen = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated }) => {
  const [screen, setScreen] = useState<AuthScreen>('login');
  const [role, setRole] = useState<UserRole>('admin');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleAccessCode, setRoleAccessCode] = useState('');

  // Verification & reset states
  const [verifyCode, setVerifyCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [previewEmail, setPreviewEmail] = useState<PreviewEmail | null>(null);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showRoleCode, setShowRoleCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ user: UserPublic; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, role, roleAccessCode }),
      });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      const eObj = err as Error & { payload?: { requiresVerification?: boolean; email?: string; previewEmail?: PreviewEmail } };
      if (eObj.payload?.requiresVerification) {
        setPreviewEmail(eObj.payload.previewEmail ?? null);
        setScreen('verify-email');
        setNotice('Email Anda belum terkonfirmasi. Silakan selesaikan konfirmasi email di bawah ini.');
      } else {
        setError(eObj.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{
        requiresVerification: boolean;
        email: string;
        previewEmail: PreviewEmail;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          confirmPassword,
          role,
          roleAccessCode,
        }),
      });
      setPreviewEmail(res.previewEmail);
      setVerifyCode('');
      setScreen('verify-email');
      setNotice('Pesan konfirmasi telah dikirim ke email Anda. Konfirmasi kode email untuk masuk ke SIPERSIP.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (codeOverride?: string) => {
    resetMessages();
    const codeToSend = (codeOverride ?? verifyCode).trim();
    if (!codeToSend) {
      setError('Masukkan kode konfirmasi dari pesan email.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ user: UserPublic; token: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code: codeToSend }),
      });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ previewEmail: PreviewEmail }>('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setPreviewEmail(res.previewEmail);
      setNotice('Kode konfirmasi email baru telah dikirim.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ previewEmail: PreviewEmail }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setPreviewEmail(res.previewEmail);
      setResetCode('');
      setScreen('reset-password');
      setNotice('Pesan reset password telah dikirim ke email Anda.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          code: resetCode,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetCode('');
      setPreviewEmail(null);
      setScreen('login');
      setNotice(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Left Brand Showcase Column */}
      <motion.section
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="lg:w-[46%] bg-[#0D47A1] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-[#2E6BD6]/35 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -left-16 bottom-12 w-64 h-64 rounded-full bg-[#A7C5F9]/15 pointer-events-none"
        />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5">
            <FolderArchive className="w-5 h-5 text-[#A7C5F9]" />
            <span className="font-display font-bold tracking-tight text-lg">SIPERSIP</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-10 leading-tight max-w-md [text-wrap:balance]">
            Kelola Arsip dengan Mudah, Lebih Teratur.
          </h1>
          <p className="mt-4 text-[#E8F1FF]/85 text-base leading-relaxed max-w-md">
            Sistem Penyimpanan Arsip Digital terintegrasi klasifikasi arsip surat masuk dan surat keluar dengan pemantauan Jadwal Retensi Arsip (JRA) otomatis.
          </p>
        </div>

        <div className="relative z-10 mt-10 pt-8 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <div className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="w-4 h-4 text-[#A7C5F9]" />
              <span>Akses Terpisah Admin & Viewer</span>
            </div>
            <p className="text-[#E8F1FF]/75 mt-1 text-xs leading-relaxed">
              Setiap peran dilindungi kode akses khusus dan verifikasi email resmi.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-white">
              <CheckCircle2 className="w-4 h-4 text-[#A7C5F9]" />
              <span>Retensi JRA & Kapasitas 100 GB</span>
            </div>
            <p className="text-[#E8F1FF]/75 mt-1 text-xs leading-relaxed">
              Notifikasi otomatis masa aktif, inaktif, dan konfirmasi pemusnahan arsip.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Right Authentication Form Panel */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-white border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <SipersipLogo />
            {(screen === 'login' || screen === 'register') && (
              <div className="inline-flex p-1 bg-[#F1F5F9] rounded-lg border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setScreen('login');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    screen === 'login'
                      ? 'bg-white text-[#0D47A1] shadow-xs'
                      : 'text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setScreen('register');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    screen === 'register'
                      ? 'bg-white text-[#0D47A1] shadow-xs'
                      : 'text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                >
                  Daftar
                </button>
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-medium"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-4 p-3.5 rounded-xl bg-[#E8F1FF] border border-[#A7C5F9] text-[#0D47A1] text-xs font-medium"
            >
              {notice}
            </div>
          )}

          <AnimatePresence mode="wait">
            {(screen === 'login' || screen === 'register') && (
              <motion.div
                key={screen}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="font-display text-xl font-bold text-[#1F2937]">
                  {screen === 'login' ? 'Masuk ke SIPERSIP' : 'Daftar Akun Baru'}
                </h2>
                <p className="text-xs text-[#6B7280] mt-1 mb-5">
                  {screen === 'login'
                    ? 'Pilih peran akses Anda lalu masukkan kredensial akun dan password khusus peran.'
                    : 'Lengkapi data diri Anda, pilih opsi Admin atau Viewer, dan konfirmasi melalui pesan email.'}
                </p>

                {/* Role Selector */}
                <div className="mb-5">
                  <span className="block text-xs font-semibold text-[#1F2937] mb-2">
                    Pilih Opsi Peran Pengguna
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        role === 'admin'
                          ? 'bg-[#E8F1FF] border-[#2E6BD6] text-[#0D47A1]'
                          : 'bg-white border-[#CBD5E1] text-[#6B7280] hover:border-[#94A3B8]'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Admin</span>
                      </div>
                      <p className="text-[11px] mt-1 opacity-80">
                        Unggah, edit, kelola, dan hapus arsip
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('viewer')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        role === 'viewer'
                          ? 'bg-[#E8F1FF] border-[#2E6BD6] text-[#0D47A1]'
                          : 'bg-white border-[#CBD5E1] text-[#6B7280] hover:border-[#94A3B8]'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <UserCheck className="w-4 h-4 shrink-0" />
                        <span>Viewer</span>
                      </div>
                      <p className="text-[11px] mt-1 opacity-80">
                        Melihat pratinjau dan mengunduh arsip
                      </p>
                    </button>
                  </div>
                </div>

                <form onSubmit={screen === 'login' ? handleLogin : handleRegister} className="space-y-4">
                  {screen === 'register' && (
                    <div>
                      <label htmlFor="auth-fullname" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                        Nama Lengkap
                      </label>
                      <input
                        id="auth-fullname"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Contoh: Siti Rahmawati"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                      Email
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@instansi.go.id"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                    />
                  </div>

                  <div>
                    <label htmlFor="auth-role-code" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                      {role === 'admin' ? 'Password Khusus Admin' : 'Password Khusus Viewer'}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-role-code"
                        type={showRoleCode ? 'text' : 'password'}
                        required
                        value={roleAccessCode}
                        onChange={(e) => setRoleAccessCode(e.target.value)}
                        placeholder={
                          role === 'admin'
                            ? 'Masukkan kode akses Admin'
                            : 'Masukkan kode akses Viewer'
                        }
                        className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                      />
                      <button
                        type="button"
                        aria-label={showRoleCode ? 'Sembunyikan kode peran' : 'Tampilkan kode peran'}
                        onClick={() => setShowRoleCode((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2937]"
                      >
                        {showRoleCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="auth-password" className="block text-xs font-semibold text-[#1F2937]">
                        Password Akun
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          resetMessages();
                          setScreen('forgot-password');
                        }}
                        className="text-xs font-semibold text-[#2E6BD6] hover:text-[#0D47A1]"
                      >
                        Lupa Password / Reset Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2937]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {screen === 'register' && (
                    <div>
                      <label htmlFor="auth-confirm-password" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                        Konfirmasi Password Akun
                      </label>
                      <input
                        id="auth-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password akun Anda"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <span>
                      {loading
                        ? 'Memproses...'
                        : screen === 'login'
                          ? `Masuk sebagai ${role === 'admin' ? 'Admin' : 'Viewer'}`
                          : 'Daftar & Kirim Konfirmasi Email'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {screen === 'register' && (
                  <p className="mt-4 text-[11px] text-[#6B7280] leading-relaxed">
                    Lupa password akun Anda? Klik{' '}
                    <button
                      type="button"
                      onClick={() => {
                        resetMessages();
                        setScreen('forgot-password');
                      }}
                      className="text-[#2E6BD6] font-semibold hover:underline"
                    >
                      Reset Password
                    </button>{' '}
                    untuk membuat ulang dan mengkonfirmasi ulang password baru Anda.
                  </p>
                )}
              </motion.div>
            )}

            {screen === 'verify-email' && (
              <motion.div
                key="verify-email"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F1FF] text-[#0D47A1] flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#1F2937]">
                      Konfirmasi Pesan Email
                    </h2>
                    <p className="text-xs text-[#6B7280]">
                      Dikirim ke <span className="font-medium text-[#1F2937]">{email}</span>
                    </p>
                  </div>
                </div>

                {previewEmail && (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                      <span>Dari: no-reply@sipersip.id</span>
                      <span>Kotak Masuk Verifikasi</span>
                    </div>
                    <div className="text-xs font-semibold text-[#0D47A1]">
                      {previewEmail.subject}
                    </div>
                    <p className="text-xs text-[#1F2937] leading-relaxed">
                      {previewEmail.body}
                    </p>
                    <div className="pt-2 flex items-center justify-between border-t border-[#E2E8F0]">
                      <span className="font-mono text-sm font-bold tracking-widest text-[#0D47A1] tabular-nums">
                        {previewEmail.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyCode(previewEmail.code);
                          handleVerifyEmail(previewEmail.code);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#43A047] hover:bg-[#388E3C] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        Konfirmasi dari Email
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="verify-code-input" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                    Masukkan Kode Konfirmasi 6 Digit
                  </label>
                  <input
                    id="verify-code-input"
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="Contoh: 123456"
                    className="w-full px-3.5 py-2.5 text-sm font-mono tracking-widest bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleVerifyEmail()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] text-white font-semibold text-sm transition-colors"
                  >
                    {loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleResendVerification}
                    className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-semibold text-[#1F2937] hover:bg-[#F1F5F9] whitespace-nowrap"
                  >
                    Kirim Ulang
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setScreen('register');
                  }}
                  className="text-xs font-medium text-[#6B7280] hover:text-[#1F2937]"
                >
                  Kembali ke halaman daftar
                </button>
              </motion.div>
            )}

            {screen === 'forgot-password' && (
              <motion.form
                key="forgot-password"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleForgotPassword}
                className="space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F1FF] text-[#0D47A1] flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#1F2937]">Lupa Password</h2>
                    <p className="text-xs text-[#6B7280]">
                      Masukkan email terdaftar untuk menerima kode reset password.
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                    Email Terdaftar
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@instansi.go.id"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] text-white font-semibold text-sm transition-colors"
                >
                  {loading ? 'Mengirim...' : 'Kirim Kode Reset Password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setScreen('login');
                  }}
                  className="text-xs font-medium text-[#6B7280] hover:text-[#1F2937]"
                >
                  Kembali ke halaman masuk
                </button>
              </motion.form>
            )}

            {screen === 'reset-password' && (
              <motion.form
                key="reset-password"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleResetPassword}
                className="space-y-4"
              >
                <h2 className="font-display text-lg font-bold text-[#1F2937]">
                  Buat Ulang Password
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Masukkan kode dari email reset password, lalu buat dan konfirmasi ulang password baru Anda.
                </p>

                {previewEmail && previewEmail.type === 'reset' && (
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs space-y-1">
                    <div className="font-semibold text-[#0D47A1]">{previewEmail.subject}</div>
                    <p className="text-[#1F2937]">{previewEmail.body}</p>
                    <button
                      type="button"
                      onClick={() => setResetCode(previewEmail.code)}
                      className="text-xs font-semibold text-[#2E6BD6] hover:underline pt-1"
                    >
                      Salin kode: <span className="font-mono">{previewEmail.code}</span>
                    </button>
                  </div>
                )}

                <div>
                  <label htmlFor="reset-code" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                    Kode Verifikasi Reset
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Kode 6 digit dari email"
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                  />
                </div>

                <div>
                  <label htmlFor="reset-new-password" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                    Password Baru
                  </label>
                  <input
                    id="reset-new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                  />
                </div>

                <div>
                  <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                    Konfirmasi Ulang Password Baru
                  </label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6BD6]/30 focus:border-[#2E6BD6]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0D47A1] hover:bg-[#2E6BD6] text-white font-semibold text-sm transition-colors"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};
