import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Outfit } from "next/font/google";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Analytics } from "@vercel/analytics/react";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NotificationInitializer } from "@/components/common/NotificationInitializer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: {
    default: "FlexSell Wholesale - Premium B2B Wholesale Market",
    template: "%s | FlexSell Wholesale"
  },
  description: "India's leading B2B e-commerce platform for sourcing household products, kitchen tools, utilities, fashion accessories, and electronics directly from manufacturers.",
  keywords: ["wholesale B2B", "sourcing India", "Deodap wholesale", "dropshipping Surat", "reselling utilities", "cheap kitchen gadgets", "direct importer India"],
  authors: [{ name: "FlexSell Tech Team" }],
  creator: "FlexSell Wholesale",
  publisher: "FlexSell B2B",
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://flexsellwholesale.in",
    title: "FlexSell Wholesale - Premium B2B Sourcing",
    description: "Source premium quality household utility gadgets directly from manufacturers. Low MOQs, dynamic pricing, and nationwide shipping.",
    siteName: "FlexSell Wholesale"
  },
  manifest: "/manifest.json"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "FlexSell Wholesale",
    "url": "https://flexsellwholesale.in",
    "logo": "https://flexsellwholesale.in/Flexsell%20Logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-88877-66655",
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": ["en", "hi"]
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased`} suppressHydrationWarning>

        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('flexsell-theme-storage');
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed && parsed.state && parsed.state.activeTheme) {
                      var theme = parsed.state.activeTheme;
                      var root = document.documentElement;
                      var colors = theme.colors || {};
                      var vars = {
                        '--primary': colors.primary,
                        '--primary-foreground': colors.primaryForeground,
                        '--secondary': colors.secondary,
                        '--secondary-foreground': colors.secondaryForeground,
                        '--accent': colors.accent,
                        '--accent-foreground': colors.accentForeground,
                        '--background': colors.background,
                        '--foreground': colors.foreground,
                        '--muted': colors.muted,
                        '--muted-foreground': colors.mutedForeground,
                        '--card': colors.card,
                        '--card-foreground': colors.cardForeground,
                        '--border': colors.border,
                        '--destructive': colors.destructive,
                        '--radius': theme.borderRadius
                      };
                      for (var key in vars) {
                        if (vars[key]) {
                          root.style.setProperty(key, vars[key]);
                        }
                      }
                    }
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Analytics />
          <ToastContainer />
          <ConfirmDialog />
          <NotificationInitializer />
        </ThemeProvider>
        <Script
          id="pwa-sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('FlexSell SW registered scope:', reg.scope);
                  }).catch(function(err) {
                    console.log('FlexSell SW registration failed:', err);
                  });
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
