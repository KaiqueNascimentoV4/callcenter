import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/sidebar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "V4 Call",
  description: "Painel de gestão de leads e ligações com IA",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full bg-background text-foreground">
        <Providers>
          <div className="flex min-h-screen w-full bg-background">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7 2xl:px-10">
              <div className="page-shell">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
