import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "China Outbound Enterprise Lead Intelligence Platform",
  description: "Enterprise lead intelligence and qualification system for outbound-China BD, consulting, tax, and compliance teams."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
