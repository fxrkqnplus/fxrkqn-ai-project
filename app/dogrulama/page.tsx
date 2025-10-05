// app/dogrulama/page.tsx - Düzeltilmiş versiyon

"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DecryptedText from '@/components/DecryptedText';
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon';

function VerificationPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);

    useEffect(() => {
        const checkAccess = async () => {
            try {
                // 1. Önce session kontrol et
                const { data: { session } } = await supabase.auth.getSession();
                console.log("Session:", session);

                if (session) {
                    const { data: { user } } = await supabase.auth.getUser();
                    console.log("User:", user);

                    // E-posta doğrulanmışsa chat sayfasına yönlendir
                    if (user?.email_confirmed_at || user?.confirmed_at) {
                        console.log("✅ E-posta doğrulanmış. Chat'e yönlendiriliyor.");
                        router.replace('/chat');
                        return;
                    }

                    // Session var ama e-posta doğrulanmamış - bu sayfada kal
                    console.log("🟠 Session var ama doğrulanmamış. Email ayarlanıyor.");
                    setEmail(user?.email ?? null);
                    setIsPageLoading(false);
                    return;
                }

                // 2. Session yoksa URL parametrelerini kontrol et
                const urlEmail = searchParams.get("email");
                if (urlEmail) {
                    console.log("📧 URL'den email alındı:", urlEmail);
                    setEmail(urlEmail);
                    setIsPageLoading(false);
                    return;
                }

                // 3. SessionStorage'dan email al
                const storedEmail = sessionStorage.getItem('verificationEmail');
                if (storedEmail) {
                    console.log("💾 SessionStorage'dan email alındı:", storedEmail);
                    setEmail(storedEmail);
                    // SessionStorage'ı temizleme - sadece email'i aldıktan sonra
                    // sessionStorage.removeItem('verificationEmail');
                    setIsPageLoading(false);
                    return;
                }

                // 4. localStorage'dan da kontrol et (fallback)
                const localEmail = localStorage.getItem('verificationEmail');
                if (localEmail) {
                    console.log("🗄️ LocalStorage'dan email alındı:", localEmail);
                    setEmail(localEmail);
                    setIsPageLoading(false);
                    return;
                }

                // Hiçbir email bilgisi yoksa ana sayfaya yönlendir
                console.log("🔴 Email bilgisi yok. Anasayfaya yönlendirme.");
                setTimeout(() => {
                    router.replace('/');
                }, 2000); // 2 saniye bekle, belki email gelir

            } catch (error) {
                console.error("Erişim kontrolü hatası:", error);
                // Hata durumunda da ana sayfaya yönlendirme
                setTimeout(() => {
                    router.replace('/');
                }, 1000);
            }
        };

        checkAccess();

        // Auth state değişikliklerini dinle
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth state değişti:", event, session?.user?.email_confirmed_at);
            
            if (event === 'SIGNED_IN' && session?.user) {
                // E-posta doğrulandığında chat sayfasına yönlendir
                if (session.user.email_confirmed_at || session.user.confirmed_at) {
                    console.log("✅ E-posta doğrulandı, chat sayfasına yönlendiriliyor.");
                    router.replace('/chat');
                } else {
                    // Giriş yapıldı ama e-posta doğrulanmamış
                    console.log("🟠 Giriş yapıldı ama e-posta doğrulanmamış.");
                    setEmail(session.user.email ?? null);
                    setIsPageLoading(false);
                }
            }

            // Token refresh olaylarında da kontrol et
            if (event === 'TOKEN_REFRESHED' && session?.user) {
                if (session.user.email_confirmed_at || session.user.confirmed_at) {
                    console.log("✅ Token yenilendi ve e-posta doğrulanmış, chat sayfasına yönlendiriliyor.");
                    router.replace('/chat');
                }
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [router, searchParams]);

    const handleResendEmail = async () => {
        if (!email) {
            setMessage('E-posta adresi bulunamadı. Lütfen tekrar deneyin.');
            return;
        }
        setIsLoading(true);
        setMessage('');
        try {
            const { error } = await supabase.auth.resend({ type: 'signup', email });
            if (error) throw error;
            setMessage('✅ Doğrulama e-postası başarıyla yeniden gönderildi. Lütfen e-posta kutunuzu kontrol edin.');
        } catch (error: any) {
            console.error('Resend error:', error);
            setMessage('❌ Hata: ' + (error.message || 'Beklenmedik bir hata oluştu'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToLogin = () => {
        // SessionStorage'ı temizle ve ana sayfaya git
        sessionStorage.removeItem('verificationEmail');
        localStorage.removeItem('verificationEmail');
        router.push('/');
    };

    // Sayfa yükleniyorsa loading göster
    if (isPageLoading) {
        return (
            <div className="flex flex-col gap-6 text-center max-w-md p-8">
                <div className="text-foreground font-mono">
                    Sayfa yükleniyor...
                </div>
                <div className="text-zinc-400 text-sm font-mono">
                    E-posta bilgisi kontrol ediliyor...
                </div>
            </div>
        );
    }

    // E-posta yoksa hata mesajı göster
    if (!email) {
        return (
            <div className="flex flex-col gap-6 text-center max-w-md p-8">
                <div className="text-red-400 font-mono">
                    ❌ E-posta adresi bulunamadı
                </div>
                <div className="text-zinc-400 text-sm font-mono">
                    Doğrulama sayfasına erişmek için önce kayıt olmanız gerekir.
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col gap-6 text-center max-w-md p-8"> 
            <button 
                onClick={handleBackToLogin}
                className="absolute top-0 left-0 text-zinc-400 hover:text-foreground transition-colors"
                aria-label="Ana sayfaya geri dön"
            >
                <ArrowLeftIcon className="h-6 w-6" />
            </button>
            
            <h1 className="text-3xl font-bold text-foreground font-mono">
                <DecryptedText text="hesabınızı doğrulayın" animateOn="view" sequential={true} speed={40}/>
            </h1>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                <p className="text-blue-400 text-sm font-mono">
                    📧 Doğrulama e-postası gönderildi
                </p>
            </div>
            
            <p className="text-zinc-400 font-mono">
                <DecryptedText text="kaydınızı tamamlamak için son bir adım kaldı. lütfen " animateOn="view" sequential={true} speed={20}/>
                <strong className="text-foreground font-mono bg-zinc-800 px-2 py-1 rounded">{email}</strong>
                <DecryptedText text=" adresine gönderdiğimiz doğrulama linkine tıklayın." animateOn="view" sequential={true} speed={20}/>
            </p>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-yellow-400 text-sm font-mono">
                    <DecryptedText text="💡 spam veya junk klasörünüzü de kontrol etmeyi unutmayın." animateOn="view" sequential={true} speed={15}/>
                </p>
            </div>
            
            <button
                onClick={handleResendEmail}
                disabled={isLoading}
                className="mt-4 w-full rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 px-5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? '📤 gönderiliyor...' : '🔄 e-postayı yeniden gönder'}
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
            
            <div className="mt-6 pt-4 border-t border-zinc-700">
                <p className="text-zinc-500 text-xs font-mono mb-2">
                    E-posta gelmedi mi?
                </p>
                <div className="space-y-2 text-xs text-zinc-600">
                    <div>• Spam/Junk klasörünü kontrol edin</div>
                    <div>• E-posta adresinizi doğru yazdığınızdan emin olun</div>
                    <div>• Birkaç dakika bekleyin ve tekrar deneyin</div>
                </div>
            </div>
        </div>
    );
}

export default function VerificationPage() {
    return (
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="row-start-2">
                <Suspense fallback={
                    <div className="flex flex-col gap-6 text-center max-w-md p-8">
                        <div className="text-foreground font-mono">yükleniyor...</div>
                    </div>
                }>
                    <VerificationPageContent />
                </Suspense>
            </main>
        </div>
    );
}