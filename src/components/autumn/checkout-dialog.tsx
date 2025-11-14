"use client";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import type { CheckoutParams, CheckoutResult, ProductItem } from "autumn-js";
import { ArrowRight, ChevronDown, Loader2, Lock, ShieldCheck } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { useCustomer } from "autumn-js/react";
import { cn } from "~/lib/utils";
import { getCheckoutContent } from "~/lib/autumn/checkout-content";

export interface CheckoutDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	checkoutResult: CheckoutResult;
	checkoutParams?: CheckoutParams;
}

const formatCurrency = ({
	amount,
	currency,
}: {
	amount: number;
	currency: string;
}) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency,
	}).format(amount);
};

export default function CheckoutDialog(params: CheckoutDialogProps) {
	const { attach } = useCustomer();
	const [checkoutResult, setCheckoutResult] = useState<
		CheckoutResult | undefined
	>(params?.checkoutResult);

	useEffect(() => {
		if (params.checkoutResult) {
			setCheckoutResult(params.checkoutResult);
		}
	}, [params.checkoutResult]);

	const [loading, setLoading] = useState(false);

	if (!checkoutResult) {
		return <></>;
	}

	const { open, setOpen } = params;
	const { title, message } = getCheckoutContent(checkoutResult);

	const isFree = checkoutResult?.product.properties?.is_free;
	const isPaid = isFree === false;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="p-0 pt-8 gap-0 text-foreground max-h-[85vh] min-h-[520px] flex flex-col">
				{/* Header with extra breathing room */}
				<div className="px-8 pb-6">
					<DialogTitle className="text-2xl font-bold mb-3">{title}</DialogTitle>
					<div className="text-base text-foreground/70">
						{message}
					</div>
				</div>

				{/* Pricing Details - Card background */}
				<div className="flex-1 overflow-y-auto px-8 pb-6">
					{isPaid && checkoutResult && (
						<div className="bg-muted/40 border border-border/50 rounded-lg p-6">
							<PriceInformation
								checkoutResult={checkoutResult}
								setCheckoutResult={setCheckoutResult}
							/>
						</div>
					)}
				</div>

				{/* Visual divider */}
				<div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-8" />

				{/* Security Badges - Compact */}
				<div className="px-8 py-5">
					<div className="flex items-center justify-center gap-6">
						{/* 256-bit Encryption */}
						<div className="flex items-center gap-2">
							<div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10">
								<Lock className="w-4 h-4 text-green-600 dark:text-green-500" />
							</div>
							<div className="text-xs">
								<div className="font-medium text-foreground">256-bit Encryption</div>
								<div className="text-muted-foreground">Bank-level security</div>
							</div>
						</div>

						{/* Stripe Badge */}
						<div className="flex items-center gap-2">
							<div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10">
								<ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-500" />
							</div>
							<div className="text-xs">
								<div className="font-medium text-foreground">Powered by Stripe</div>
							</div>
						</div>
					</div>
				</div>

				{/* Payment Action Section */}
				<div className="px-8 pb-8">
					<div className="text-center mb-4">
						<p className="text-sm text-muted-foreground">
							We'll charge the card on file for this purchase
						</p>
					</div>

					<Button
						size="lg"
						onClick={async () => {
							setLoading(true);

							const options = checkoutResult.options.map((option) => {
								return {
									featureId: option.feature_id,
									quantity: option.quantity,
								};
							});

							await attach({
								productId: checkoutResult.product.id,
								...(params.checkoutParams || {}),
								options,
							});
							setOpen(false);
							setLoading(false);
						}}
						disabled={loading}
						className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/20"
					>
						{loading ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : (
							<span className="flex items-center gap-2">
								<Lock className="w-4 h-4" />
								Confirm Purchase
							</span>
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function PriceInformation({
	checkoutResult,
	setCheckoutResult,
}: {
	checkoutResult: CheckoutResult;
	setCheckoutResult: (checkoutResult: CheckoutResult) => void;
}) {
	return (
		<div className="px-6 mb-4 flex flex-col gap-4">
			<ProductItems
				checkoutResult={checkoutResult}
				setCheckoutResult={setCheckoutResult}
			/>

			<div className="flex flex-col gap-2">
				{checkoutResult?.has_prorations && checkoutResult.lines.length > 0 && (
					<CheckoutLines checkoutResult={checkoutResult} />
				)}
				<DueAmounts checkoutResult={checkoutResult} />
			</div>
		</div>
	);
}

function DueAmounts({ checkoutResult }: { checkoutResult: CheckoutResult }) {
	const { next_cycle, product } = checkoutResult;
	const nextCycleAtStr = next_cycle
		? new Date(next_cycle.starts_at).toLocaleDateString()
		: undefined;

	const hasUsagePrice = product.items.some(
		(item) => item.usage_model === "pay_per_use",
	);

	const showNextCycle = next_cycle && next_cycle.total !== checkoutResult.total;

	return (
		<div className="flex flex-col gap-3 mt-4 pt-4 border-t-2 border-border">
			<div className="flex justify-between items-center">
				<div>
					<p className="text-sm font-medium text-foreground/70">Total due today</p>
				</div>

				<p className="text-3xl font-bold text-foreground">
					{formatCurrency({
						amount: checkoutResult?.total,
						currency: checkoutResult?.currency,
					})}
				</p>
			</div>
			{showNextCycle && (
				<div className="flex justify-between text-muted-foreground text-sm">
					<div>
						<p>Due next cycle ({nextCycleAtStr})</p>
					</div>
					<p className="font-medium">
						{formatCurrency({
							amount: next_cycle.total,
							currency: checkoutResult?.currency,
						})}
						{hasUsagePrice && <span> + usage prices</span>}
					</p>
				</div>
			)}
		</div>
	);
}

function ProductItems({
	checkoutResult,
	setCheckoutResult,
}: {
	checkoutResult: CheckoutResult;
	setCheckoutResult: (checkoutResult: CheckoutResult) => void;
}) {
	const isUpdateQuantity =
		checkoutResult?.product.scenario === "active" &&
		checkoutResult.product.properties.updateable;

	const isOneOff = checkoutResult?.product.properties.is_one_off;

	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">Price Details</p>
			{checkoutResult?.product.items
				.filter((item) => item.type !== "feature")
				.map((item, index) => {
					if (item.usage_model == "prepaid") {
						return (
							<PrepaidItem
								key={index}
								item={item}
								checkoutResult={checkoutResult!}
								setCheckoutResult={setCheckoutResult}
							/>
						);
					}

					if (isUpdateQuantity) {
						return null;
					}

					return (
						<div key={index} className="flex justify-between items-center">
							<p className="text-foreground/70">
								{item.feature
									? item.feature.name
									: isOneOff
										? "Price"
										: "Subscription"}
							</p>
							<p className="font-medium text-foreground">
								{item.display?.primary_text} {item.display?.secondary_text}
							</p>
						</div>
					);
				})}
		</div>
	);
}

function CheckoutLines({ checkoutResult }: { checkoutResult: CheckoutResult }) {
	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="total" className="border-b-0">
				<CustomAccordionTrigger className="justify-between w-full my-0 py-0 border-none">
					<div className="cursor-pointer flex items-center gap-1 w-full justify-end">
						<p className="font-light text-muted-foreground">
							View details
						</p>
						<ChevronDown
							className="text-muted-foreground mt-0.5 rotate-90 transition-transform duration-200 ease-in-out"
							size={14}
						/>
					</div>
				</CustomAccordionTrigger>
				<AccordionContent className="mt-2 mb-0 pb-2 flex flex-col gap-2">
					{checkoutResult?.lines
						.filter((line) => line.amount !== 0)
						.map((line, index) => {
							return (
								<div key={index} className="flex justify-between">
									<p className="text-muted-foreground">{line.description}</p>
									<p className="text-muted-foreground">
										{new Intl.NumberFormat("en-US", {
											style: "currency",
											currency: checkoutResult?.currency,
										}).format(line.amount)}
									</p>
								</div>
							);
						})}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

function CustomAccordionTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					"focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]_svg]:rotate-0",
					className,
				)}
				{...props}
			>
				{children}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

const PrepaidItem = ({
	item,
	checkoutResult,
	setCheckoutResult,
}: {
	item: ProductItem;
	checkoutResult: CheckoutResult;
	setCheckoutResult: (checkoutResult: CheckoutResult) => void;
}) => {
	const { quantity = 0, billing_units: billingUnits = 1 } = item;
	const [quantityInput, setQuantityInput] = useState<string>(
		(quantity / billingUnits).toString(),
	);
	const { checkout } = useCustomer();
	const [loading, setLoading] = useState(false);
	const [open, setOpen] = useState(false);
	const scenario = checkoutResult.product.scenario;

	const handleSave = async () => {
		setLoading(true);
		try {
			const newOptions = checkoutResult.options
				.filter((option) => option.feature_id !== item.feature_id)
				.map((option) => {
					return {
						featureId: option.feature_id,
						quantity: option.quantity,
					};
				});

			newOptions.push({
				featureId: item.feature_id!,
				quantity: Number(quantityInput) * billingUnits,
			});

			const { data, error } = await checkout({
				productId: checkoutResult.product.id,
				options: newOptions,
				dialog: CheckoutDialog,
			});

			if (error) {
				console.error(error);
				return;
			}
			setCheckoutResult(data!);
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
			setOpen(false);
		}
	};

	const disableSelection = scenario === "renew";

	return (
		<div className="flex justify-between items-center gap-2">
			<div className="flex gap-2 items-center">
				<p className="text-foreground font-medium whitespace-nowrap">
					{item.feature?.name}
				</p>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						className={cn(
							"text-foreground text-sm px-2.5 py-1 rounded-md flex items-center gap-1.5 bg-muted border border-border shrink-0 font-medium",
							disableSelection !== true &&
								"hover:bg-accent hover:border-foreground/20 cursor-pointer transition-colors",
							disableSelection &&
								"pointer-events-none opacity-50 cursor-not-allowed",
						)}
						disabled={disableSelection}
					>
						<span className="text-xs text-muted-foreground">Qty:</span>
						{quantity.toLocaleString()}
						{!disableSelection && <ChevronDown size={14} className="text-muted-foreground" />}
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="w-80 text-sm p-4 pt-3 flex flex-col gap-4"
					>
						<div className="flex flex-col gap-1">
							<p className="text-sm font-medium">{item.feature?.name}</p>
							<p className="text-muted-foreground">
								{item.display?.primary_text} {item.display?.secondary_text}
							</p>
						</div>

						<div className="flex justify-between items-end">
							<div className="flex gap-2 items-center">
								<Input
									className="h-7 w-16 focus:!ring-2"
									value={quantityInput}
									onChange={(e) => setQuantityInput(e.target.value)}
								/>
								<p className="text-muted-foreground">
									{billingUnits > 1 && `x ${billingUnits} `}
									{item.feature?.name}
								</p>
							</div>

							<Button
								onClick={handleSave}
								className="w-14 !h-7 text-sm items-center bg-white text-foreground shadow-sm border border-zinc-200 hover:bg-zinc-100"
								disabled={loading}
							>
								{loading ? (
									<Loader2 className="text-muted-foreground animate-spin !w-4 !h-4" />
								) : (
									"Save"
								)}
							</Button>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
};

export const PriceItem = ({
	children,
	className,
	...props
}: {
	children: React.ReactNode;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
	return (
		<div
			className={cn(
				"flex flex-col pb-4 sm:pb-0 gap-1 sm:flex-row justify-between sm:h-7 sm:gap-2 sm:items-center",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
};

export const PricingDialogButton = ({
	children,
	size,
	onClick,
	disabled,
	className,
}: {
	children: React.ReactNode;
	size?: "sm" | "lg" | "default" | "icon";
	onClick: () => void;
	disabled?: boolean;
	className?: string;
}) => {
	return (
		<Button
			onClick={onClick}
			disabled={disabled}
			size={size}
			className={cn(className, "shadow-sm shadow-stone-400")}
		>
			{children}
			<ArrowRight className="!h-3" />
		</Button>
	);
};
