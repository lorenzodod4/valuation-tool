"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import type {
  FullValuation,
  HistoricalFinancials,
  MultiplesResult,
  ReverseDCFResult,
  SensitivityTable,
} from "@/types/valuation";
import { ValuationPDF } from "@/components/ValuationPDF";

interface PDFLinkInnerProps {
  valuation: FullValuation;
  historical?: HistoricalFinancials | null;
  reverseDcf?: ReverseDCFResult | null;
  sensitivity?: SensitivityTable | null;
  multiples?: MultiplesResult | null;
}

export function PDFLinkInner({
  valuation,
  historical,
  reverseDcf,
  sensitivity,
  multiples,
}: PDFLinkInnerProps) {
  const today = new Date().toISOString().split("T")[0];
  const fileName = `${valuation.profile.symbol}-valuation-${today}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <ValuationPDF
          valuation={valuation}
          historical={historical}
          reverseDcf={reverseDcf}
          sensitivity={sensitivity}
          multiples={multiples}
        />
      }
      fileName={fileName}
      className="export-pdf-button"
    >
      {({ loading }) =>
        loading ? (
          "Generating PDF..."
        ) : (
          <>
            <Download size={14} strokeWidth={1.8} aria-hidden="true" />
            Export core PDF
          </>
        )
      }
    </PDFDownloadLink>
  );
}
