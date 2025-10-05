"use client"; // Bu komponentin istemci tarafında çalışacağını belirtiyoruz.

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Loader from './Loader'; // Loader komponentimizi import ediyoruz.

export default function ClientLayout({ 
    children 
}: { 
    children: React.ReactNode 
}) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {isLoading && <Loader />}
      </AnimatePresence>
      {/* Yükleme bitince ana içeriği (children) göster */}
      {!isLoading && children}
    </>
  );
}