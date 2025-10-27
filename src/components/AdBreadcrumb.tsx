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
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <>
              <BreadcrumbItem key={segment.label}>
                {isLast ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : segment.href ? (
                  <BreadcrumbLink asChild>
                    <Link to={segment.href}>{segment.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground">{segment.label}</span>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator key={`sep-${index}`} />}
            </>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
