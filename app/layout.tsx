// app/layout.tsx:

// Artık "use client" yok, bu bir sunucu komponenti.
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import ClientLayout from "@/components/ClientLayout"; // Yeni istemci komponentimizi import ediyoruz.
import "./globals.css";

// Metadata burada sorunsuzca export edilebilir.
export const metadata: Metadata = {
  title: "fxrkqn HQ",
  description: "Furkan's AI Chat Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-background text-foreground">
        {/* İstemci tarafı mantığını bu komponent yönetecek */}
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}