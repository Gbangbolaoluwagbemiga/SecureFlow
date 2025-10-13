import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Web3Provider } from "@/contexts/web3-context";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/toaster";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "SecureFlow - Trustless Escrow on Monad",
  description:
    "Trustless payments with transparent milestones powered by Monad Testnet",
  generator: "SecureFlow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={<div>Loading...</div>}>
            <Web3Provider>
              <Navbar />
              <main className="pt-16">{children}</main>
              <Toaster />
            </Web3Provider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
