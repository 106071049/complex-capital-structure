"use client"

import { useState } from "react"
import { GripVertical, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ChartConfig, Layer, Segment } from "@/lib/chart-types"
import { generateId } from "@/lib/chart-types"

interface DraggableSegmentPanelProps {
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

export function DraggableSegmentPanel({ config, onChange }: DraggableSegmentPanelProps) {
  const [draggedItem, setDraggedItem] = useState<{
    layerId: string
    segmentId: string
    segmentIndex: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleAddLayer = () => {
    // Collect all colors currently in use
    const usedColors = new Set<string>()
    config.layers.forEach(layer => {
      layer.segments.forEach(segment => {
        usedColors.add(segment.color.toLowerCase())
      })
    })
    
    // Find the first unused color from preset colors
    let selectedColor = PRESET_COLORS[0]
    for (const color of PRESET_COLORS) {
      if (!usedColors.has(color.toLowerCase())) {
        selectedColor = color
        break
      }
    }
    
    const defaultSegment: Segment = {
      id: generateId(),
      label: 'Financial Instrument',
      percent: 100,
      color: selectedColor
    }
    const newLayer: Layer = {
      id: generateId(),
      name: `Layer ${config.layers.length + 1}`,
      height: 100,
      percent: 10, // Default 10% of total triangle area
      segments: [defaultSegment]
    }
    onChange({ ...config, layers: [...config.layers, newLayer] })
  }

  const handleDeleteLayer = (layerId: string) => {
    if (config.layers.length <= 1) {
      alert('至少需要保留一層')
      return
    }
    const newLayers = config.layers.filter(l => l.id !== layerId)
    onChange({ ...config, layers: newLayers })
  }

  const handleUpdateLayerName = (layerId: string, name: string) => {
    const newLayers = config.layers.map(layer => 
      layer.id === layerId ? { ...layer, name } : layer
    )
    onChange({ ...config, layers: newLayers })
  }

  const handleUpdateLayerPercent = (layerId: string, percent: number) => {
    const clampedPercent = Math.max(0, Math.min(100, percent))
    
    // Calculate total percent of other layers
    const otherLayersTotal = config.layers.reduce((sum, layer) => {
      return layer.id === layerId ? sum : sum + (layer.percent || 0)
    }, 0)
    
    // Calculate remaining percent for other layers
    const remainingPercent = 100 - clampedPercent
    const scaleFactor = otherLayersTotal > 0 ? remainingPercent / otherLayersTotal : 0
    
    // Update all layers
    const newLayers = config.layers.map(layer => {
      if (layer.id === layerId) {
        return { ...layer, percent: clampedPercent }
      } else {
        return { ...layer, percent: (layer.percent || 0) * scaleFactor }
      }
    })
    
    onChange({ ...config, layers: newLayers })
  }

  const handleDragStart = (layerId: string, segmentId: string, segmentIndex: number) => {
    setDraggedItem({ layerId, segmentId, segmentIndex })
    setIsDragging(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetLayerId: string, targetIndex?: number) => {
    if (!draggedItem) return

    const newLayers = [...config.layers]
    const sourceLayerIndex = newLayers.findIndex(l => l.id === draggedItem.layerId)
    const targetLayerIndex = newLayers.findIndex(l => l.id === targetLayerId)

    if (sourceLayerIndex === -1 || targetLayerIndex === -1) return

    // Remove segment from source layer
    const sourceLayer = newLayers[sourceLayerIndex]
    const [movedSegment] = sourceLayer.segments.splice(draggedItem.segmentIndex, 1)

    // Add segment to target layer
    const targetLayer = newLayers[targetLayerIndex]
    const insertIndex = targetIndex !== undefined ? targetIndex : targetLayer.segments.length
    targetLayer.segments.splice(insertIndex, 0, movedSegment)

    // Normalize percentages for both layers
    sourceLayer.segments = normalizeSegments(sourceLayer.segments)
    targetLayer.segments = normalizeSegments(targetLayer.segments)

    onChange({ ...config, layers: newLayers })
    setDraggedItem(null)
    setIsDragging(false)
  }

  const handleDeleteSegment = (layerId: string, segmentIndex: number) => {
    const newLayers = config.layers.map(layer => {
      if (layer.id === layerId) {
        const newSegments = layer.segments.filter((_, i) => i !== segmentIndex)
        return {
          ...layer,
          segments: normalizeSegments(newSegments)
        }
      }
      return layer
    })
    onChange({ ...config, layers: newLayers })
  }

  const handleAddSegment = (layerId: string) => {
    const newLayers = config.layers.map(layer => {
      if (layer.id === layerId) {
        const newSegmentPercent = 10 // 新產品預設佔 10%
        
        // 計算其他 segments 需要縮減的比例
        const totalExistingPercent = layer.segments.reduce((sum, s) => sum + s.percent, 0)
        const scaleFactor = totalExistingPercent > 0 ? (100 - newSegmentPercent) / totalExistingPercent : 0
        
        // 按比例縮減現有 segments
        const adjustedSegments = layer.segments.map(seg => ({
          ...seg,
          percent: seg.percent * scaleFactor
        }))
        
        const newSegment: Segment = {
          id: generateId(),
          label: `Segment ${layer.segments.length + 1}`,
          percent: newSegmentPercent,
          color: PRESET_COLORS[layer.segments.length % PRESET_COLORS.length]
        }
        
        return {
          ...layer,
          segments: [...adjustedSegments, newSegment]
        }
      }
      return layer
    })
    onChange({ ...config, layers: newLayers })
  }

  const handleUpdateSegment = (
    layerId: string,
    segmentIndex: number,
    field: keyof Segment,
    value: string | number
  ) => {
    const newLayers = config.layers.map(layer => {
      if (layer.id === layerId) {
        // 如果修改的是百分比，需要調整其他 segments
        if (field === 'percent') {
          const newPercent = typeof value === 'number' ? value : parseFloat(value as string) || 0
          
          // 確保新百分比在合理範圍內
          const clampedPercent = Math.max(0, Math.min(100, newPercent))
          
          // 計算其他 segments 的總百分比
          const otherSegmentsTotal = layer.segments.reduce((sum, seg, i) => {
            return i === segmentIndex ? sum : sum + seg.percent
          }, 0)
          
          // 計算剩餘可分配的百分比
          const remainingPercent = 100 - clampedPercent
          
          // 按比例調整其他 segments
          const scaleFactor = otherSegmentsTotal > 0 ? remainingPercent / otherSegmentsTotal : 0
          
          const newSegments = layer.segments.map((seg, i) => {
            if (i === segmentIndex) {
              return { ...seg, percent: clampedPercent }
            } else {
              return { ...seg, percent: seg.percent * scaleFactor }
            }
          })
          
          return { ...layer, segments: newSegments }
        } else {
          // 修改其他欄位（label, color）不影響百分比
          const newSegments = layer.segments.map((seg, i) => {
            if (i === segmentIndex) {
              return { ...seg, [field]: value }
            }
            return seg
          })
          return { ...layer, segments: newSegments }
        }
      }
      return layer
    })
    onChange({ ...config, layers: newLayers })
  }

  const normalizeSegments = (segments: Segment[]): Segment[] => {
    if (segments.length === 0) return []
    const total = segments.reduce((sum, s) => sum + s.percent, 0)
    if (total === 0) return segments
    return segments.map(s => ({
      ...s,
      percent: (s.percent / total) * 100
    }))
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Add Layer Button */}
      <Button
        onClick={handleAddLayer}
        className="w-full"
        variant="outline"
      >
        <Plus className="h-4 w-4 mr-2" />
        新增層級
      </Button>

      {config.layers.map((layer, layerIndex) => (
        <div
          key={layer.id}
          className="border border-border rounded-lg p-3 bg-card"
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(layer.id)
          }}
        >
          <div className="space-y-2 mb-3">
            {/* 層級名稱輸入框 - 全寬度 */}
            <Input
              value={layer.name}
              onChange={(e) => handleUpdateLayerName(layer.id, e.target.value)}
              className="h-8 text-sm font-semibold w-full text-center"
              placeholder="層級名稱"
            />
            
            {/* 百分比和按鈕控制 */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={(layer.percent || 0).toFixed(1)}
                  onChange={(e) => handleUpdateLayerPercent(layer.id, parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs w-20 text-center"
                  min="0"
                  max="100"
                  step="0.1"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">%</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddSegment(layer.id)}
                  className="h-7 px-2"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
                {config.layers.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteLayer(layer.id)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    title="刪除此層級"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {layer.segments.map((segment, segIndex) => {
              const isBeingDragged = draggedItem?.segmentId === segment.id
              return (<div
                key={segment.id}
                onDragOver={handleDragOver}
                onDrop={(e) => {
                  e.stopPropagation()
                  handleDrop(layer.id, segIndex)
                }}
                className={`p-2 bg-muted/50 rounded border border-border transition-all duration-200 ${
                  isBeingDragged ? 'opacity-50 scale-95 shadow-lg' : 'opacity-100 scale-100'
                } ${
                  isDragging && !isBeingDragged ? 'border-dashed border-primary/30' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    draggable
                    onDragStart={() => handleDragStart(layer.id, segment.id, segIndex)}
                    onDragEnd={() => setIsDragging(false)}
                    className="cursor-move flex-shrink-0 hover:scale-110 transition-transform active:scale-95"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                  </div>
                  
                  <div className="flex-1 space-y-2 min-w-0">
                    {/* 金融商品名稱 - 全寬度 */}
                    <Input
                      value={segment.label}
                      onChange={(e) => handleUpdateSegment(layer.id, segIndex, 'label', e.target.value)}
                      className="h-8 text-xs w-full hover:border-border"
                      placeholder="輸入金融商品名稱..."
                    />
                    
                    {/* 百分比和顏色控制 */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded flex-shrink-0 border border-border cursor-pointer"
                        style={{ backgroundColor: segment.color }}
                        title="點擊更改顏色"
                      />
                      
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          type="number"
                          value={segment.percent.toFixed(1)}
                          onChange={(e) => handleUpdateSegment(layer.id, segIndex, 'percent', parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs hover:border-border"
                          min="0"
                          max="100"
                          step="0.1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">%</span>
                      </div>

                      <Input
                        type="color"
                        value={segment.color}
                        onChange={(e) => handleUpdateSegment(layer.id, segIndex, 'color', e.target.value)}
                        className="w-10 h-7 p-1 cursor-pointer flex-shrink-0 hover:border-border"
                      />

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSegment(layer.id, segIndex)}
                        className="h-7 w-7 p-0 flex-shrink-0 text-destructive hover:text-destructive"
                        title="刪除此產品"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )})

            {layer.segments.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed border-border rounded">
                Drag segments here or click Add
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
