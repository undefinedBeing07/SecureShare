import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureShare | Cloud Storage & Secure File Transfer",
  description: "Enterprise cloud storage with real-time heuristic malware inspection, granular link access permissions, and zero-trust distribution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8F9FA] text-slate-900 antialiased selection:bg-purple-100 selection:text-purple-900 font-sans">
        {children}
      </body>
    </html>
  );
}
