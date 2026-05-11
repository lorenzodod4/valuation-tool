"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import type {
  FullValuation,
  HistoricalFinancials,
  SensitivityTable,
} from "@/types/valuation";
import { ValuationPDF } from "@/components/ValuationPDF";

interface PDFLinkInnerProps {
  valuation: FullValuation;
  historical?: HistoricalFinancials | null;
  sensitivity?: SensitivityTable | null;
}

export function PDFLinkInner({
  valuation,
  historical,
  sensitivity,
}: PDFLinkInnerProps) {
  const today = new Date().toISOString().split("T")[0];
  const fileName = `${valuation.profile.symbol}-valuation-${today}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <ValuationPDF
          valuation={valuation}
          historical={historical}
          sensitivity={sensitivity}
        />
      }
      fileName={fileName}
      className="export-pdf-button"
    >
      {({ loading }) => (loading ? "Generating PDF…" : "↓ Export PDF")}
    </PDFDownloadLink>
  );
}
