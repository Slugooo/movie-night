import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Movie Night",
  description: "A tiny party-game prototype for picking tonight's movie.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
