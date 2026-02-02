import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { LogProvider } from "@/components/providers/log-provider";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CogniaLauncher",
  description: "Cross-platform environment and package manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme
        >
          <LocaleProvider initialLocale="en" messages={{ en, zh }}>
            <LogProvider>
              <AppShell>{children}</AppShell>
            </LogProvider>
          </LocaleProvider>
        </ThemeProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
