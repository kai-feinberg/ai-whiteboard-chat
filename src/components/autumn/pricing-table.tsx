import React from "react";

import { useCustomer, usePricingTable, ProductDetails } from "autumn-js/react";
import { createContext, useContext, useState } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import CheckoutDialog from "~/components/autumn/checkout-dialog";
import { getPricingTableContent } from "~/lib/autumn/pricing-table-content";
import type { Product, ProductItem } from "autumn-js";
import { Loader2 } from "lucide-react";

export default function PricingTable({
  productDetails,
}: {
  productDetails?: ProductDetails[];
}) {
  const { customer, checkout } = useCustomer({ errorOnNotFound: false });

  const [isAnnual, setIsAnnual] = useState(false);
  const { products, isLoading, error } = usePricingTable({ productDetails });

  if (isLoading) {
    return (
      <div className="w-full h-full flex justify-center items-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div> Something went wrong...</div>;
  }

  const intervals = Array.from(
    new Set(
      products?.map((p) => p.properties?.interval_group).filter((i) => !!i)
    )
  );

  const multiInterval = intervals.length > 1;

  const intervalFilter = (product: Product) => {
    if (!product.properties?.interval_group) {
      return true;
    }

    if (multiInterval) {
      if (isAnnual) {
        return product.properties?.interval_group === "year";
      } else {
        return product.properties?.interval_group === "month";
      }
    }

    return true;
  };

  return (
    <div className={cn("root")}>
      {products && (
        <PricingTableContainer
          products={products}
          isAnnualToggle={isAnnual}
          setIsAnnualToggle={setIsAnnual}
          multiInterval={multiInterval}
        >
          {products.filter(intervalFilter).map((product, index) => (
            <PricingCard
              key={index}
              productId={product.id}
              buttonProps={{
                disabled:
                  (product.scenario === "active" &&
                    !product.properties.updateable) ||
                  product.scenario === "scheduled",

                onClick: async () => {
                  if (product.id && customer) {
                    await checkout({
                      productId: product.id,
                      dialog: CheckoutDialog,
                    });
                  } else if (product.display?.button_url) {
                    window.open(product.display?.button_url, "_blank");
                  }
                },
              }}
            />
          ))}
        </PricingTableContainer>
      )}
    </div>
  );
}

const PricingTableContext = createContext<{
  isAnnualToggle: boolean;
  setIsAnnualToggle: (isAnnual: boolean) => void;
  products: Product[];
  showFeatures: boolean;
}>({
  isAnnualToggle: false,
  setIsAnnualToggle: () => {},
  products: [],
  showFeatures: true,
});

export const usePricingTableContext = (componentName: string) => {
  const context = useContext(PricingTableContext);

  if (context === undefined) {
    throw new Error(`${componentName} must be used within <PricingTable />`);
  }

  return context;
};

export const PricingTableContainer = ({
  children,
  products,
  showFeatures = true,
  className,
  isAnnualToggle,
  setIsAnnualToggle,
  multiInterval,
}: {
  children?: React.ReactNode;
  products?: Product[];
  showFeatures?: boolean;
  className?: string;
  isAnnualToggle: boolean;
  setIsAnnualToggle: (isAnnual: boolean) => void;
  multiInterval: boolean;
}) => {
  if (!products) {
    throw new Error("products is required in <PricingTable />");
  }

  if (products.length === 0) {
    return <></>;
  }

  const hasRecommended = products?.some((p) => p.display?.recommend_text);
  return (
    <PricingTableContext.Provider
      value={{ isAnnualToggle, setIsAnnualToggle, products, showFeatures }}
    >
      <div
        className={cn(
          "flex items-center flex-col",
          hasRecommended && "!py-10"
        )}
      >
        {multiInterval && (
          <div
            className={cn(
              products.some((p) => p.display?.recommend_text) && "mb-8"
            )}
          >
            <AnnualSwitch
              isAnnualToggle={isAnnualToggle}
              setIsAnnualToggle={setIsAnnualToggle}
            />
          </div>
        )}
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-3 w-full gap-6 max-w-6xl mx-auto",
            className
          )}
        >
          {children}
        </div>
      </div>
    </PricingTableContext.Provider>
  );
};

interface PricingCardProps {
  productId: string;
  showFeatures?: boolean;
  className?: string;
  onButtonClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  buttonProps?: React.ComponentProps<"button">;
}

