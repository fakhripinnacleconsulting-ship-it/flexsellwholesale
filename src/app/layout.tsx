import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Outfit } from "next/font/google";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Analytics } from "@vercel/analytics/react";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NotificationInitializer } from "@/components/common/NotificationInitializer";
import { generateOrganizationSchema, generateWebSiteSchema, generateLocalBusinessSchema } from "@/lib/seo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: {
    default: "FlexSell Wholesale - B2B Wholesale Market",
    template: "%s | FlexSell Wholesale"
  },
  description: "India's leading B2B e-commerce platform for sourcing household products, kitchen tools, utilities, fashion accessories, and electronics directly from manufacturers.",
  keywords: ["wholesale B2B", "sourcing India", "Deodap wholesale", "dropshipping Bhopal", "reselling utilities", "cheap kitchen gadgets", "direct importer India"],
  authors: [{ name: "FlexSell Tech Team" }],
  creator: "FlexSell Wholesale",
  publisher: "FlexSell B2B",
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: [
      { url: "/Favicon.png", type: "image/png" },
      { url: "/Flexsell%20Logo.png", type: "image/png" }
    ],
    shortcut: ["/Favicon.png"],
    apple: [{ url: "/Favicon.png", sizes: "180x180", type: "image/png" }]
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "FlexSell Wholesale",
    statusBarStyle: "default"
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://flexsellwholesale.in",
    title: "FlexSell Wholesale - B2B Sourcing",
    description: "Source quality household utility gadgets directly from manufacturers. Low MOQs, dynamic pricing, and nationwide shipping.",
    siteName: "FlexSell Wholesale"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSchema = generateOrganizationSchema();
  const websiteSchema = generateWebSiteSchema();
  const localBusinessSchema = generateLocalBusinessSchema();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/Favicon.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="/Favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/Favicon.png" />
        <meta name="theme-color" content="#059669" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        {/* Google Tag Manager */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-T73FGQ88');`,
          }}
        />
        {/* End Google Tag Manager */}
      </head>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased`} suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T73FGQ88" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          }}
        />
        {/* End Google Tag Manager (noscript) */}

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
