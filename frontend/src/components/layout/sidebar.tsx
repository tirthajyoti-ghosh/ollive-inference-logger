"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  MessageSquare,
  List,
  BarChart3,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/conversations", label: "Conversations", icon: List },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
] as const;

function NavLinks({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar — always visible at md+ */
function DesktopSidebar() {
  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-sidebar-border bg-sidebar shrink-0 h-screen sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/15">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Ollive</span>
      </div>

      {/* Links */}
      <div className="flex-1 px-3">
        <NavLinks />
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-[11px] text-muted-foreground">Inference Logger</p>
      </div>
    </aside>
  );
}

/** Mobile slide-out sidebar */
function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden fixed top-0 left-0 z-40 p-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="inline-flex items-center justify-center rounded-lg h-9 w-9 hover:bg-muted transition-colors"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/15">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Ollive</span>
          </div>
          <div className="px-3 py-4">
            <NavLinks onClick={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}
