import type { Metadata } from "next";
// import Image from "next/image";
import Link from "next/link";
// import logo from "./images/Mathbuzz-Logo.png";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flash AnZan",
  description: "Flash mental-arithmetic trainer for classroom presenting.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1">
            <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
              <span className="grid h-12 w-12 place-items-center text-black">暗算</span>
              {/* <Image src={logo} alt="logo" className="h-8 w-8 object-contain" /> */}
              Flash Anzan
            </Link>
            <div className="flex gap-1 text-sm font-semibold">
              {/* <Link href="/" className="rounded-lg px-3 py-2 hover:bg-slate-100">Play</Link>
              <Link href="/profiles" className="rounded-lg px-3 py-2 hover:bg-slate-100">Profiles</Link> */}
               <span className="mr-3 hidden text-s font-medium text-slate-400 sm:inline-block">
                  Mental Math Visualization
                </span>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
