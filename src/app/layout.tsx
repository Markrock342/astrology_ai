import type { Metadata } from "next";
import { Geist_Mono, Nunito, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { APP_NAME_TH, APP_TAGLINE_TH } from "@/config/constants";

const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${APP_NAME_TH} — ${APP_TAGLINE_TH}`,
  description: APP_TAGLINE_TH,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${notoThai.variable} ${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${notoThai.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
