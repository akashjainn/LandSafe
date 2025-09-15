import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/app-shell";
import ServiceWorker from "@/components/ServiceWorker";
import GoogleAnalytics from "@/lib/ga";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LandSafe - Reunion Flight Tracker",
  description: "Track all your friends' flights in one place for your reunion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ""}`}
          strategy="afterInteractive"
        />
        <Script id="ga-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            // Disable automatic page_view; we'll send manually on SPA route changes
            gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ""}', { anonymize_ip: true, send_page_view: false });
          `}
        </Script>
      </head>
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        <GoogleAnalytics />
        <Providers>
          <AppShell>
            {children}
          </AppShell>
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
