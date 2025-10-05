// components/Notification.tsx
import { motion } from 'framer-motion';

const CloseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

interface NotificationProps {
    message: string;
    type: 'error' | 'success'; // YENİ: Bildirim tipi
    onClose: () => void;
}

export default function Notification({ message, type, onClose }: NotificationProps) {
    // Tipe göre renk belirleme
    const baseClasses = "fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-4 w-full max-w-md p-4 rounded-lg border backdrop-blur-sm text-white";
    const typeClasses = type === 'success'
        ? "bg-green-900/50 border-green-700" // Başarı için yeşil tonları
        : "bg-zinc-900/80 border-zinc-700"; // Hata için eski stilimiz

    return (
        <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`${baseClasses} ${typeClasses}`}
        >
            <p className="text-sm font-medium font-sans">{message}</p>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                <CloseIcon />
            </button>
        </motion.div>
    );
}