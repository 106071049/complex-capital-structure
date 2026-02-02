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
  typography: {
    fontSize: number
    fontFamily: string
  }
}

export const defaultChartConfig: ChartConfig = {
  canvas: { width: 1400, height: 700 },
  axes: { showX: true, showY: true },
  fan: {
    enabled: true,
    start: { mode: "auto", x: 180, y: 520 },
    end: { x: 1050, y: 80 },
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
        { id: "s1", label: "Common", percent: 55.6, color: "#22c55e" },
        { id: "s2", label: "Options", percent: 11.1, color: "#4ade80" },
        { id: "s3", label: "Preferred A", percent: 33.3, color: "#86efac" },
      ],
    },
    {
      id: "L2",
      name: "Layer 2",
      height: 120,
      percent: 33.3,
      segments: [
        { id: "s1", label: "Common", percent: 40, color: "#3b82f6" },
        { id: "s2", label: "Preferred B", percent: 60, color: "#60a5fa" },
      ],
    },
    {
      id: "L3",
      name: "Layer 3",
      height: 140,
      percent: 33.4,
      segments: [
        { id: "s1", label: "Common", percent: 25, color: "#f97316" },
        { id: "s2", label: "Options", percent: 25, color: "#fb923c" },
        { id: "s3", label: "Preferred C", percent: 50, color: "#fdba74" },
      ],
    },
  ],
  legend: { enabled: true, position: "right" },
  showNotToScale: true,
  typography: {
    fontSize: 14,
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
