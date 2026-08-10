import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getAuthUser } from "@/lib/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Owla",
  description:
    "Owla — plataforma de entretenimento com mercados de previsão em pontos. Sem dinheiro real, só diversão.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header user={user ? { name: user.name, role: user.role } : null} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}