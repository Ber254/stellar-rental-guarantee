import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { getDictionary } from "@/lib/i18n";
import { getLocale, getTheme } from "@/lib/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = getDictionary(await getLocale());
  return { title: meta.title, description: meta.description };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  const dictionary = getDictionary(locale);

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <I18nProvider locale={locale} dictionary={dictionary}>
          <SiteHeader theme={theme} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
            {children}
          </main>
          <footer className="border-t border-line/60 bg-surface/50 py-6 text-xs text-muted">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
              <span>Safexy · Non-custodial rental guarantees on Stellar (Soroban + USDC)</span>
              <div className="flex items-center gap-4">
                <a
                  href="https://stellar.expert/explorer/testnet/contract/CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono hover:text-fg hover:underline"
                >
                  Contract CCAT2N5J…76LV ↗
                </a>
              </div>
            </div>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
