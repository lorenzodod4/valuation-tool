import { useState } from "react";
import type { DCFResult, FullValuation } from "@/types/valuation";
import { BorderGlow } from "@/components/BorderGlow";
import { formatCurrency, formatPercent } from "@/lib/format";

interface ScenarioBuilderProps {
  ticker: string;
  baseValuation: FullValuation;
}

interface Scenario {
  name: string;
  revenueGrowth: number;
  ebitMargin: number;
  wacc: number;
  terminalGrowth: number;
}

const PRESETS: Record<string, Scenario> = {
  bear: {
    name: "Bear",
    revenueGrowth: 0.03,
    ebitMargin: 0.10,
    wacc: 0.12,
    terminalGrowth: 0.015,
  },
  base: {
    name: "Base",
    revenueGrowth: 0.08,
    ebitMargin: 0.15,
    wacc: 0.09,
    terminalGrowth: 0.025,
  },
  bull: {
    name: "Bull",
    revenueGrowth: 0.15,
    ebitMargin: 0.20,
    wacc: 0.07,
    terminalGrowth: 0.035,
  },
};

interface DCFScenarioAssumptions {
  revenue_growth_rates?: number[];
  ebit_margin?: number;
  wacc?: number;
  terminal_growth_rate?: number;
}

export function ScenarioBuilder({ ticker, baseValuation }: ScenarioBuilderProps) {
  const baseAssumptions = baseValuation.dcf?.assumptions_used as DCFScenarioAssumptions | undefined;
  
  const [customScenario, setCustomScenario] = useState<Scenario>({
    name: "Custom",
    revenueGrowth: baseAssumptions?.revenue_growth_rates?.[0] || 0.08,
    ebitMargin: baseAssumptions?.ebit_margin || 0.15,
    wacc: baseAssumptions?.wacc || 0.09,
    terminalGrowth: baseAssumptions?.terminal_growth_rate || 0.025,
  });

  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<Record<string, DCFResult | null>>({
    bear: null,
    base: baseValuation.dcf || null,
    bull: null,
    custom: null,
  });

  const runScenario = async (scenarioKey: string, params: Scenario) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/valuation/${ticker}/dcf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revenue_growth_rates: Array(5).fill(params.revenueGrowth),
            ebit_margin: params.ebitMargin,
            wacc: params.wacc,
            terminal_growth_rate: params.terminalGrowth,
          }),
        }
      );
      
      if (!response.ok) throw new Error("Scenario calculation failed");
      
      const result = await response.json();
      setScenarios((prev) => ({ ...prev, [scenarioKey]: result }));
    } catch (error) {
      console.error(`Failed to run ${scenarioKey} scenario:`, error);
    } finally {
      setLoading(false);
    }
  };

  const runAllPresets = async () => {
    await Promise.all([
      runScenario("bear", PRESETS.bear),
      runScenario("bull", PRESETS.bull),
    ]);
  };

  const updateCustomParam = (key: keyof Scenario, value: number) => {
    setCustomScenario((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="scenario-builder">
      <div className="scenario-header">
        <h3>Multi-Scenario Analysis</h3>
        <p className="scenario-subtitle">
          Compare valuations across bear, base, and bull assumptions
        </p>
      </div>

      <div className="scenario-presets">
        <button
          onClick={runAllPresets}
          disabled={loading}
          className="scenario-run-btn"
        >
          {loading ? "Running..." : "Run Bear/Bull Scenarios"}
        </button>
      </div>

      <div className="scenario-comparison-grid">
        {["bear", "base", "bull"].map((key) => {
          const preset = key === "base" ? {
            name: "Base",
            revenueGrowth: baseAssumptions?.revenue_growth_rates?.[0] || 0.08,
            ebitMargin: baseAssumptions?.ebit_margin || 0.15,
            wacc: baseAssumptions?.wacc || 0.09,
            terminalGrowth: baseAssumptions?.terminal_growth_rate || 0.025,
          } : PRESETS[key];
          
          const result = scenarios[key];
          const upside = result?.upside_pct;
          const upsideColor = upside == null ? "var(--text-primary)" : upside >= 0 ? "var(--bull)" : "var(--bear)";

          return (
            <BorderGlow key={key} className="scenario-card">
              <div className="scenario-card-inner">
                <div className="scenario-name">{preset.name}</div>
                <div className="scenario-params">
                  <div className="scenario-param">
                    <span>Growth:</span>
                    <strong>{(preset.revenueGrowth * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="scenario-param">
                    <span>EBIT Margin:</span>
                    <strong>{(preset.ebitMargin * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="scenario-param">
                    <span>WACC:</span>
                    <strong>{(preset.wacc * 100).toFixed(2)}%</strong>
                  </div>
                  <div className="scenario-param">
                    <span>Terminal:</span>
                    <strong>{(preset.terminalGrowth * 100).toFixed(2)}%</strong>
                  </div>
                </div>

                {result ? (
                  <div className="scenario-result">
                    <div className="scenario-value">
                      {formatCurrency(result.per_share_value)}
                    </div>
                    <div className="scenario-upside" style={{ color: upsideColor }}>
                      {formatPercent(upside)} vs market
                    </div>
                  </div>
                ) : (
                  <div className="scenario-placeholder">
                    {key === "base" ? "Loaded" : "Not run"}
                  </div>
                )}
              </div>
            </BorderGlow>
          );
        })}
      </div>

      <BorderGlow className="scenario-custom-card">
        <div className="scenario-custom-header">
          <h4>Custom Scenario</h4>
          <p>Adjust parameters with sliders</p>
        </div>

        <div className="scenario-sliders">
          <div className="scenario-slider-group">
            <label>
              Revenue Growth (Y1-Y5): {(customScenario.revenueGrowth * 100).toFixed(1)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.25"
              step="0.01"
              value={customScenario.revenueGrowth}
              onChange={(e) => updateCustomParam("revenueGrowth", parseFloat(e.target.value))}
            />
          </div>

          <div className="scenario-slider-group">
            <label>
              EBIT Margin: {(customScenario.ebitMargin * 100).toFixed(1)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.40"
              step="0.01"
              value={customScenario.ebitMargin}
              onChange={(e) => updateCustomParam("ebitMargin", parseFloat(e.target.value))}
            />
          </div>

          <div className="scenario-slider-group">
            <label>
              WACC: {(customScenario.wacc * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="0.15"
              step="0.005"
              value={customScenario.wacc}
              onChange={(e) => updateCustomParam("wacc", parseFloat(e.target.value))}
            />
          </div>

          <div className="scenario-slider-group">
            <label>
              Terminal Growth: {(customScenario.terminalGrowth * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0.01"
              max="0.05"
              step="0.005"
              value={customScenario.terminalGrowth}
              onChange={(e) => updateCustomParam("terminalGrowth", parseFloat(e.target.value))}
            />
          </div>
        </div>

        <button
          onClick={() => runScenario("custom", customScenario)}
          disabled={loading}
          className="scenario-run-custom-btn"
        >
          {loading ? "Calculating..." : "Calculate Custom Scenario"}
        </button>

        {scenarios.custom && (
          <div className="scenario-custom-result">
            <div className="scenario-value-large">
              {formatCurrency(scenarios.custom.per_share_value)}
            </div>
            <div className="scenario-upside-large" style={{ 
              color: scenarios.custom.upside_pct! >= 0 ? "var(--bull)" : "var(--bear)" 
            }}>
              {formatPercent(scenarios.custom.upside_pct)} vs market
            </div>
          </div>
        )}
      </BorderGlow>
    </div>
  );
}
