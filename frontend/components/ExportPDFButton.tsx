"use client";

import dynamic from "next/dynamic";
import type {
  FullValuation,
  HistoricalFinancials,
  SensitivityTable,
} from "@/types/valuation";

// @react-pdf/renderer + the ValuationPDF tree together weigh ~1MB and use
// browser-only globals (Blob, Web Workers); lazy-load with ssr: false to keep
// the page bundle slim and to avoid SSR errors during build.
const PDFLinkInner = dynamic(
  () =>
    import("@/components/PDFLinkInner").then((mod) => ({
      default: mod.PDFLinkInner,
    })),
  {
    ssr: false,
    loading: () => (
      <span className="export-pdf-button export-pdf-button-loading">
        Loading PDF…
      </span>
    ),
  },
);

interface ExportPDFButtonProps {
  valuation: FullValuation;
  historical?: HistoricalFinancials | null;
  sensitivity?: SensitivityTable | null;
}

export function ExportPDFButton(props: ExportPDFButtonProps) {
  return <PDFLinkInner {...props} />;
}
