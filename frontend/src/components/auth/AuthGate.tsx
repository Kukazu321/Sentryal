"use client";

import React, { useEffect } from "react";
import { useAuthContext } from "../../../context/AuthProvider";
import { usePathname, useRouter } from "next/navigation";

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();

    const isPublic = pathname === "/" || pathname?.startsWith("/auth");

    useEffect(() => {
        if (!loading && !user && !isPublic) {
            const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
            router.replace(`/auth/login${next}`);
        }
    }, [loading, user, isPublic, router, pathname]);

    if (isPublic) return <>{children}</>;

    if (loading) {
        return (
            <div className="min-h-[50vh] grid place-content-center text-neutral-600">Loading…</div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-[50vh] grid place-content-center text-neutral-600">Redirecting…</div>
        );
    }

    return <>{children}</>;
}
