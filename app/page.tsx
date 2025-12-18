// app/page.tsx - Düzeltilmiş giriş sayfası

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import DecryptedText from '../components/DecryptedText';
import Notification from '../components/Notification';
import { AnimatePresence, motion } from 'framer-motion';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import Particles from '../components/Particles';

const VerificationUI = ({ email, onBack }: { email: string; onBack: () => void }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResendEmail = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setMessage('✅ Doğrulama e-postası başarıyla yeniden gönderildi.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Beklenmedik bir hata oluştu';
      setMessage('❌ Hata: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-6 text-center max-w-md p-8 animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="absolute top-0 left-0 text-zinc-400 hover:text-foreground transition-colors"
        aria-label="Giriş formuna geri dön"
      >
        <ArrowLeftIcon className="h-6 w-6" />
      </button>
      <h1 className="text-3xl font-bold text-foreground font-mono">
        <DecryptedText text="hesabınızı doğrulayın" animateOn="view" sequential speed={40} />
      </h1>
      <p className="text-zinc-400 font-mono">
        <DecryptedText text="kaydınızı tamamlamak için son bir adım kaldı. lütfen " animateOn="view" sequential speed={20} />
        <strong className="text-foreground font-mono">{email}</strong>
        <DecryptedText text=" adresine gönderdiğimiz doğrulama linkine tıklayın." animateOn="view" sequential speed={20} />
      </p>
      <p className="text-zinc-500 text-sm font-mono">
        <DecryptedText text="(spam veya junk klasörünüzü de kontrol etmeyi unutmayın.)" animateOn="view" sequential speed={15} />
      </p>
      <button onClick={handleResendEmail} disabled={isLoading} className="mt-4 w-full rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 px-5 disabled:opacity-50 disabled:cursor-not-allowed">
        {isLoading ? 'gönderiliyor...' : 'e-postayı yeniden gönder'}
      </button>
      {message && (
        <div className={`mt-4 p-3 rounded-lg text-sm font-mono ${
          message.includes('✅') 
            ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const router = useRouter();
  const [uiState, setUiState] = useState<'form' | 'verification'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBg, setShowBg] = useState(false);
  const [isSignUpHovered, setIsSignUpHovered] = useState(false);

  const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());

  // ParticleColors'i memoize et - her render'da yeni array oluşmasını önle
  const particleColors = useMemo(() => ['#ffffff', '#ffffff'], []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email_confirmed_at || session?.user?.confirmed_at) {
        router.push('/chat');
      }
    };
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state değişti:', event, session);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // E-posta doğrulandığında chat'e yönlendir
        if (session.user.email_confirmed_at || session.user.confirmed_at) {
          router.push('/chat');
        } else if (uiState === 'verification') {
          // E-posta doğrulanmamış ve verification ekranındayız
          setSuccessMessage('E-posta doğrulama başarılı. Lütfen giriş yapın.');
          supabase.auth.signOut();
          sessionStorage.removeItem('verificationEmail');
          setUiState('form');
        }
      }

      // Token refresh olaylarında da kontrol et
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        if (session.user.email_confirmed_at || session.user.confirmed_at) {
          router.push('/chat');
        }
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [router, uiState]);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('verificationEmail');
    if (storedEmail) {
      setEmail(storedEmail);
    }

    const signupSuccessEmail = sessionStorage.getItem('signupSuccessEmail');
    if (signupSuccessEmail) {
      setSuccessMessage(`Doğrulama bağlantısı "${signupSuccessEmail}" adresine gönderildi. E-posta kutunuzu kontrol edin.`);
      sessionStorage.removeItem('signupSuccessEmail');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowBg(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const handleSignIn = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!isValidEmail(email)) {
      setIsLoading(false);
      setError('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    if (!password.trim()) {
      setIsLoading(false);
      setError('Şifre alanı boş bırakılamaz.');
      return;
    }
    
    try {
      console.log('Giriş denemesi başladı:', email);
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      console.log('Giriş yanıtı:', { data, signInError });

      if (signInError) {
        console.error('Giriş hatası:', signInError);
        
        // E-posta doğrulaması gerekiyor
        if (signInError.message.includes('Email not confirmed')) {
          console.log('E-posta doğrulaması gerekiyor');
          sessionStorage.setItem('verificationEmail', email);
          setUiState('verification');
          return;
        }
        
        // Geçersiz kimlik bilgileri
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Geçersiz e-posta veya şifre. Lütfen bilgilerinizi kontrol edin.');
          return;
        }
        
        throw signInError;
      }

      // Giriş başarılı - session kontrolü
      if (data.session && data.user) {
        console.log('Session oluşturuldu:', data.session.access_token.substring(0, 20) + '...');
        console.log('E-posta doğrulama durumu:', data.user.email_confirmed_at);
        
        // E-posta doğrulandıysa chat'e git
        if (data.user.email_confirmed_at || data.user.confirmed_at) {
          router.push('/chat');
        } else {
          // E-posta doğrulanmamış - kullanıcıyı çıkış yaptır ve doğrulama ekranına yönlendir
          console.log('E-posta doğrulanmamış, doğrulama ekranına yönlendiriliyor');
          await supabase.auth.signOut();
          sessionStorage.setItem('verificationEmail', email);
          setUiState('verification');
        }
      } else {
        console.error('Session oluşturulamadı');
        setError('Giriş başarısız. Lütfen tekrar deneyin.');
      }

    } catch (err: unknown) {
      console.error('Beklenmedik giriş hatası:', err);
      const errorMessage = err instanceof Error ? err.message : 'Beklenmedik bir hata oluştu';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    // Kayıt sayfasına yönlendirme
    router.push('/signup');
  };

  const handleBackToForm = () => {
    sessionStorage.removeItem('verificationEmail');
    setUiState('form');
  };

  return (
    <>
      {/* Arka Plan Animasyonu */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className={`w-full h-full transition-opacity duration-1000 ease-in-out ${showBg ? 'opacity-100' : 'opacity-0'}`}>
          <Particles
            particleColors={particleColors}
            particleCount={200}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover={false}
            alphaParticles={false}
            disableRotation={false}
          />
        </div>
      </div>

      <AnimatePresence>
        {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
        {successMessage && <Notification message={successMessage} type="success" onClose={() => setSuccessMessage(null)} />}
      </AnimatePresence>

      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center text-center sm:items-start sm:text-left">
          {uiState === 'form' ? (
            <>
              <div className="text-4xl sm:text-5xl font-mono text-foreground leading-tight">
                <DecryptedText text="sohbet etmek için" animateOn="view" sequential revealDirection="start" speed={60} />
                <br />
                <DecryptedText text="giriş yapın." animateOn="view" sequential revealDirection="start" speed={60} />
              </div>
              <div className="w-full max-w-sm space-y-4">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="e-posta adresi"
                      className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                    <input
                      type="password"
                      placeholder="şifre"
                      className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 mb-8">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full sm:w-auto rounded-full bg-foreground text-background transition-colors flex items-center justify-center gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 px-5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '...' : 'giriş yap'}
                    </button>
                    <Link href="/forgotPassword" className="text-sm text-zinc-400 hover:text-foreground transition-colors whitespace-nowrap">
                      şifrenizi mi unuttunuz?
                    </Link>
                  </div>
                </form>
                <div className="pt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  hesabınız yok mu?{' '}
                  <div
                    className="relative inline-flex items-center justify-center h-10 w-32"
                    onMouseEnter={() => setIsSignUpHovered(true)}
                    onMouseLeave={() => setIsSignUpHovered(false)}
                  >
                    <AnimatePresence mode="wait">
                      {isSignUpHovered ? (
                        <Link href="/signup" passHref>
                        <motion.div
                          key="button"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: -5 }}
                          exit={{ opacity: 0, y: 20 }}
                          transition={{ duration: 0.2, ease: 'easeIn' }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <button
                            onClick={handleSignUp}
                            disabled={isLoading}
                            className="w-full h-full rounded-full border border-black/[.08] dark:text-white transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-semibold text-sm sm:text-base"
                          >
                            {isLoading ? '...' : 'kaydol'}
                          </button>
                        </motion.div>
                        </Link>
                      ) : (
                        <motion.span
                          key="text"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="font-semibold text-zinc-700 dark:text-white cursor-pointer transition-colors hover:text-black"
                        >
                          kayıt olun.
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <VerificationUI email={email} onBack={handleBackToForm} />
          )}
        </main>
        <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
          <p className="text-xs opacity-25 text-zinc-500">Powered by fxrkqn</p>
        </footer>
      </div>
    </>
  );
}