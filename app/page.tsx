"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"

import { Download, Upload, FileJson, ImageIcon, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ControlPanel } from "@/components/control-panel"
import { DraggableSegmentPanel } from "@/components/draggable-segment-panel"
import { CalculationFilePanel } from "@/components/calculation-file-panel"
import { TriangleChart } from "@/components/triangle-chart"
import type { ChartConfig } from "@/lib/chart-types"
import { defaultChartConfig } from "@/lib/chart-types"
import {
  downloadJSON,
  importFromJSON,
  exportToSVG,
  downloadSVG,
  exportToPNG,
  downloadPNG,
} from "@/lib/export-utils"

export default function TriangleBuilderPage() {
  // Separate configs for each mode
  const [precaseConfig, setPrecaseConfig] = useState<ChartConfig>(defaultChartConfig)
  const [calculationConfig, setCalculationConfig] = useState<ChartConfig>(defaultChartConfig)
  
  // Separate label positions for each mode
  const [precaseLabelPositions, setPrecaseLabelPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [calculationLabelPositions, setCalculationLabelPositions] = useState<Record<string, { x: number; y: number }>>({})
  
  // Separate node value positions for each mode
  const [precaseNodeValuePositions, setPrecaseNodeValuePositions] = useState<Record<string, { x: number; y: number }>>({})
  const [calculationNodeValuePositions, setCalculationNodeValuePositions] = useState<Record<string, { x: number; y: number }>>({})
  
  const [sidebarWidth, setSidebarWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const [zoom, setZoom] = useState(1.0)
  const [activeTab, setActiveTab] = useState<'settings' | 'precase' | 'calculation'>('precase')
  const [previousMode, setPreviousMode] = useState<'precase' | 'calculation'>('precase')
  const [showBreakpoints, setShowBreakpoints] = useState(true)
  const [hideLabelsInput, setHideLabelsInput] = useState<string>('0')
  
  // Get current mode's config and setters based on active tab or previous mode
  const getCurrentMode = () => activeTab === 'settings' ? previousMode : (activeTab === 'precase' || activeTab === 'calculation' ? activeTab : 'precase')
  const currentMode = getCurrentMode()
  const config = currentMode === 'precase' ? precaseConfig : calculationConfig
  const setConfig = currentMode === 'precase' ? setPrecaseConfig : setCalculationConfig
  const labelPositions = currentMode === 'precase' ? precaseLabelPositions : calculationLabelPositions
  const setLabelPositions = currentMode === 'precase' ? setPrecaseLabelPositions : setCalculationLabelPositions
  const nodeValuePositions = currentMode === 'precase' ? precaseNodeValuePositions : calculationNodeValuePositions
  const setNodeValuePositions = currentMode === 'precase' ? setPrecaseNodeValuePositions : setCalculationNodeValuePositions
  
  // Sync hideLabelsInput with config.hideLabelsBelow
  useEffect(() => {
    setHideLabelsInput(String(config.hideLabelsBelow || 0))
  }, [config.hideLabelsBelow])

  // Handle tab change and track previous mode
  const handleTabChange = (tab: 'settings' | 'precase' | 'calculation') => {
    // If switching from precase or calculation to settings, remember the mode
    if ((activeTab === 'precase' || activeTab === 'calculation') && tab === 'settings') {
      setPreviousMode(activeTab)
    }
    // If switching from settings to a mode, update previous mode
    if (activeTab === 'settings' && (tab === 'precase' || tab === 'calculation')) {
      setPreviousMode(tab)
    }
    // If switching between precase and calculation, update previous mode
    if ((activeTab === 'precase' || activeTab === 'calculation') && (tab === 'precase' || tab === 'calculation')) {
      setPreviousMode(tab)
    }
    setActiveTab(tab)
  }
  const svgRef = useRef<SVGSVGElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const isResizingRef = useRef(false)

  // Clear label positions when layers change to prevent misalignment
  useEffect(() => {
    setPrecaseLabelPositions({})
  }, [precaseConfig.layers.length])
  
  useEffect(() => {
    setCalculationLabelPositions({})
  }, [calculationConfig.layers.length])

  // Check if total layer percentages exceed 100%
  const checkTotalPercentage = (): boolean => {
    const totalPercent = config.layers.reduce((sum, layer) => sum + (layer.percent || 0), 0)
    return totalPercent > 100
  }

  // Show confirmation dialog if total exceeds 100%
  const confirmExportIfNeeded = (action: () => void) => {
    if (checkTotalPercentage()) {
      const confirmed = window.confirm(
        "目前各層加總超過100%，請問是否仍然要生成檔案？"
      )
      if (confirmed) {
        action()
      }
    } else {
      action()
    }
  }

  const handleExportJSON = () => {
    confirmExportIfNeeded(() => {
      downloadJSON(config, "allocation-chart-config.json")
    })
  }

  const handleExportSVG = async () => {
    confirmExportIfNeeded(async () => {
      if (!svgRef.current) return
      const svgString = await exportToSVG(svgRef.current)
      downloadSVG(svgString, "allocation-chart.svg")
    })
  }

  const handleExportPNG = async (scale: number) => {
    confirmExportIfNeeded(async () => {
      if (!svgRef.current) return
      try {
        const blob = await exportToPNG(svgRef.current, scale)
        downloadPNG(blob, `allocation-chart-${scale}x.png`)
      } catch (error) {
        console.error("Failed to export PNG:", error)
      }
    })
  }

  const handleExportPPT = async () => {
    confirmExportIfNeeded(async () => {
      if (!svgRef.current) return
      try {
        const { exportToPPT } = await import("@/lib/export-utils")
        await exportToPPT(svgRef.current, "allocation-chart.pptx")
        toast.success("PPT 導出成功", {
          description: "文件已保存到下載資料夾",
          duration: 3000,
        })
      } catch (error) {
        console.error("Failed to export PPT:", error)
        toast.error("導出 PPT 失敗", {
          description: "請稍後再試",
          duration: 3000,
        })
      }
    })
  }

  const handleImportJSON = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return
    const newWidth = e.clientX
    if (newWidth >= 300 && newWidth <= 600) {
      setSidebarWidth(newWidth)
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false
    setIsResizing(false)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizingRef.current = true
    setIsResizing(true)
    e.preventDefault()
  }

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const importedConfig = importFromJSON(content)
      if (importedConfig) {
        setConfig(importedConfig)
        // Clear label positions when importing new config
        setLabelPositions({})
        
        const layerCount = importedConfig.layers.length
        
        toast.success("複雜股權結構成功導入", {
          description: `層級數：${layerCount}`,
          duration: 4000,
        })
      } else {
        toast.error("導入失敗", {
          description: "配置文件格式不正確，請確保文件是有效的 JSON 格式",
          duration: 4000,
        })
      }
    }
    reader.onerror = () => {
      toast.error("讀取文件失敗", {
        description: "請重試",
        duration: 3000,
      })
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5 text-primary-foreground"
            >
              <path
                d="M3 20L12 4L21 20H3Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              複雜資本結構
            </h1>
            <p className="text-xs text-muted-foreground">
              協助釐清複雜的股權結構
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="text-xs" 
            onClick={() => {
              if (currentMode === 'precase') {
                setPrecaseLabelPositions({})
              } else {
                setCalculationLabelPositions({})
              }
            }}
          >
            文字回到原位
          </Button>
          
          <Button 
            size="sm" 
            variant={showBreakpoints ? "outline" : "default"} 
            className="text-xs" 
            onClick={() => setShowBreakpoints(!showBreakpoints)}
          >
            {showBreakpoints ? "隱藏Breakpoint點" : "顯示Breakpoint點"}
          </Button>
          
          <Button 
            size="sm" 
            variant={config.legend.enabled ? "outline" : "default"} 
            className="text-xs" 
            onClick={() => {
              setConfig({
                ...config,
                legend: {
                  ...config.legend,
                  enabled: !config.legend.enabled
                }
              })
            }}
          >
            {config.legend.enabled ? "隱藏圖例" : "顯示圖例"}
          </Button>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">隱藏低於</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={hideLabelsInput}
              onChange={(e) => {
                setHideLabelsInput(e.target.value)
              }}
              onBlur={() => {
                const value = parseFloat(hideLabelsInput) || 0
                const clampedValue = Math.max(0, Math.min(100, value))
                setConfig({
                  ...config,
                  hideLabelsBelow: clampedValue
                })
                setHideLabelsInput(String(clampedValue))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = parseFloat(hideLabelsInput) || 0
                  const clampedValue = Math.max(0, Math.min(100, value))
                  setConfig({
                    ...config,
                    hideLabelsBelow: clampedValue
                  })
                  setHideLabelsInput(String(clampedValue))
                  e.currentTarget.blur()
                }
              }}
              className="w-16 px-2 py-1 text-xs border border-border rounded bg-background"
            />
            <label className="text-xs text-muted-foreground">% 的標籤</label>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportJSON}
            className="text-xs bg-transparent"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleExportJSON}>
                <FileJson className="h-4 w-4 mr-2" />
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportSVG}>
                <FileCode className="h-4 w-4 mr-2" />
                Export SVG
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportPNG(1)}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export PNG (1x)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPNG(2)}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export PNG (2x)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPNG(3)}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export PNG (3x)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportPPT}>
                <FileCode className="h-4 w-4 mr-2" />
                Export PPT
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Control Panel */}
        <aside 
          ref={sidebarRef}
          className="border-r border-border bg-card overflow-hidden flex flex-col relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="border-b border-border">
            <div className="flex">
              <button
                onClick={() => handleTabChange('precase')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'precase'
                    ? 'bg-background text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                案前釐清模式
              </button>
              <button
                onClick={() => handleTabChange('calculation')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'calculation'
                    ? 'bg-background text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                引入計算檔模式
              </button>
              <button
                onClick={() => handleTabChange('settings')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-background text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Settings
              </button>
            </div>
          </div>
          {activeTab === 'precase' ? (
            <DraggableSegmentPanel config={precaseConfig} onChange={setPrecaseConfig} />
          ) : activeTab === 'calculation' ? (
            <CalculationFilePanel config={calculationConfig} onChange={setCalculationConfig} />
          ) : (
            <ControlPanel config={config} onChange={setConfig} />
          )}
          
          {/* Resizer */}
          <div
            onMouseDown={handleMouseDown}
            className={`absolute top-0 right-0 w-2 h-full cursor-col-resize group ${
              isResizing ? 'bg-primary/30' : 'hover:bg-primary/20'
            } transition-all`}
            style={{ zIndex: 10 }}
          >
            {/* Visual handle indicator */}
            <div className={`absolute top-1/2 right-0 -translate-y-1/2 w-1 h-20 bg-primary/40 rounded-l transition-all ${
              isResizing ? 'opacity-100 scale-110 bg-primary' : 'opacity-0 group-hover:opacity-100 group-hover:scale-110 group-hover:bg-primary/60'
            }`}>
              {/* Grip dots */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <div className="w-0.5 h-0.5 bg-white/60 rounded-full" />
                <div className="w-0.5 h-0.5 bg-white/60 rounded-full" />
                <div className="w-0.5 h-0.5 bg-white/60 rounded-full" />
              </div>
            </div>
          </div>
        </aside>

        {/* Preview Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <span className="text-xs text-muted-foreground">Preview</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Zoom:</span>
              <div className="flex items-center gap-1">
                {[0.6, 0.8, 1.0, 1.25, 1.5].map((z) => (
                  <Button
                    key={z}
                    variant={zoom === z ? "default" : "ghost"}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setZoom(z)}
                  >
                    {Math.round(z * 100)}%
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Container */}
          <div className="flex-1 overflow-auto p-6 relative">
            <div className="flex items-start justify-center min-h-full">
              <div
                className="bg-background rounded-lg shadow-lg border border-border"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                }}
              >
                {(activeTab === 'precase' || activeTab === 'calculation' || activeTab === 'settings') && (
                  <TriangleChart 
                    ref={svgRef} 
                    config={config} 
                    labelPositions={labelPositions}
                    onLabelPositionChange={setLabelPositions}
                    nodeValuePositions={nodeValuePositions}
                    onNodeValuePositionChange={setNodeValuePositions}
                    onChange={setConfig}
                    showBreakpoints={showBreakpoints}
                  />
                )}
              </div>
            </div>
          </div>
          {/* 署名 */}
          <div className="absolute bottom-4 right-4 text-xs text-muted-foreground/60">
            Created by Louis Li
          </div>
        </main>
      </div>
    </div>
  )
}
