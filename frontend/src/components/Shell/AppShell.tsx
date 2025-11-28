"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, Map, BarChart3, Bell, FileText, FolderTree, PlusSquare, Settings, Sparkles } from "lucide-react";
import TopBar from "@/components/Shell/TopBar";
import AuthGate from "@/components/auth/AuthGate";

const items = [
    { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
    { href: "/map", icon: Map, label: "Map" },
    { href: "/infrastructures", icon: FolderTree, label: "Infrastructures" },
    { href: "/analyses", icon: Sparkles, label: "Analyses" },
    { href: "/onboarding", icon: PlusSquare, label: "Onboarding" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/alerts", icon: Bell, label: "Alerts" },
    { href: "/reports", icon: FileText, label: "Reports" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // Only render the application shell on specific app routes
    const appRoots = [
        "/dashboard",
        "/map",
        "/infrastructures",
        "/analyses",
        "/onboarding",
        "/analytics",
        "/alerts",
        "/reports",
        "/settings",
        "/infrastructure", // dynamic routes like /infrastructure/[id]/...
    ];
    const isAppRoute = appRoots.some((r) => pathname?.startsWith(r));
    if (!isAppRoute) {
        return <>{children}</>;
    }
    return (
        <div className="min-h-screen w-full bg-white text-neutral-900">
            <div className="fixed inset-y-0 left-0 w-20 bg-white text-neutral-700 border-r border-neutral-200 flex flex-col items-center py-6 gap-6 z-40">
                <div className="h-12 w-12 rounded-xl border border-neutral-300 grid place-content-center overflow-hidden bg-neutral-50">
                    <Image src="/media/logosentryalnobgblack.png" alt="Sentryal" width={32} height={32} className="h-8 w-8 object-contain" />
                </div>
                <nav className="flex-1 flex flex-col gap-2">
                    {items.map((it) => {
                        const active = pathname?.startsWith(it.href);
                        const Icon = it.icon;
                        return (
                            <Link key={it.href} href={it.href} className={cn("group relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl transition-colors", active ? "bg-black text-white" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100")}>
                                <Icon className="h-5 w-5" />
                                <span className="pointer-events-none absolute left-16 whitespace-nowrap rounded-md bg-white border border-neutral-200 px-2 py-1 text-xs text-neutral-900 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">{it.label}</span>
                            </Link>
                        );
                    })}
                </nav>
                <Link href="/settings/profile" className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">
                    <Settings className="h-5 w-5" />
                </Link>
            </div>
            <div className="pl-20">
                <TopBar />
                <main className="min-h-screen p-8">
                    <AuthGate>
                        {children}
                    </AuthGate>
                </main>
            </div>
        </div>
    );
}
