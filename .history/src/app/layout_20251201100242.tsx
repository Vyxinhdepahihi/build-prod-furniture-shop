'use client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Libre_Bodoni } from "next/font/google";
import { usePathname } from 'next/navigation';
import BootstrapClient from './BootstrapClient';
import Header from './component/Header';
import HomeButton from './component/HomeButton';
import Footer from './component/Footer';
import { SocketProvider } from '@/contexts/SocketContext';
// import DebugAuth from './component/DebugAuth';

const didotFont = Libre_Bodoni({
  variable: "--font-didot",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  // Các trang không hiển thị Header và Footer
  const noLayoutPages = ['/login', '/register', '/auth'];
  const isNoLayoutPage = noLayoutPages.includes(pathname);

  return (
    <html lang="en">
      <head>
        {/* Bootstrap Icons CDN Backup */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
      </head>
      <body className={didotFont.variable} style={{ fontFamily: 'var(--font-didot), Didot, "Bodoni MT", "Libre Bodoni", serif' }}>
        <SocketProvider>
          <BootstrapClient />
          {!isNoLayoutPage && <Header />}
          {children}
          {!isNoLayoutPage && <Footer />}
          {!isNoLayoutPage && <HomeButton />}
          {/* <DebugAuth /> */}
        </SocketProvider>
      </body>
    </html>
  );
}
