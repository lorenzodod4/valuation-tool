import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LabVariant } from "@/components/hero-lab/LabVariant";

export const metadata: Metadata = {
  title: "Entrance lab",
  robots: { index: false, follow: false },
};

const VARIANTS = ["constellation", "prism", "run"] as const;

export function generateStaticParams() {
  return VARIANTS.map((variant) => ({ variant }));
}

export default async function LabPage({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  if (!VARIANTS.includes(variant as (typeof VARIANTS)[number])) notFound();
  return <LabVariant variant={variant as (typeof VARIANTS)[number]} />;
}
