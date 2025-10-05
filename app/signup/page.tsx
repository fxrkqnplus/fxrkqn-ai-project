"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Notification from '@/components/Notification';
import Particles from '@/components/Particles';
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon';
import DecryptedText from '@/components/DecryptedText';
import { motion, AnimatePresence } from 'framer-motion';

const steps = [
  { step: 1, title: "e-posta doğrulama" },
  { step: 2, title: "bir şifre belirleyiniz" },
  { step: 3, title: "cinsiyetinizi giriniz" },
  { step: 4, title: "adınızı giriniz" },
];

export default function SignUpPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    gender: '',
    fullName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBg, setShowBg] = useState(false);
  const [direction, setDirection] = useState(0);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          router.replace('/chat');
          return;
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
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-foreground font-mono">
          <DecryptedText text="kontrol ediliyor..." animateOn="view" sequential speed={50} />
        </div>
      </div>
    );
  }

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? '100%' : '-100%', opacity: 0 }),
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePrevStep = () => {
    setError(null);
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep(s => s - 1);
    } else {
      router.push('/');
    }
  };
  
  // YENİ VE GÜVENİLİR E-POSTA KONTROL FONKSİYONU
  const checkEmailAvailability = async (email: string): Promise<{ isAvailable: boolean; message?: string }> => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isAvailable: false, message: 'Lütfen geçerli bir e-posta adresi girin.' };
    }

    try {
      console.log('RPC ile e-posta kontrolü yapılıyor:', email);
      const { data, error: rpcError } = await supabase.rpc('email_exists', {
        email_to_check: email
      });

      if (rpcError) {
        console.error('RPC hatası:', rpcError);
        // Hata durumunda, en kötü senaryoda devam etmesine izin verelim. 
        // Supabase'in kendi signUp kontrolü son noktayı koyacaktır.
        return { isAvailable: true };
      }

      console.log('RPC sonucu:', data);
      // 'data' true ise e-posta mevcuttur.
      if (data === true) {
        return { isAvailable: false, message: 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.' };
      }

      // 'data' false ise e-posta kullanılabilir.
      return { isAvailable: true };

    } catch (err) {
      console.error('E-posta kontrolünde beklenmedik hata:', err);
      return { isAvailable: true }; // Güvenli tarafta kal
    }
  };

  const handleNextStep = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (currentStep === 1) {
        const emailCheck = await checkEmailAvailability(formData.email);
        if (!emailCheck.isAvailable) {
          setError(emailCheck.message || 'E-posta adresi kullanılamaz.');
          return;
        }
      }

      if (currentStep === 2) {
        if (formData.password.length < 6) {
          setError('Şifre en az 6 karakter olmalıdır.');
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Şifreler eşleşmiyor.');
          return;
        }
      }

      if (currentStep === 3 && !formData.gender) {
        setError('Lütfen bir cinsiyet seçin.');
        return;
      }

      if (currentStep === 4) {
        if (!formData.fullName.trim()) {
          setError('Lütfen adınızı giriniz.');
          return;
        }
        await handleFinalSubmit(); // Son adımda final fonksiyonunu çağır
        return; 
      }

      setDirection(1);
      setCurrentStep(s => s + 1);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFinalSubmit = async () => {
    // Bu fonksiyon doğrudan handleNextStep'in 4. adımı tarafından çağrılacak.
    // setIsLoading(true) ve setError(null) zaten handleNextStep içinde yapıldı.
    try {
      console.log('🚀 Kayıt işlemi başlatılıyor...');
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            gender: formData.gender,
          },
        },
      });

      if (signUpError) throw signUpError;

      console.log('✅ Kayıt başarılı, doğrulama bekleniyor.');
      router.push(`/`); // Kayıt sonrası ana sayfadaki doğrulama UI'ına yönlendir.

    } catch (err: any) {
        console.error('Kayıt hatası:', err);
        if (err.message.includes('User already registered')) {
            setError('Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.');
        } else if (err.message.includes('rate limit')) {
            setError('Çok fazla deneme yapıldı. Lütfen biraz bekleyin.');
        } else {
            setError('Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.');
        }
    } finally {
        setIsLoading(false);
    }
  }


  return (
    <>
      {/* Arka plan */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className={`w-full h-full transition-opacity duration-1000 ease-in-out ${showBg ? 'opacity-100' : 'opacity-0'}`}>
          <Particles particleColors={['#ffffff', '#ffffff']} particleCount={150} speed={0.1}/>
        </div>
      </div>
      <AnimatePresence>
        {error && <Notification message={error} type="error" onClose={() => setError(null)}/>}
      </AnimatePresence>
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        <main className="row-start-2 flex flex-col gap-8 items-center text-center sm:items-start sm:text-left">
          <div className="relative w-full max-w-md bg-black/10 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-black/[.1] dark:border-white/[.1] shadow-xl">
            <button onClick={handlePrevStep} disabled={isLoading} className="absolute top-6 left-6 text-zinc-400 hover:text-foreground transition-colors disabled:opacity-50" aria-label="Önceki adıma dön">
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <div className="text-center mb-8 mt-4">
              <h1 className="text-3xl font-bold text-foreground font-mono">
                <DecryptedText text="hesap oluştur" animateOn="view" sequential speed={50} />
              </h1>
            </div>
            <div className="w-full mb-8">
              <div className="flex justify-between mb-1">
                <span className="text-base font-medium text-zinc-400 pr-15 font-mono">adım {currentStep} / {steps.length}</span>
                <span className="text-sm font-medium text-zinc-400 font-mono">{steps[currentStep - 1].title}</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2.5">
                <motion.div className="bg-blue-600 h-2.5 rounded-full" animate={{ width: `${(currentStep / steps.length) * 100}%` }} transition={{ duration: 0.5, ease: 'easeInOut' }}/>
              </div>
            </div>
            <div className="relative h-48 overflow-hidden">
              <AnimatePresence initial={false} custom={direction}>
                <motion.div key={currentStep} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 },}} className="absolute w-full">
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <label htmlFor="email" className="block text-sm font-medium text-zinc-300 font-mono text-left">e-posta adresiniz</label>
                      <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="ornek@eposta.com" disabled={isLoading} className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30 font-semibold disabled:opacity-50"/>
                      <p className="text-xs text-zinc-500 font-mono text-left">📧 E-posta adresinizin sistemde kayıtlı olup olmadığı kontrol edilecektir.</p>
                    </div>
                  )}
                  {currentStep === 2 && (
                     <div className="space-y-4">
                      <label htmlFor="password" className="block text-sm font-medium text-zinc-300 font-mono text-left">şifre</label>
                      <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="••••••••" disabled={isLoading} className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30 font-mono disabled:opacity-50"/>
                      <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="şifreyi doğrula" disabled={isLoading} className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30 font-mono disabled:opacity-50"/>
                    </div>
                  )}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-zinc-300 font-mono text-left mb-2">Cinsiyet</label>
                      <div className="flex gap-4">
                        {['Erkek', 'Kadın', 'Diğer'].map(gender => (
                            <button key={gender} onClick={() => setFormData(prev => ({...prev, gender}))} className={`w-full h-12 rounded-lg border transition-colors ${formData.gender === gender ? 'bg-blue-600 border-blue-500' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}`}>
                                {gender}
                            </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <label htmlFor="fullName" className="block text-sm font-medium text-zinc-300 font-mono text-left">Adınız ve Soyadınız</label>
                      <input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} placeholder="Ahmet K." disabled={isLoading} className="w-full h-10 px-4 bg-black/[.05] dark:bg-white/[.06] border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 dark:focus:ring-white/30 font-semibold disabled:opacity-50"/>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-8">
              <button onClick={handleNextStep} className="w-full h-12 rounded-full bg-foreground text-background font-semibold hover:bg-zinc-300 transition-colors disabled:opacity-50" disabled={isLoading}>
                {isLoading ? 'kontrol ediliyor...' : (currentStep === steps.length ? 'Kaydı Tamamla' : 'İleri')}
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
