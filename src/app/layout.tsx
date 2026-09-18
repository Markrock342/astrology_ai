import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { APP_NAME_TH, APP_TAGLINE_TH } from "@/config/constants";
import { ThemeProvider } from "@/components/theme-provider";
import { TextSizeProvider } from "@/components/text-size-provider";
import { SiteBrandProvider } from "@/components/site-brand-provider";
import { NavProgress } from "@/components/app/nav-progress";
import { CMS_KEYS, type CmsSiteTheme } from "@/lib/cms-keys";
import { buildSiteBrandBootPayload } from "@/lib/theme-colors";
import { getPublishedSetting } from "@/server/settings/settings-service";

const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  // font-bold is unused; 300 (display) → 600 (labels) covers the whole UI.
  weight: ["300", "400", "500", "600"],
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
    icon: [{ url: "/logo.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/logo.png", sizes: "512x512", type: "image/png" }],
  },
};

function buildThemeBootScript(brandJson: string) {
  // Also applies the reader's text size before first paint, so an enlarged
  // page never flashes at the default size first.
  return `(function(){try{var s=localStorage.getItem("hora-text-size");var scale=s==="large"?1.25:s==="medium"?1.125:1;document.documentElement.dataset.textSize=s||"small";document.documentElement.style.fontSize=(16*scale).toFixed(2)+"px";}catch(e){}try{var t=localStorage.getItem("hora-theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;var brand=${brandJson};if(brand&&brand.enabled){var vars=t==="light"?brand.light:brand.dark;var r=document.documentElement;for(var k in vars)if(Object.prototype.hasOwnProperty.call(vars,k))r.style.setProperty(k,vars[k]);}}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.colorScheme="dark";}})();`;
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
          <TextSizeProvider>
          <SiteBrandProvider initialTheme={siteTheme}>
            <Suspense fallback={null}>
              <NavProgress />
            </Suspense>
            {children}
          </SiteBrandProvider>
          </TextSizeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
