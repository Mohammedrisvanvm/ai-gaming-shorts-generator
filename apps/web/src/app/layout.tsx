import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Gaming Shorts",
  description: "Local-first gaming highlight review and Shorts creation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
