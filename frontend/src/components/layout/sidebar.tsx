"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  List,
  BarChart3,
  Menu,
  Zap,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/conversations", label: "Conversations", icon: List },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
] as const;

function NavContent() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-8">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
            <Zap className="h-[18px] w-[18px] text-primary" />
            <div className="absolute inset-0 rounded-xl glow-amber-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Ollive
            </span>
            <span className="block text-[10px] font-medium text-muted-foreground tracking-widest uppercase">
              Inference Logger
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
                transition-all duration-200
                ${
                  isActive
                    ? "text-primary bg-primary/[0.08] nav-active-bar"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                }
              `}
            >
              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
              {item.label}
              {isActive && (
                <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-primary pulse-live" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-5 border-t border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 pulse-live" />
          <span className="text-[11px] text-muted-foreground font-medium">
            System Online
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl glass"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <div className="w-64 h-full bg-sidebar border-r border-sidebar-border">
          <NavContent />
        </div>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col border-r border-border/40 bg-sidebar/50 backdrop-blur-sm sticky top-0 h-screen">
        <NavContent />
      </aside>
    </>
  );
}
