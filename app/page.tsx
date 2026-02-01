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
  const [config, setConfig] = useState<ChartConfig>(defaultChartConfig)
  const [sidebarWidth, setSidebarWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const [zoom, setZoom] = useState(1.0)
  const [activeTab, setActiveTab] = useState<'settings' | 'segments'>('segments')
  const [labelPositions, setLabelPositions] = useState<Record<string, { x: number; y: number }>>({})
  const svgRef = useRef<SVGSVGElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  // Clear label positions when layers change to prevent misalignment
  useEffect(() => {
    setLabelPositions({})
  }, [config.layers.length])

  const handleExportJSON = () => {
    downloadJSON(config, "allocation-chart-config.json")
  }

  const handleExportSVG = async () => {
    if (!svgRef.current) return
    const svgString = await exportToSVG(svgRef.current)
    downloadSVG(svgString, "allocation-chart.svg")
  }

  const handleExportPNG = async (scale: number) => {
    if (!svgRef.current) return
    try {
      const blob = await exportToPNG(svgRef.current, scale)
      downloadPNG(blob, `allocation-chart-${scale}x.png`)
    } catch (error) {
      console.error("Failed to export PNG:", error)
    }
  }

  const handleExportPPT = async () => {
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
  }

  const handleImportJSON = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = e.clientX
    if (newWidth >= 300 && newWidth <= 600) {
      setSidebarWidth(newWidth)
    }
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

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
            <h1 className="text-base font-semibold text-foreground">
              複雜資本結構
            </h1>
            <p className="text-xs text-muted-foreground">
              Create and export allocation diagrams
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                onClick={() => setActiveTab('segments')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'segments'
                    ? 'bg-background text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Segments
              </button>
              <button
                onClick={() => setActiveTab('settings')}
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
          {activeTab === 'segments' ? (
            <DraggableSegmentPanel config={config} onChange={setConfig} />
          ) : (
            <ControlPanel config={config} onChange={setConfig} />
          )}
          
          {/* Resizer */}
          <div
            onMouseDown={handleMouseDown}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors ${
              isResizing ? 'bg-primary' : ''
            }`}
            style={{ zIndex: 10 }}
          >
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-12 bg-primary/30 rounded-l" />
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
            <div className="flex items-center justify-center min-h-full">
              <div
                className="bg-background rounded-lg shadow-lg border border-border overflow-hidden"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                <TriangleChart 
                  ref={svgRef} 
                  config={config} 
                  labelPositions={labelPositions}
                  onLabelPositionChange={setLabelPositions}
                />
              </div>
            </div>
            {/* 署名 */}
            <div className="absolute bottom-4 right-4 text-xs text-muted-foreground/60">
              Created by Louis Li
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
