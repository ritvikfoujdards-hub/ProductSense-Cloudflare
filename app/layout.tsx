import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: 'ProductSense — Command Center for Cloudflare PMs',
  description: 'AI-powered signal intelligence that transforms raw customer feedback into prioritised, actionable product decisions.',
  metadataBase: new URL('https://productsense.ritvikfoujdar31.workers.dev'),
  openGraph: {
    title: 'ProductSense — Command Center for Cloudflare PMs',
    description: 'AI-powered signal intelligence that transforms raw customer feedback into prioritised, actionable product decisions.',
    type: 'website',
    url: 'https://productsense.ritvikfoujdar31.workers.dev',
    siteName: 'ProductSense by Cloudflare',
  },
  twitter: {
    card: 'summary',
    title: 'ProductSense — Command Center for Cloudflare PMs',
    description: 'AI-powered signal intelligence that transforms raw customer feedback into prioritised, actionable product decisions.',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-background">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
