import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Bu kısım, projenin varsayılan fontunu Geist Sans olarak ayarlar.
        sans: ['var(--font-geist-sans)'],
        // Bu kısım, 'font-mono' sınıfının Geist Mono fontunu kullanmasını sağlar.
        mono: ['var(--font-geist-mono)'],
      },
    },
  },
  plugins: [],
};
export default config;