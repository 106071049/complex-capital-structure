export interface Segment {
  id: string
  label: string
  percent: number
  color: string
}

export interface Layer {
  id: string
  name: string
  height: number
  percent?: number // Percentage of total triangle area (optional for backward compatibility)
  value?: number // Value at this layer's node (optional)
  cumulativePercent?: number // Cumulative percentage from bottom (for calculation file mode)
  cumulativeAmount?: number // Cumulative amount from bottom (for calculation file mode)
  nodeVisible?: boolean // Whether the node is visible (default: true)
  segments: Segment[]
}

export interface ChartConfig {
  canvas: {
    width: number
    height: number
  }
  axes: {
    showX: boolean
    showY: boolean
  }
  fan: {
    enabled: boolean
    start: {
      mode: "auto" | "manual"
      x: number
      y: number
    }
    end: {
      x: number
      y: number
    }
    outerStrokeWidth: number
    innerStrokeWidth: number
    showDottedSeparators: boolean
  }
  layers: Layer[]
  legend: {
    enabled: boolean
    position: "right" | "bottom"
  }
  showNotToScale: boolean
  displayMode?: "normal" | "tall" // Display mode: normal or tall (elongated)
  hideLabelsBelow?: number // Hide labels for segments below this percentage (0 = show all)
  typography: {
    fontSize: number
    fontFamily: string
  }
}

export const defaultChartConfig: ChartConfig = {
  canvas: { width: 2000, height: 1700 },
  axes: { showX: true, showY: true },
  fan: {
    enabled: true,
    start: { mode: "auto", x: 180, y: 520 },
    end: { x: 1450, y: 80 },
    outerStrokeWidth: 4,
    innerStrokeWidth: 1,
    showDottedSeparators: true,
  },
  layers: [
    {
      id: "L1",
      name: "Layer 1",
      height: 100,
      percent: 33.3,
      segments: [
        { id: "s1", label: "Common Shares", percent: 55.6, color: "#86efac" },
        { id: "s2", label: "Options", percent: 11.1, color: "#fdba74" },
        { id: "s3", label: "Preferred A", percent: 33.3, color: "#bfdbfe" },
      ],
    },
    {
      id: "L2",
      name: "Layer 2",
      height: 120,
      percent: 33.3,
      segments: [
        { id: "s1", label: "Common Shares", percent: 40, color: "#86efac"  },
        { id: "s2", label: "Preferred B", percent: 60, color: "#fcd34d" },
      ],
    },
    {
      id: "L3",
      name: "Layer 3",
      height: 140,
      percent: 33.4,
      segments: [
        { id: "s1", label: "Common Shares", percent: 25, color: "#86efac"  },
        { id: "s2", label: "Options", percent: 25, color: "#fdba74" },
        { id: "s3", label: "Preferred C", percent: 50, color: "#fecaca" },
      ],
    },
  ],
  legend: { enabled: true, position: "right" },
  showNotToScale: true,
  displayMode: "normal",
  hideLabelsBelow: 0,
  typography: {
    fontSize: 16,
    fontFamily: "Arial, sans-serif",
  },
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function normalizeSegments(segments: Segment[]): Segment[] {
  const total = segments.reduce((sum, s) => sum + s.percent, 0)
  if (total === 0) return segments
  return segments.map((s) => ({
    ...s,
    percent: (s.percent / total) * 100,
  }))
}
