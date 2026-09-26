import Link from "next/link";

import { Button } from "@/components/ui/button";
import { avatarUrl } from "@/lib/avatar";
import { getCurrentProfile } from "@/lib/auth/session";
import { siteConfig } from "@/lib/site";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { type AccountSummary, UserMenu } from "./user-menu";

export async function SiteHeader() {
  const current = await getCurrentProfile();
  const account: AccountSummary | null = current
    ? {
        id: current.userId,
        name: current.profile.display_name,
        avatarUrl: avatarUrl(current.profile.avatar_path),
      }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {siteConfig.mainNav.map((item) => (
            <Button key={item.href} variant="ghost" size="sm" asChild>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {account ? (
            <UserMenu account={account} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
        <div className="ml-auto md:hidden">
          <MobileNav account={account} />
        </div>
      </div>
    </header>
  );
}
