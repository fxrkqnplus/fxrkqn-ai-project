// components/AnimatedStream.tsx
"use client";

import { motion } from 'framer-motion';

// Konteyner için animasyon varyantları (harfleri gecikmeli başlatır)
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.015, // Her harf arasında 15 milisaniye gecikme
        },
    },
};

// Her bir harf için animasyon varyantları
const letterVariants = {
    hidden: { opacity: 0, y: 10 }, // Başlangıçta görünmez ve 10px aşağıda
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { type: 'spring', stiffness: 300, damping: 20 } // Yaylanma efekti
    },
};

interface AnimatedStreamProps {
    text: string;
    className?: string;
}

export default function AnimatedStream({ text, className = '' }: AnimatedStreamProps) {
    // Gelen metni harflere ayırıyoruz
    const letters = Array.from(text);

    return (
        <motion.div
            className={`whitespace-pre-wrap font-mono ${className}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {letters.map((letter, index) => (
                <motion.span
                    key={`${letter}-${index}`} // Harf ve index ile benzersiz bir key
                    variants={letterVariants}
                    className="inline-block" // Harflerin doğru hizalanması için
                >
                    {letter === ' ' ? '\u00A0' : letter} 
                </motion.span>
            ))}
        </motion.div>
    );
}