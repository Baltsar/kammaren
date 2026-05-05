import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KAMMAREN Watcher — onboarding',
  description:
    'Regulatoriska notiser för svenska aktiebolag. Skatteverket, Riksdagen m.fl. Direkt i Telegram. Gratis under stängd beta.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="sv">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
