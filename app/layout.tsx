import type { Metadata } from "next";
import { DM_Mono, Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./backend.css";

const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-dm-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], weight: ["500", "600"], display: "swap", variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "BlueHaven AI World — An operating world for intelligent work",
  description: "Build, orchestrate and operate AI projects in a living 3D world. One workspace for agents, company operations and connected publishing.",
  applicationName: "BlueHaven AI World",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${manrope.variable} ${dmMono.variable} ${playfair.variable}`}>{children}</body></html>;
}
