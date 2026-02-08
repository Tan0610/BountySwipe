"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Create Bounty",
    href: "/create",
  },
  {
    label: "My Bounties",
    href: "/my-bounties",
  },
];

/* ── Desktop nav links ── */
export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              className={`
                relative font-mono text-xs uppercase tracking-[0.1em] px-3 py-2
                text-[#F2EBF9]/70 hover:text-[#F2EBF9] transition-colors duration-200
                ${isActive ? "text-[#F2EBF9]" : ""}
              `}
            >
              {label}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-px bg-[#6E54FF]" />
              )}
            </Link>
          </li>
        );
      })}
    </>
  );
};

/* ── Mobile slide-in menu ── */
const MobileMenu = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(menuRef as React.RefObject<HTMLElement>, onClose);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300
          ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
        onClick={onClose}
      />
      {/* Slide-in panel */}
      <div
        ref={menuRef}
        className={`
          fixed top-0 right-0 z-50 h-full w-64 bg-[#0E091C] border-l border-white/10
          transform transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-5 h-12">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-[#F2EBF9]/50">
            Menu
          </span>
          <button onClick={onClose} className="p-1 text-[#F2EBF9]/70 hover:text-[#F2EBF9]">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="px-5 pt-4">
          <ul className="flex flex-col gap-1">
            {menuLinks.map(({ label, href }) => {
              const isActive = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={`
                      block font-mono text-sm uppercase tracking-[0.08em] px-3 py-3
                      rounded-lg transition-colors duration-200
                      ${
                        isActive
                          ? "text-[#F2EBF9] bg-[#6E54FF]/10 border-l-2 border-[#6E54FF]"
                          : "text-[#F2EBF9]/60 hover:text-[#F2EBF9] hover:bg-white/5"
                      }
                    `}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
};

/**
 * Site header — Monad-style minimal nav
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05050B]/90 backdrop-blur-md">
      {/* Desktop: 80px, Mobile: 48px */}
      <div className="mx-auto flex h-12 lg:h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* ── Left: Logo ── */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="relative w-8 h-8 lg:w-9 lg:h-9">
            <Image alt="BountySwipe" className="object-contain" fill src="/logo.svg" />
          </div>
          <span className="font-bold text-white text-base lg:text-lg tracking-tight">
            BountySwipe
          </span>
        </Link>

        {/* ── Center: Desktop nav ── */}
        <nav className="hidden lg:block">
          <ul className="flex items-center gap-1">
            <HeaderMenuLinks />
          </ul>
        </nav>

        {/* ── Right: Wallet + Mobile hamburger ── */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <RainbowKitCustomConnectButton />
          </div>
          {isLocalNetwork && (
            <div className="hidden sm:block">
              <FaucetButton />
            </div>
          )}
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-1.5 text-[#F2EBF9]/70 hover:text-[#F2EBF9] transition-colors"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile slide-in menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </header>
  );
};
