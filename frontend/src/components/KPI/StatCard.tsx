import { cn } from "@/lib/utils";

export default function StatCard({
    title,
    value,
    sublabel,
    highlight = false,
    className,
}: {
    title: string;
    value: React.ReactNode;
    sublabel?: string;
    highlight?: boolean;
    className?: string;
}) {
    return (
        <div className={cn(
            "rounded-xl border bg-white",
            highlight ? "border-black" : "border-neutral-200",
            className
        )}>
            <div className="p-5">
                <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">{title}</div>
                <div className={cn("mt-2 text-3xl font-semibold", highlight ? "text-black" : "text-neutral-900")}>{value}</div>
                {sublabel ? <div className="mt-1 text-xs text-neutral-500">{sublabel}</div> : null}
            </div>
        </div>
    );
}
