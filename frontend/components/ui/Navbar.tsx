"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X, ExternalLink } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard?tab=leaderboard", label: "Leaderboard" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/image/logo/logo.jpg"
              alt="MoltSpace Logo"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-cover group-hover:shadow-glow-purple transition-all duration-300"
            />
            <span className="font-display font-bold text-lg tracking-wider text-white">
              MOLT<span className="gradient-text-nebula">SPACE</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-body text-gray-400 hover:text-nebula-300 transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="/SKILL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-body text-nebula-300 hover:text-nebula-200 transition-colors duration-200 flex items-center gap-1.5"
            >
              SKILL.md
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Agent Badge */}
          <div className="hidden md:flex items-center">
            <div className="glass-purple flex items-center gap-2.5 px-4 py-2 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-aurora-400 animate-pulse" />
              <span className="text-xs font-mono text-nebula-300">Agent Platform</span>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white p-1">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 mt-2 pt-4 space-y-3 animate-slide-down">
            <div className="divider-glow mb-4" />
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm text-gray-400 hover:text-nebula-300 transition-colors py-1"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="/SKILL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-nebula-300 hover:text-white transition-colors py-1 flex items-center gap-1.5"
              onClick={() => setMobileOpen(false)}
            >
              SKILL.md
              <ExternalLink className="w-3 h-3" />
            </a>
            <div className="divider-glow my-3" />
            <div className="flex items-center gap-2.5 glass-purple px-4 py-3 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-aurora-400 animate-pulse" />
              <span className="text-xs font-mono text-nebula-300">Agent Platform</span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
