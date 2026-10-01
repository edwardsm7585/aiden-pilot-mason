import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@upstart13-com/aiden-ui";
import { ThemeProvider } from "@upstart13-com/aiden-ui/layout/theme-provider";
import { aidenConfig } from "@/../aiden.config";
import { brand } from "@/config/brand";
import "@/lib/styles.css";

const interSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: brand.name,
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? aidenConfig.app.description,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Per-request CSP nonce from src/proxy.ts (security finding F5). Reading
  // headers() also makes every page render per request, which nonces need.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider nonce={nonce}>
          {children}
          {/* Once, at the root (DS 07): auth pages need it for sign-in errors. */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
