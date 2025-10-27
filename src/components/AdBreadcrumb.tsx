// src/components/AdBreadcrumb.tsx
import { Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbSegment = {
  label: string;
  href?: string;
};

type AdBreadcrumbProps = {
  segments: BreadcrumbSegment[];
};

export function AdBreadcrumb({ segments }: AdBreadcrumbProps) {
  return (
    <Breadcrumb className="mb-2">
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <>
              <BreadcrumbItem key={segment.label}>
                {isLast ? (
                  <BreadcrumbPage className="font-bold text-base border-b-2 border-slate-900 dark:border-slate-100 pb-0.5">
                    {segment.label}
                  </BreadcrumbPage>
                ) : segment.href ? (
                  <BreadcrumbLink asChild>
                    <Link
                      to={segment.href}
                      className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                      {segment.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground font-medium">{segment.label}</span>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator
                  key={`sep-${index}`}
                  className="text-slate-400 dark:text-slate-600"
                />
              )}
            </>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
