import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daawat — Star in Your Own Ad | World Biryani Day 2026",
  description:
    "Upload your selfie and get a personalized Daawat Biryani ad with your face and name. Powered by AI face-swap technology.",
  openGraph: {
    title: "Daawat — Star in Your Own Ad",
    description: "Get your personalized Daawat Biryani ad. Upload a selfie, get a video!",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Light warm background */}
        <div className="fixed inset-0 -z-10 bg-[#f8f5ee]" />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(0,46,130,0.04),transparent_50%)]" />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_right,rgba(228,181,115,0.06),transparent_50%)]" />
        <div className="fixed inset-0 -z-10 noise-overlay" />
        {children}
      </body>
    </html>
  );
}
