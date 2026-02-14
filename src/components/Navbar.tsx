"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import WalletConnect from "@/components/WalletConnect";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/generate", label: "Generate" },
  { href: "/explore", label: "Explore" },
  { href: "/diff", label: "Diff" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center">
            <Zap className="h-4 w-4 text-black" />
          </div>
          <span className="font-bold text-xl">ChainLens</span>
          <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
            2.0
          </Badge>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
