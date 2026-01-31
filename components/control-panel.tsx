"use client"

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { ChartConfig, Layer, Segment } from "@/lib/chart-types"
import { generateId, normalizeSegments } from "@/lib/chart-types"

interface ControlPanelProps {
  config: ChartConfig
  onChange: (config: ChartConfig) => void
}

const PRESET_COLORS = [
  "#22c55e", "#4ade80", "#86efac", "#bbf7d0",
  "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
  "#f97316", "#fb923c", "#fdba74", "#fed7aa",
  "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff",
  "#ef4444", "#f87171", "#fca5a5", "#fecaca",
  "#eab308", "#facc15", "#fde047", "#fef08a",
]

export function ControlPanel({ config, onChange }: ControlPanelProps) {
  const updateCanvas = (key: keyof ChartConfig["canvas"], value: number) => {
    onChange({
      ...config,
      canvas: { ...config.canvas, [key]: value },
    })
  }

  const updateAxes = (key: keyof ChartConfig["axes"], value: boolean) => {
    onChange({
      ...config,
      axes: { ...config.axes, [key]: value },
    })
  }

  const updateFan = <K extends keyof ChartConfig["fan"]>(
    key: K,
    value: ChartConfig["fan"][K]
  ) => {
    onChange({
      ...config,
      fan: { ...config.fan, [key]: value },
    })
  }

  const updateLegend = <K extends keyof ChartConfig["legend"]>(
    key: K,
    value: ChartConfig["legend"][K]
  ) => {
    onChange({
      ...config,
      legend: { ...config.legend, [key]: value },
    })
  }

  const addLayer = () => {
    const newLayer: Layer = {
      id: generateId(),
      name: `Layer ${config.layers.length + 1}`,
      height: 100,
      segments: [
        { id: generateId(), label: "Segment 1", percent: 50, color: PRESET_COLORS[config.layers.length % PRESET_COLORS.length] },
        { id: generateId(), label: "Segment 2", percent: 50, color: PRESET_COLORS[(config.layers.length + 1) % PRESET_COLORS.length] },
      ],
    }
    onChange({
      ...config,
      layers: [...config.layers, newLayer],
    })
  }

  const removeLayer = (layerId: string) => {
    onChange({
      ...config,
      layers: config.layers.filter((l) => l.id !== layerId),
    })
  }

  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    onChange({
      ...config,
      layers: config.layers.map((l) =>
        l.id === layerId ? { ...l, ...updates } : l
      ),
    })
  }

  const moveLayer = (index: number, direction: "up" | "down") => {
    const newLayers = [...config.layers]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newLayers.length) return
    ;[newLayers[index], newLayers[targetIndex]] = [newLayers[targetIndex], newLayers[index]]
    onChange({ ...config, layers: newLayers })
  }

  const addSegment = (layerId: string) => {
    onChange({
      ...config,
      layers: config.layers.map((l) => {
        if (l.id !== layerId) return l
        const newSegments = [
          ...l.segments,
          {
            id: generateId(),
            label: `Segment ${l.segments.length + 1}`,
            percent: 10,
            color: PRESET_COLORS[(l.segments.length + 4) % PRESET_COLORS.length],
          },
        ]
        return { ...l, segments: normalizeSegments(newSegments) }
      }),
    })
  }

  const removeSegment = (layerId: string, segmentId: string) => {
    onChange({
      ...config,
      layers: config.layers.map((l) => {
        if (l.id !== layerId) return l
        const newSegments = l.segments.filter((s) => s.id !== segmentId)
        return { ...l, segments: normalizeSegments(newSegments) }
      }),
    })
  }

  const updateSegment = (layerId: string, segmentId: string, updates: Partial<Segment>) => {
    onChange({
      ...config,
      layers: config.layers.map((l) => {
        if (l.id !== layerId) return l
        return {
          ...l,
          segments: l.segments.map((s) =>
            s.id === segmentId ? { ...s, ...updates } : s
          ),
        }
      }),
    })
  }

  const normalizeLayerSegments = (layerId: string) => {
    onChange({
      ...config,
      layers: config.layers.map((l) => {
        if (l.id !== layerId) return l
        return { ...l, segments: normalizeSegments(l.segments) }
      }),
    })
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <Accordion type="multiple" defaultValue={["global", "fan", "layers"]} className="space-y-2">
        {/* Global Settings */}
        <AccordionItem value="global" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">
            Global Settings
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Width</Label>
                <Input
                  type="number"
                  value={config.canvas.width}
                  onChange={(e) => updateCanvas("width", Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Height</Label>
                <Input
                  type="number"
                  value={config.canvas.height}
                  onChange={(e) => updateCanvas("height", Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show X Axis</Label>
              <Switch
                checked={config.axes.showX}
                onCheckedChange={(v) => updateAxes("showX", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Y Axis</Label>
              <Switch
                checked={config.axes.showY}
                onCheckedChange={(v) => updateAxes("showY", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Legend</Label>
              <Switch
                checked={config.legend.enabled}
                onCheckedChange={(v) => updateLegend("enabled", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">{"Show 'Not to Scale'"}</Label>
              <Switch
                checked={config.showNotToScale}
                onCheckedChange={(v) => onChange({ ...config, showNotToScale: v })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Fan Settings */}
        <AccordionItem value="fan" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">
            Fan Settings
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Outer Stroke</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={config.fan.outerStrokeWidth}
                  onChange={(e) => updateFan("outerStrokeWidth", Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Inner Stroke</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={config.fan.innerStrokeWidth}
                  onChange={(e) => updateFan("innerStrokeWidth", Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Dotted Separators</Label>
              <Switch
                checked={config.fan.showDottedSeparators}
                onCheckedChange={(v) => updateFan("showDottedSeparators", v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Layers */}
        <AccordionItem value="layers" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">
            Layers ({config.layers.length})
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {config.layers.map((layer, layerIndex) => (
              <div
                key={layer.id}
                className="border border-border rounded-lg p-3 space-y-3 bg-muted/30"
              >
                {/* Layer header */}
                <div className="flex items-center gap-2">
                  <Input
                    value={layer.name}
                    onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                    className="h-7 text-xs flex-1 font-medium"
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveLayer(layerIndex, "up")}
                      disabled={layerIndex === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveLayer(layerIndex, "down")}
                      disabled={layerIndex === config.layers.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeLayer(layer.id)}
                      disabled={config.layers.length <= 1}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Layer height */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Height</Label>
                  <Input
                    type="number"
                    min={20}
                    value={layer.height}
                    onChange={(e) => updateLayer(layer.id, { height: Number(e.target.value) })}
                    className="h-7 text-xs"
                  />
                </div>

                {/* Segments */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Segments ({layer.segments.length})
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => normalizeLayerSegments(layer.id)}
                    >
                      Normalize
                    </Button>
                  </div>

                  {layer.segments.map((segment) => (
                    <div
                      key={segment.id}
                      className="flex items-center gap-2 p-2 bg-background rounded border border-border"
                    >
                      <input
                        type="color"
                        value={segment.color}
                        onChange={(e) =>
                          updateSegment(layer.id, segment.id, { color: e.target.value })
                        }
                        className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                      />
                      <Input
                        value={segment.label}
                        onChange={(e) =>
                          updateSegment(layer.id, segment.id, { label: e.target.value })
                        }
                        className="h-6 text-xs flex-1"
                        placeholder="Label"
                      />
                      <Input
                        type="number"
                        value={segment.percent.toFixed(1)}
                        onChange={(e) =>
                          updateSegment(layer.id, segment.id, { percent: Number(e.target.value) })
                        }
                        className="h-6 text-xs w-16"
                        min={0}
                        step={0.1}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={() => removeSegment(layer.id, segment.id)}
                        disabled={layer.segments.length <= 1}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs bg-transparent"
                    onClick={() => addSegment(layer.id)}
                    disabled={layer.segments.length >= 6}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Segment
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={addLayer}
              disabled={config.layers.length >= 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Layer
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
