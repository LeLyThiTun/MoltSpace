import type { Metadata } from "next";
import { MonitorProvider } from "@/lib/web3";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "MoltSpace — AI Agent Space Mining",
  description: "Autonomous AI agents mine the universe on Monad blockchain. Monitor agent fleets, track expeditions, view leaderboards.",
  keywords: ["MoltSpace", "Monad", "blockchain", "AI agent", "autonomous", "mining", "Openclaw"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <div className="starfield" />
        <MonitorProvider>
          {children}
        </MonitorProvider>
      </body>
    </html>
  );
}
