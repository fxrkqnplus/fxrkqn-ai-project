import { motion } from 'framer-motion';

// Bu, ortadaki dönen ikon ve içindeki logo/harf olacak.
const Spinner = () => (
  <div className="relative h-20 w-20">
    {/* Dönen kenarlık */}
    <div className="absolute h-full w-full animate-spin rounded-full border-2 border-solid border-zinc-500 border-t-transparent"></div>
    {/* Ortadaki sabit harf/logo */}
    <div className="absolute flex h-full w-full items-center justify-center text-3xl font-thin text-zinc-300">
      F
      {/* Buradaki "F" harfi yerine ileride kendi logonuzu <Image> componenti ile ekleyebilirsiniz */}
    </div>
  </div>
);

// Bu, tam ekran kaplayan ve animasyonla kaybolacak olan ana katman.
export default function Loader() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1.0 } }} // Kaybolma animasyonu: 1 saniye süren fade-out
      className="fixed inset-0 z-50 flex items-center justify-center bg-background" // bg-background, sitenin arkaplan rengini alır (bizde siyah)
    >
      <Spinner />
    </motion.div>
  );
}