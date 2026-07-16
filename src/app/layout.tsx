import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { APP_NAME_TH, APP_TAGLINE_TH } from "@/config/constants";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteBrandProvider } from "@/components/site-brand-provider";
import { NavProgress } from "@/components/app/nav-progress";
import { CMS_KEYS, type CmsSiteTheme } from "@/lib/cms-keys";
import { buildSiteBrandBootPayload } from "@/lib/theme-colors";
import { getPublishedSetting } from "@/server/settings/settings-service";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME_TH,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

function buildThemeBootScript(brandJson: string) {
  return `(function(){try{var t=localStorage.getItem("hora-theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);var brand=${brandJson};if(brand&&brand.enabled){var vars=t==="light"?brand.light:brand.dark;var r=document.documentElement;for(var k in vars)if(Object.prototype.hasOwnProperty.call(vars,k))r.style.setProperty(k,vars[k]);}}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let siteTheme: CmsSiteTheme;
  try {
    siteTheme = (await getPublishedSetting(CMS_KEYS.siteTheme)) as CmsSiteTheme;
  } catch {
    siteTheme = {
      enabled: false,
      primary: "#c9a24b",
      secondary: "#1f8f7a",
      backgroundDark: "#0d0d0f",
      backgroundLight: "#f3f4f6",
    };
  }
  const brandBoot = buildSiteBrandBootPayload(siteTheme);
  const themeBootScript = buildThemeBootScript(JSON.stringify(brandBoot));

  return (
    <html
      lang="th"
      data-theme="dark"
      suppressHydrationWarning
      className={`${notoThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script id="hora-theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        <meta name="theme-color" content={siteTheme.primary} />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className={`${notoThai.className} min-h-full flex flex-col`}>
        <ThemeProvider>
          <SiteBrandProvider initialTheme={siteTheme}>
            <Suspense fallback={null}>
              <NavProgress />
            </Suspense>
            {children}
          </SiteBrandProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
