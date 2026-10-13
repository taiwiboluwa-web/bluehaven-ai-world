import type { Metadata } from "next";
import "./globals.css";
import "./backend.css";

export const metadata: Metadata = {
  title: "BlueHaven AI World — Build beyond limits",
  description: "An immersive village where AI projects become living buildings and builder agents bring them to life.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
