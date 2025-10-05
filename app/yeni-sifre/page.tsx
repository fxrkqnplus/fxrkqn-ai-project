// app/yeni-sifre/page.tsx

"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import DecryptedText from '@/components/DecryptedText';
import Notification from '@/components/Notification';
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon';
import Particles from '@/components/Particles';
import { AnimatePresence } from 'framer-motion';

export default function NewPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showBg, setShowBg] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    const validateAndSetupSession = async () => {
      try {
        // Önce mevcut session'ı kontrol et
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        // URL hash'inden parametreleri al (Supabase genellikle hash kullanır)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');
        
        console.log('URL parametreleri:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

        // Eğer URL'de token varsa ve type recovery ise
        if (type === 'recovery' && accessToken) {
          // Token'ları kullanarak session'ı kur
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            console.error('Session kurma hatası:', error);
            setError('Şifre sıfırlama linki geçersiz veya süresi dolmuş. Lütfen yeni bir şifre sıfırlama talebi gönderin.');
            setIsValidToken(false);
          } else if (data.session?.user) {
            setIsValidToken(true);
            console.log('Recovery session kuruldu:', data.session.user.email);
            
            // URL'deki hash parametrelerini temizle
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } 
        // Eğer URL'de token yoksa ama mevcut session recovery türündeyse
        else if (currentSession?.user && !accessToken && !type) {
          // Mevcut session'ın recovery için geçerli olup olmadığını kontrol et
          const { data: user, error: userError } = await supabase.auth.getUser();
          
          if (!userError && user?.user) {
            setIsValidToken(true);
            console.log('Mevcut session kullanılıyor:', user.user.email);
          } else {
            setError('Oturum geçersiz. Lütfen yeni bir şifre sıfırlama talebi gönderin.');
            setIsValidToken(false);
          }
        }
        // Token yoksa veya geçersizse
        else {
          setError('Geçersiz şifre sıfırlama linki. Lütfen e-postanızdaki linki kullanın.');
          setIsValidToken(false);
        }
      } catch (err) {
        console.error('Session doğrulama hatası:', err);
        setError('Şifre sıfırlama linki doğrulanamadı. Lütfen tekrar deneyin.');
        setIsValidToken(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateAndSetupSession();
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setShowBg(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (error && !success) {
      const timer = setTimeout(() => {
        setError(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Token doğrulama sırasında loading göster
  if (isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-foreground font-mono">
          <DecryptedText text="doğrulanıyor..." animateOn="view" sequential speed={50} />
        </div>
      </div>
    );
  }

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) {
      return 'Şifre en az 6 karakter olmalıdır.';
    }
    return null;
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim() || !confirmPassword.trim()) {
      setError('Lütfen tüm alanları doldurunuz.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor. Lütfen kontrol edin.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess(true);
      
      // Başarılı şifre güncellemesinden sonra çıkış yap ve ana sayfaya yönlendir
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push('/?message=password-updated');
      }, 3000);
      
    } catch (err: any) {
      console.error('Şifre güncelleme hatası:', err);
      
      if (err.message.includes('weak_password')) {
        setError('Şifre çok zayıf. Daha güçlü bir şifre seçin.');
      } else if (err.message.includes('same_password')) {
        setError('Yeni şifre eski şifrenizle aynı olamaz.');
      } else {
        setError('Şifre güncellenirken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      // Önce mevcut session'ı temizle
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Çıkış hatası:', error);
    } finally {
      // Her durumda ana sayfaya yönlendir
      router.push('/');
    }
  };

  // Başarılı şifre güncelleme ekranı
  if (success) {
    return (
      <>
        {/* Arka Plan Animasyonu */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className={`w-full h-full transition-opacity duration-1000 ease-in-out ${showBg ? 'opacity-100' : 'opacity-0'}`}>
            <Particles
              particleColors={['#22c55e', '#16a34a']}
              particleCount={100}
              particleSpread={15}
              speed={0.15}
              particleBaseSize={80}
              moveParticlesOnHover
              alphaParticles={false}
              disableRotation={false}
            />
          </div>
        </div>

        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
          <main className="row-start-2 flex flex-col gap-8 items-center text-center">
            <div className="w-full max-w-md bg-green-500/10 backdrop-blur-sm rounded-2xl p-8 border border-green-500/20 shadow-xl">
              <div className="text-center">
                <div className="text-6xl mb-6">✅</div>
                <h1 className="text-3xl font-bold text-green-400 font-mono mb-4">
                  <DecryptedText text="başarılı!" animateOn="view" sequential speed={50} />
                </h1>
                <p className="text-zinc-300 font-mono text-sm mb-6">
                  <DecryptedText text="şifreniz başarıyla güncellendi. giriş sayfasına yönlendiriliyorsunuz..." animateOn="view" sequential speed={30} />
                </p>
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-400 border-t-transparent"></div>
                </div>
              </div>
            </div>
          </main>
          
          <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
            <p className="text-xs opacity-25 text-zinc-500 font-mono">Powered by fxrkqn</p>
          </footer>
        </div>
      </>
    );
  }

  // Geçersiz token durumu
  if (!isValidToken) {
    return (
      <>
        {/* Arka Plan Animasyonu */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className={`w-full h-full transition-opacity duration-1000 ease-in-out ${showBg ? 'opacity-100' : 'opacity-0'}`}>
            <Particles
              particleColors={['#ef4444', '#dc2626']}
              particleCount={80}
              particleSpread={8}
              speed={0.08}
              particleBaseSize={120}
              moveParticlesOnHover
              alphaParticles={false}
              disableRotation={false}
            />
          </div>
        </div>

        <AnimatePresence>
          {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
        </AnimatePresence>

        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
          <main className="row-start-2 flex flex-col gap-8 items-center text-center">
            <div className="w-full max-w-md bg-red-500/10 backdrop-blur-sm rounded-2xl p-8 border border-red-500/20 shadow-xl">
              <div className="text-center">
                <div className="text-6xl mb-6">❌</div>
                <h1 className="text-3xl font-bold text-red-400 font-mono mb-4">
                  <DecryptedText text="geçersiz link" animateOn="view" sequential speed={50} />
                </h1>
                <p className="text-zinc-300 font-mono text-sm mb-6">
                  <DecryptedText text="şifre sıfırlama linki geçersiz veya süresi dolmuş." animateOn="view" sequential speed={30} />
                </p>
                <div className="space-y-4">
                  <button
                    onClick={() => router.push('/forgotPassword')}
                    className="w-full h-10 rounded-full bg-foreground text-background font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors font-semibold"
                  >
                    yeni şifre sıfırlama talebi
                  </button>
                  <button
                    onClick={handleBackToLogin}
                    className="w-full h-10 rounded-full border border-zinc-600 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors font-semibold"
                  >
                    giriş sayfasına dön
                  </button>
                </div>
              </div>
            </div>
          </main>
          
          <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
            <p className="text-xs opacity-25 text-zinc-500 font-mono">Powered by fxrkqn</p>
          </footer>
        </div>
      </>
    );
  }

  // Ana şifre güncelleme formu
  return (
    <>
      {/* Arka Plan Animasyonu */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className={`w-full h-full transition-opacity duration-1000 ease-in-out ${showBg ? 'opacity-100' : 'opacity-0'}`}>
          <Particles
            particleColors={['#ffffff', '#ffffff']}
            particleCount={150}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover
            alphaParticles={false}
            disableRotation={false}
          />
        </div>
      </div>

      <AnimatePresence>
        {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
      </AnimatePresence>

      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        <main className="row-start-2 flex flex-col gap-8 items-center text-center sm:items-start sm:text-left">
          <div className="relative w-full max-w-md bg-black/10 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-black/[.1] dark:border-white/[.1] shadow-xl">
            {/* Geri butonu */}
            <button
              onClick={handleBackToLogin}
              className="absolute top-6 left-6 text-zinc-400 hover:text-foreground transition-colors"
              aria-label="Giriş sayfasına geri dön"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>

            {/* Başlık */}
            <div className="text-center mb-8 mt-4">
              <h1 className="text-3xl font-bold text-foreground font-mono">
                <DecryptedText text="yeni şifre" animateOn="view" sequential speed={50} />
              </h1>
              <p className="text-zinc-400 font-mono text-sm mt-4">
                <DecryptedText text="hesabınız için yeni bir şifre belirleyin." animateOn="view" sequential speed={30} />
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handlePasswordUpdate} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-300 font-mono text-left"
                >
                  yeni şifre
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="yeni şifrenizi giriniz."
                  className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30 font-semibold"
                  disabled={isLoading}
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-zinc-300 font-mono text-left"
                >
                  şifre onayı
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="şifrenizi tekrar giriniz."
                  className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30 font-semibold"
                  disabled={isLoading}
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-full bg-foreground text-background font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isLoading ? 'güncelleniyor...' : 'şifremi güncelle'}
              </button>
            </form>

            {/* Şifre gereksinimleri */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-xs font-mono">
                💡 Şifreniz en az 6 karakter olmalıdır. Güvenliğiniz için güçlü bir şifre seçin.
              </p>
            </div>
          </div>
        </main>
        
        <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
          <p className="text-xs opacity-25 text-zinc-500 font-mono">Powered by fxrkqn</p>
        </footer>
      </div>
    </>
  );
}