"use client";
import { LogOut, Settings as SettingsIcon, HelpCircle, Search as SearchIcon, CheckCircle2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "../../../context/AuthProvider";
import { supabase as importedSupabase } from "../../../lib/supabaseClient";

const supabase: any = importedSupabase as any;

export default function TopBar() {
  const { user, signOut } = useAuthContext();
  const initials = (user?.email || "U").slice(0, 1).toUpperCase();
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [search, setSearch] = useState("");
  const [objDone, setObjDone] = useState<number>(0);
  const [objTotal, setObjTotal] = useState<number>(3);

  useEffect(() => {
    try {
      const ls = typeof window !== "undefined" ? window.localStorage : null;
      if (!ls) return;
      setAvatarUrl(ls.getItem("profile_avatar") || "");
    } catch {}
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (!error && data?.avatar_url) setAvatarUrl(data.avatar_url);
      } catch {}
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    const onProfileUpdated = (e: any) => {
      const next = e?.detail?.avatar_url;
      if (typeof next !== 'undefined') {
        setAvatarUrl(next || "");
      } else {
        try {
          const ls = typeof window !== "undefined" ? window.localStorage : null;
          if (ls) setAvatarUrl(ls.getItem("profile_avatar") || "");
        } catch {}
      }
    };
    window.addEventListener('profile:updated', onProfileUpdated);
    return () => window.removeEventListener('profile:updated', onProfileUpdated);
  }, []);
  useEffect(() => {
    // Load onboarding objectives progress (demo: defaults 0/3)
    try {
      const ls = typeof window !== 'undefined' ? window.localStorage : null;
      if (!ls) return;
      const total = parseInt(ls.getItem('onboarding_tasks_total') || '3', 10);
      const done = parseInt(ls.getItem('onboarding_tasks_done') || '0', 10);
      if (!Number.isNaN(total)) setObjTotal(total);
      if (!Number.isNaN(done)) setObjDone(done);
    } catch {}
  }, []);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // placeholder: could navigate to a search page if implemented
      console.log('[TOPBAR] search submitted:', search);
    }
  };

  const objectivesLabel = objDone >= objTotal ? 'All objectives completed' : `${objDone}/${objTotal} objectives`;

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Left: Global search */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative w-full max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search anything..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
        </div>

        {/* Right: Objectives, Help (icon), Settings (icon), Logout, Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${objDone >= objTotal ? 'bg-green-50 border-green-200 text-green-700' : 'bg-neutral-50 border-neutral-200 text-neutral-700'}`}>
            <CheckCircle2 className={`h-4 w-4 ${objDone >= objTotal ? 'text-green-600' : 'text-neutral-600'}`} />
            <span>{objectivesLabel}</span>
          </div>
          <Link href="/help" className="h-9 w-9 grid place-content-center rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50" title="Help">
            <HelpCircle className="h-4 w-4" />
          </Link>
          <Link href="/settings/profile" className="h-9 w-9 grid place-content-center rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50" title="Settings">
            <SettingsIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={() => signOut()}
            className="h-9 w-9 grid place-content-center rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-9 w-9 rounded-full object-cover border border-neutral-200" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-neutral-100 border border-neutral-200 grid place-content-center text-xs text-neutral-700">
              <span className="font-medium">{initials}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
