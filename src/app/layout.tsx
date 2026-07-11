import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { APP_NAME_TH, APP_TAGLINE_TH } from "@/config/constants";
import { ThemeProvider } from "@/components/theme-provider";
import { NavProgress } from "@/components/app/nav-progress";

const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
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

/** Avoid FOUC before ThemeProvider hydrates. */
const themeBootScript = `(function(){try{var t=localStorage.getItem("hora-theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      data-theme="dark"
      suppressHydrationWarning
      className={`${notoThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${notoThai.className} min-h-full flex flex-col`}>
        <ThemeProvider>
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
