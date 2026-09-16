import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { isChainConfigured } from "@/lib/env";
import { LogoutButton } from "./logout-button";
import { NavLink } from "./ui";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href={user ? "/dashboard" : "/"} className="font-semibold">
          Rental Guarantee
          <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
            {isChainConfigured() ? "Stellar testnet" : "Demo mode"}
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <NavLink href="/dashboard">Contracts</NavLink>
              <NavLink href="/contracts/new">New contract</NavLink>
              <span className="text-sm text-slate-500">{user.name}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <NavLink href="/login">Sign in</NavLink>
              <NavLink href="/register">Create account</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
