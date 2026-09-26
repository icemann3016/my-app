"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/lib/site";
import type { AccountSummary } from "./user-menu";

const linkClass = "rounded-md px-3 py-2 text-base hover:bg-accent";

export function MobileNav({ account }: { account: AccountSummary | null }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{siteConfig.name}</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
          {siteConfig.mainNav.map((item) => (
            <SheetClose key={item.href} asChild>
              <Link href={item.href} className={linkClass}>
                {item.label}
              </Link>
            </SheetClose>
          ))}
          {account && (
            <>
              <SheetClose asChild>
                <Link href="/dashboard" className={linkClass}>
                  Dashboard
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link href="/account" className={linkClass}>
                  Account
                </Link>
              </SheetClose>
            </>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t p-4">
          {account ? (
            <>
              <div className="flex items-center gap-3 px-1 pb-2">
                <UserAvatar name={account.name} url={account.avatarUrl} size={32} />
                <span className="truncate text-sm font-medium">{account.name}</span>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="outline" className="w-full">
                  Log out
                </Button>
              </form>
            </>
          ) : (
            <>
              <SheetClose asChild>
                <Button variant="outline" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild>
                  <Link href="/signup">Sign up</Link>
                </Button>
              </SheetClose>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
