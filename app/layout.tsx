import type { Metadata } from "next";
import { Anek_Latin } from "next/font/google";
import "./globals.css";

const anekLatin = Anek_Latin({
  variable: "--font-anek-latin",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dalgo Discovery",
  description: "A grounded assistant that helps NGO leaders evaluate whether Dalgo fits their needs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anekLatin.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
