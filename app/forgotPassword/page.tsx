// app/forgotPassword/page.tsx

"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import DecryptedText from '@/components/DecryptedText';
import Notification from '@/components/Notification';
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon';
import Particles from '@/components/Particles';
import { AnimatePresence } from 'framer-motion';

export default function PasswordResetPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBg, setShowBg] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    // Giriş yapmış kullanıcıları chat sayfasına yönlendir
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          router.replace('/chat');
        }
      } catch (error) {
        console.error('Session kontrol hatası:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => setShowBg(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (error || message) {
      const timer = setTimeout(() => {
        setError(null);
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, message]);

  // Session kontrol edilirken loading göster
  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-foreground font-mono">
          <DecryptedText text="kontrol ediliyor..." animateOn="view" sequential speed={50} />
        </div>
      </div>
    );
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    setIsLoading(true);

    try {
      // ADIM 1: E-postanın sistemde kayıtlı olup olmadığını RPC ile kontrol et
      console.log('RPC ile e-posta varlığı kontrol ediliyor:', email);
      const { data: userExists, error: rpcError } = await supabase.rpc('email_exists', {
        email_to_check: email
      });

      if (rpcError) {
        console.error('RPC hatası:', rpcError);
        throw new Error('Kullanıcı kontrolü sırasında bir hata oluştu. Lütfen tekrar deneyin.');
      }
      
      console.log('RPC sonucu:', userExists);

      // ADIM 2: Eğer e-posta kayıtlı değilse, hata göster ve işlemi durdur
      if (!userExists) {
        setError('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı.');
        return; // Fonksiyonu burada sonlandır
      }

      // ADIM 3: E-posta kayıtlıysa, şifre sıfırlama linkini gönder
      console.log('E-posta bulundu, şifre sıırlama linki gönderiliyor...');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/yeni-sifre`, // Bu sayfanın oluşturulması gerekecek
      });

      if (resetError) {
        throw resetError;
      }

      setMessage(
        `Şifre sıfırlama bağlantısı "${email}" adresine gönderildi. E-posta kutunuzu kontrol edin.`
      );
      setEmail(''); // Başarılı olunca e-posta alanını temizle

    } catch (err: unknown) {
      console.error('Şifre sıfırlama hatası:', err);
      if (!error) { // Zaten özel bir hata mesajı ayarlanmadıysa
        setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/');
  };

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
        {message && <Notification message={message} type="success" onClose={() => setMessage(null)} />}
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
                <DecryptedText text="şifremi unuttum" animateOn="view" sequential speed={50} />
              </h1>
              <p className="text-zinc-400 font-mono text-sm mt-4">
                <DecryptedText text="lütfen şifrenizi sıfırlamak için e-posta adresinizi giriniz." animateOn="view" sequential speed={30} />
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handlePasswordReset} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-300 font-mono text-left"
                >
                  e-posta adresi
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@eposta.com"
                  className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30 font-semibold"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-full bg-foreground text-background font-medium hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isLoading ? 'gönderiliyor...' : 'sıfırlama bağlantısı gönder'}
              </button>
            </form>

            {/* Bilgi kutusu */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-xs font-mono">
                💡 Şifre sıfırlama bağlantısı e-posta adresinize gönderilecektir. 
                Spam/junk klasörünüzü de kontrol etmeyi unutmayın.
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
