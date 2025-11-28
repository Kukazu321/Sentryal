"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
    { href: "/settings/profile", label: "My details" },
    { href: "/settings/password", label: "Password" },
    { href: "/settings/team", label: "Team" },
    { href: "/settings/billings", label: "Billings" },
    { href: "/settings/plan", label: "Plan" },
    { href: "/settings/email", label: "Email" },
    { href: "/settings/notifications", label: "Notifications" },
];

export default function SettingsTabNav() {
    const pathname = usePathname();
    return (
        <div className="border-b border-neutral-200">
            <div className="max-w-7xl mx-auto px-2 sm:px-8">
                <nav className="flex gap-1 overflow-x-auto">
                    {tabs.map((t) => {
                        const active = pathname?.startsWith(t.href);
                        return (
                            <Link
                                key={t.href}
                                href={t.href}
                                className={`px-3 sm:px-4 py-3 text-sm rounded-t-md ${active
                                        ? "bg-white border-x border-t border-neutral-200 -mb-px text-neutral-900 font-semibold"
                                        : "text-neutral-600 hover:text-neutral-900"
                                    }`}
                            >
                                {t.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