export const PricingCard = ({
  productId,
  className,
  buttonProps,
}: PricingCardProps) => {
  const { products, showFeatures } = usePricingTableContext("PricingCard");

  const product = products.find((p) => p.id === productId);

  if (!product) {
    throw new Error(`Product with id ${productId} not found`);
  }

  const { name, display: productDisplay } = product;

  const { buttonText } = getPricingTableContent(product);

  const isRecommended = productDisplay?.recommend_text ? true : false;
  const mainPriceDisplay = product.properties?.is_free
    ? {
        primary_text: "Free",
      }
    : product.items[0].display;

  const featureItems = product.properties?.is_free
    ? product.items
    : product.items.slice(1);

  return (
    <div
      className={cn(
        "w-full h-full py-8 px-8 border rounded-lg shadow-sm",
        isRecommended
          ? "bg-primary text-primary-foreground"
          : "bg-background text-foreground",
        className
      )}
    >
      <div className="flex flex-col h-full">
        <div className="h-full">
          <div className="flex flex-col">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">
                {productDisplay?.name || name}
              </h2>
              {productDisplay?.description && (
                <p className={cn(
                  "text-sm",
                  isRecommended ? "opacity-90" : "text-muted-foreground"
                )}>
                  {productDisplay?.description}
                </p>
              )}
            </div>
            <div className="mb-8">
              <div className="text-5xl font-bold mb-2">
                {mainPriceDisplay?.primary_text}
              </div>
              {mainPriceDisplay?.secondary_text && (
                <div className={cn(
                  isRecommended ? "opacity-90" : "text-muted-foreground"
                )}>
                  {mainPriceDisplay?.secondary_text}
                </div>
              )}
            </div>
          </div>
          <div className="mb-8">
            <PricingCardButton
              recommended={isRecommended}
              {...buttonProps}
            >
              {productDisplay?.button_text || buttonText}
            </PricingCardButton>
          </div>
          {showFeatures && featureItems.length > 0 && (
            <div className="flex-grow">
              <PricingFeatureList
                items={featureItems}
                everythingFrom={product.display?.everything_from}
                isRecommended={isRecommended}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Pricing Feature List
export const PricingFeatureList = ({
  items,
  everythingFrom,
  className,
  isRecommended = false,
}: {
  items: ProductItem[];
  everythingFrom?: string;
  className?: string;
  isRecommended?: boolean;
}) => {
  return (
    <div className={cn("flex-grow", className)}>
      {everythingFrom && (
        <p className="text-sm mb-4">
          Everything from {everythingFrom}, plus:
        </p>
      )}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-3"
          >
            <svg
              className={cn(
                "w-5 h-5 shrink-0 mt-0.5",
                isRecommended ? "opacity-90" : "text-muted-foreground"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex flex-col">
              <span>{item.display?.primary_text}</span>
              {item.display?.secondary_text && (
                <span className={cn(
                  "text-sm",
                  isRecommended ? "opacity-75" : "text-muted-foreground"
                )}>
                  {item.display?.secondary_text}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Pricing Card Button
export interface PricingCardButtonProps extends React.ComponentProps<"button"> {
  recommended?: boolean;
  buttonUrl?: string;
}

export const PricingCardButton = React.forwardRef<
  HTMLButtonElement,
  PricingCardButtonProps
>(({ recommended, children, className, onClick, ...props }, ref) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    setLoading(true);
    try {
      await onClick?.(e);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      className={cn(
        "w-full py-3 px-4 rounded-full font-medium transition-colors",
        recommended
          ? "bg-background text-foreground hover:bg-background/90"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        className
      )}
      {...props}
      variant="ghost"
      ref={ref}
      disabled={loading || props.disabled}
      onClick={handleClick}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        children
      )}
    </Button>
  );
});
PricingCardButton.displayName = "PricingCardButton";

// Annual Switch
export const AnnualSwitch = ({
  isAnnualToggle,
  setIsAnnualToggle,
}: {
  isAnnualToggle: boolean;
  setIsAnnualToggle: (isAnnual: boolean) => void;
}) => {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-full mb-8">
      <button
        onClick={() => setIsAnnualToggle(false)}
        className={cn(
          "px-6 py-2 rounded-full text-sm font-medium transition-colors",
          !isAnnualToggle
            ? "bg-background shadow-sm"
            : "text-muted-foreground"
        )}
      >
        Monthly
      </button>
      <button
        disabled
        className="px-6 py-2 rounded-full text-sm font-medium text-muted-foreground cursor-not-allowed opacity-60"
      >
        <div className="flex flex-col items-center leading-tight">
          <span className="text-xs">Coming</span>
          <span className="text-xs">Soon</span>
        </div>
      </button>
    </div>
  );
};

export const RecommendedBadge = ({ recommended }: { recommended: string }) => {
  return (
    <div className="bg-secondary absolute border text-muted-foreground text-sm font-medium lg:rounded-full px-3 lg:py-0.5 lg:top-4 lg:right-4 top-[-1px] right-[-1px] rounded-bl-lg">
      {recommended}
    </div>
  );
};
