import { runDcf } from "@/lib/dcf-engine";
import { DEMO_COMPANY, demoInputs } from "@/lib/demo-company";

export interface FieldColumn {
  label: string;
  /** Nominal (undiscounted) height in scene units. */
  nominal: number;
  /** Present-value height in scene units. */
  present: number;
  isTerminal: boolean;
}

const UNIT = 1.15; // scene height of Y1 nominal FCF
const TERMINAL_SCALE = 0.17; // terminal value drawn compressed; it is ~12× a single year

/**
 * Column heights for the hero scene, derived from the illustrative company's
 * actual DCF at a given discount rate: the art is the model.
 */
export function fieldColumns(wacc: number): FieldColumn[] {
  const result = runDcf(
    demoInputs({ ...DEMO_COMPANY.defaults, wacc }),
  );
  if (!result.ok) return [];
  const unit = UNIT / result.projections[0].fcff;
  const years: FieldColumn[] = result.projections.map((p) => ({
    label: `Y${p.year}`,
    nominal: p.fcff * unit,
    present: p.pvFcff * unit,
    isTerminal: false,
  }));
  return [
    ...years,
    {
      label: "TV",
      nominal: result.terminalValue * unit * TERMINAL_SCALE,
      present: result.pvTerminalValue * unit * TERMINAL_SCALE,
      isTerminal: true,
    },
  ];
}

export const BASE_WACC = DEMO_COMPANY.defaults.wacc;
/** Peak-to-trough swing of the "breathing" discount rate. */
export const WACC_SWING = 0.014;
export const BREATH_PERIOD_S = 14;
