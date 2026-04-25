import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Break The System",
  description: "Pairwise hackathon judging for fast, in-room mobile evaluation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(255,197,110,0.32),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,145,77,0.2),transparent_28%),linear-gradient(180deg,#fffef8_0%,#fff6e9_46%,#fff1d3_100%)] text-stone-950">
        {children}
      </body>
    </html>
  );
}
