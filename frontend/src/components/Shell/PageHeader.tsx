import { cn } from "@/lib/utils";

export default function PageHeader({
    title,
    subtitle,
    actions,
    className,
}: {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("mb-6 flex items-start justify-between", className)}>
            <div>
                <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
                {subtitle ? (
                    <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
                ) : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
    );
}
