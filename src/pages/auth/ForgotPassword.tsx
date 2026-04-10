import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  requestPasswordReset,
  verifyCode,
  verifyCodeAndResetPassword,
} from '../../services/passwordResetService';
import {
  showError,
  showLoading,
  hideLoading,
  showSuccess,
} from '../../services/notificationService';
import { HiMail, HiKey, HiLockClosed, HiArrowLeft } from 'react-icons/hi';
import loginUserBg from '../../assets/login_user_bg.jpg';
import maktabaLogo from '../../assets/maktaba-logo.png';

const CODE_EXPIRY_SECONDS = 3 * 60; // 3 dakika

type Step = 'email' | 'code' | 'password' | 'success';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayedCode, setDisplayedCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(CODE_EXPIRY_SECONDS);
  const countdownStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (step !== 'code') return;
    if (countdownStartedAt.current === null) {
      countdownStartedAt.current = Date.now();
    }
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (countdownStartedAt.current ?? 0)) / 1000);
      const remaining = Math.max(0, CODE_EXPIRY_SECONDS - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        navigate('/', { replace: true });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [step, navigate]);

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      await showError('Lütfen email adresinizi girin.');
      return;
    }
    setIsSubmitting(true);
    showLoading('Kod gönderiliyor...');
    try {
      const result = await requestPasswordReset(email.trim());
      hideLoading();
      setIsSubmitting(false);
      if (result.code) {
        setDisplayedCode(result.code);
        await showSuccess(
          `Email servisi yapılandırılmadığı için kod burada görüntüleniyor: ${result.code}. Bu kodu 3 dakika içinde girin.`
        );
      } else {
        await showSuccess(
          'Şifre sıfırlama kodu email adresinize gönderildi. 3 dakika içinde girin.'
        );
      }
      setCountdown(CODE_EXPIRY_SECONDS);
      countdownStartedAt.current = null;
      setStep('code');
    } catch (error: unknown) {
      hideLoading();
      setIsSubmitting(false);
      await showError(
        error instanceof Error ? error.message : 'Kod gönderilirken bir hata oluştu.'
      );
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      await showError('Lütfen 6 haneli kodu girin.');
      return;
    }
    setIsSubmitting(true);
    showLoading('Kod doğrulanıyor...');
    try {
      const valid = await verifyCode(email.trim(), code.trim());
      hideLoading();
      setIsSubmitting(false);
      if (valid) {
        setStep('password');
      } else {
        await showError('Geçersiz veya süresi dolmuş kod. Lütfen tekrar deneyin.');
      }
    } catch (error: unknown) {
      hideLoading();
      setIsSubmitting(false);
      await showError(
        error instanceof Error ? error.message : 'Kod doğrulanırken bir hata oluştu.'
      );
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      await showError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      await showError('Şifreler eşleşmiyor.');
      return;
    }
    setIsSubmitting(true);
    showLoading('Şifre güncelleniyor...');
    try {
      await verifyCodeAndResetPassword(email.trim(), code.trim(), newPassword);
      hideLoading();
      // await showSuccess('Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz.');
      setStep('success');
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (error: unknown) {
      hideLoading();
      await showError(
        error instanceof Error ? error.message : 'Şifre güncellenirken bir hata oluştu.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginUserBg})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" aria-hidden />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/95 shadow-large mb-4 ring-4 ring-white/30 overflow-hidden">
            <img src={maktabaLogo} alt="Maktaba" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg mb-2">Maktaba</h1>
          <p className="text-white/90 drop-shadow">Şifremi Unuttum</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          {step === 'email' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Email Adresinizi Girin
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Kayıtlı email adresinize 3 dakika geçerli bir kod göndereceğiz.
              </p>
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="mb-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <HiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="email@ornek.com"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Gönderiliyor...' : 'Kod Gönder'}
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Doğrulama Kodunu Girin
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {displayedCode
                  ? `Gönderilen kod: ${displayedCode} — 3 dakika içinde girin.`
                  : 'Email adresinize gelen 6 haneli kodu girin.'}
              </p>
              <div className="flex justify-center mb-6">
                <span
                  className={`text-2xl font-mono font-bold tabular-nums ${
                    countdown <= 60 ? 'text-red-600' : 'text-gray-700'
                  }`}
                >
                  {formatCountdown(countdown)}
                </span>
              </div>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Doğrulama Kodu
                  </label>
                  <div className="relative">
                    <HiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center tracking-widest text-lg"
                      placeholder="000000"
                      required
                      disabled={isSubmitting || countdown <= 0}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || countdown <= 0}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Doğrulanıyor...' : 'Doğrula'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setDisplayedCode(null);
                  countdownStartedAt.current = null;
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <HiArrowLeft className="w-4 h-4" />
                Farklı email ile dene
              </button>
            </>
          )}

          {step === 'password' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Yeni Şifrenizi Belirleyin
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Yeni şifrenizi girin ve tekrar edin.
              </p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Yeni Şifre
                  </label>
                  <div className="relative">
                    <HiLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="En az 6 karakter"
                      required
                      minLength={6}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Şifre Tekrar
                  </label>
                  <div className="relative">
                    <HiLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Şifreyi tekrar girin"
                      required
                      minLength={6}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Şifreyi Kaydet'}
                </button>
              </form>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <p className="text-emerald-600 font-semibold mb-4">
                Şifreniz başarıyla güncellendi.
              </p>
              <p className="text-sm text-gray-600">Giriş sayfasına yönlendiriliyorsunuz...</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <Link
              to="/"
              className="block text-center text-emerald-600 hover:text-emerald-700 font-medium text-sm"
            >
              ← Giriş sayfasına dön
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-white/80 mt-6 drop-shadow">© 2025 Maktaba</p>
      </div>
    </div>
  );
}
