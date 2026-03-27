"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, FileSpreadsheet, ChevronDown } from "lucide-react"
import { ChartConfig } from "@/lib/chart-types"
import { DraggableSegmentPanel } from "./draggable-segment-panel"

interface CalculationFilePanelProps {
  config: ChartConfig
  onChange: (config: ChartConfig) => void
}

export function CalculationFilePanel({ config, onChange }: CalculationFilePanelProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>("")
  const [isSheetSelectorOpen, setIsSheetSelectorOpen] = useState(false)
  const [foundCellAddress, setFoundCellAddress] = useState<string>("")
  const [workbookData, setWorkbookData] = useState<any>(null)
  const [foundAmounts, setFoundAmounts] = useState<number[]>([])
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [calculatedPercentages, setCalculatedPercentages] = useState<number[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check if file is Excel format
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/)) {
      alert('請上傳有效的 Excel 檔案 (.xlsx 或 .xls)')
      return
    }

    setUploadedFile(file)

    // Parse Excel file to get sheet names
    try {
      // We'll use xlsx library to parse the file
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheets = workbook.SheetNames
      
      setWorkbookData(workbook)
      setSheetNames(sheets)
      if (sheets.length > 0) {
        setSelectedSheet(sheets[0])
        // Search for Incremental cell in the first sheet
        searchIncrementalCell(workbook, sheets[0])
      }
    } catch (error) {
      console.error('Error parsing Excel file:', error)
      alert('解析 Excel 檔案時發生錯誤')
    }
  }

  const searchIncrementalCell = async (workbook: any, sheetName: string) => {
    try {
      const XLSX = await import('xlsx')
      const worksheet = workbook.Sheets[sheetName]
      
      if (!worksheet) {
        setFoundCellAddress('')
        setFoundAmounts([])
        setTotalAmount(0)
        setCalculatedPercentages([])
        return
      }

      // Get the range of the worksheet
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      
      let foundAddress = ''
      let foundExactMatch = false
      let foundRow = -1
      let foundCol = -1

      // Search through all cells
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          const cell = worksheet[cellAddress]
          
          if (cell && cell.v) {
            const cellValue = String(cell.v).toLowerCase()
            
            // First priority: exact match for "Incremental call option value"
            if (cellValue.includes('incremental call option value')) {
              foundAddress = cellAddress
              foundRow = row
              foundCol = col
              foundExactMatch = true
              break
            }
            
            // Second priority: contains "Incremental"
            if (!foundExactMatch && cellValue.includes('incremental')) {
              foundAddress = cellAddress
              foundRow = row
              foundCol = col
            }
          }
        }
        if (foundExactMatch) break
      }

      setFoundCellAddress(foundAddress)

      // If found, search for amounts to the right
      if (foundAddress && foundRow >= 0 && foundCol >= 0) {
        const amounts: number[] = []
        let currentCol = foundCol + 1 // Start from the next column

        // Search right until we find an empty cell
        while (currentCol <= range.e.c) {
          const cellAddress = XLSX.utils.encode_cell({ r: foundRow, c: currentCol })
          const cell = worksheet[cellAddress]
          
          // Check if cell is empty or doesn't exist
          if (!cell || cell.v === undefined || cell.v === null || cell.v === '') {
            break
          }

          // Try to parse as number
          const value = typeof cell.v === 'number' ? cell.v : parseFloat(String(cell.v).replace(/,/g, ''))
          
          if (!isNaN(value)) {
            amounts.push(value)
          } else {
            // If we encounter a non-number, stop searching
            break
          }

          currentCol++
        }

        // Calculate total and cumulative percentages
        const total = amounts.reduce((sum, amount) => sum + amount, 0)
        setFoundAmounts(amounts)
        setTotalAmount(total)

        if (total > 0) {
          // Calculate cumulative percentages
          const percentages: number[] = []
          let cumulative = 0
          
          for (let i = 0; i < amounts.length; i++) {
            cumulative += amounts[i]
            const percentage = (cumulative / total) * 100
            percentages.push(percentage)
          }
          
          setCalculatedPercentages(percentages)

          // Auto-generate layers based on amounts
          generateLayers(amounts, total, percentages)
        }
      } else {
        setFoundAmounts([])
        setTotalAmount(0)
        setCalculatedPercentages([])
      }
    } catch (error) {
      console.error('Error searching for Incremental cell:', error)
      setFoundCellAddress('')
      setFoundAmounts([])
      setTotalAmount(0)
      setCalculatedPercentages([])
    }
  }

  const generateLayers = (amounts: number[], total: number, percentages: number[]) => {
    // n amounts = n+1 layers (including the top layer which is 100%)
    // But we only show n-1 breakpoints (excluding 100%)
    const numLayers = amounts.length + 1
    const newLayers = []

    // Generate layers from bottom to top
    // Bottom layer (last in amounts array) should be Layer n
    // Top layer should be Layer 1
    
    // Calculate individual percentages for each layer
    const layerPercentages = []
    for (let i = 0; i < amounts.length; i++) {
      if (i === 0) {
        layerPercentages.push(percentages[0])
      } else {
        layerPercentages.push(percentages[i] - percentages[i - 1])
      }
    }
    
    // Add remaining percentage for top layer (100% - last cumulative percentage)
    const topLayerPercent = 100 - percentages[percentages.length - 1]
    
    // Top layer (Layer 1) - remaining percentage to 100%
    newLayers.push({
      id: `L1`,
      name: `Layer 1`,
      height: 100,
      percent: topLayerPercent,
      value: total - amounts.reduce((sum, a) => sum + a, 0),
      segments: [
        { id: `s1`, label: 'Top Layer', percent: 100, color: '#e5e7eb' }
      ]
    })

    // Generate middle layers from top to bottom (Layer 2 to Layer n)
    // But fill them with amounts from bottom to top
    for (let i = amounts.length - 1; i >= 0; i--) {
      const layerIndex = amounts.length - i + 1 // Layer 2, 3, 4...
      const percentage = layerPercentages[i]
      const value = amounts[i]

      newLayers.push({
        id: `L${layerIndex}`,
        name: `Layer ${layerIndex}`,
        height: 100,
        percent: percentage,
        value: value,
        segments: [
          { id: `s1`, label: `Segment ${layerIndex}`, percent: 100, color: '#e5e7eb' }
        ]
      })
    }

    // Update config with new layers
    onChange({
      ...config,
      layers: newLayers
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Excel Upload Section */}
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold mb-3 text-foreground">引入計算檔</h3>
        
        <div className="space-y-3">
          {/* Upload Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            className="w-full justify-start text-xs"
          >
            <Upload className="h-3.5 w-3.5 mr-2" />
            {uploadedFile ? uploadedFile.name : '上傳 Excel 檔案'}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Sheet Selector */}
          {sheetNames.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">選擇工作表</label>
              <div className="relative">
                <button
                  onClick={() => setIsSheetSelectorOpen(!isSheetSelectorOpen)}
                  className="w-full px-3 py-2 text-xs text-left bg-background border border-border rounded-md hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{selectedSheet}</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isSheetSelectorOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSheetSelectorOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-auto">
                    {sheetNames.map((sheet) => {
                      const containsCall = sheet.toLowerCase().includes('call')
                      return (
                        <button
                          key={sheet}
                          onClick={() => {
                            setSelectedSheet(sheet)
                            setIsSheetSelectorOpen(false)
                            // Search for Incremental cell when sheet is selected
                            if (workbookData) {
                              searchIncrementalCell(workbookData, sheet)
                            }
                          }}
                          className={`w-full px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors ${
                            selectedSheet === sheet 
                              ? 'bg-muted text-foreground font-medium' 
                              : containsCall
                              ? 'bg-blue-50 dark:bg-blue-950/30 text-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {sheet}
                          {containsCall && (
                            <span className="ml-2 text-[10px] text-blue-600 dark:text-blue-400">
                              (可能相關)
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* File Info */}
          {uploadedFile && (
            <div className="text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>已上傳: {uploadedFile.name}</span>
              </div>
              {sheetNames.length > 0 && (
                <div>
                  共 {sheetNames.length} 個工作表
                </div>
              )}
              {foundCellAddress && (
                <div className="space-y-2">
                  <div className="p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">找到儲存格</span>
                    </div>
                    <div className="mt-1 text-green-600 dark:text-green-300 font-mono">
                      座標: {foundCellAddress}
                    </div>
                  </div>

                  {foundAmounts.length > 0 && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                      <div className="text-blue-700 dark:text-blue-400 font-medium mb-2">
                        探索到的金額 ({foundAmounts.length} 個)
                      </div>
                      <div className="space-y-1 text-xs">
                        {foundAmounts.map((amount, index) => (
                          <div key={index} className="flex justify-between items-center text-blue-600 dark:text-blue-300">
                            <span>第 {index + 1} 個:</span>
                            <span className="font-mono">{amount.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="pt-2 mt-2 border-t border-blue-200 dark:border-blue-700 flex justify-between items-center font-semibold text-blue-700 dark:text-blue-300">
                          <span>總和:</span>
                          <span className="font-mono">{totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {calculatedPercentages.length > 0 && (
                    <div className="p-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-md">
                      <div className="text-purple-700 dark:text-purple-400 font-medium mb-2">
                        累加比率 (Breakpoint 點)
                      </div>
                      <div className="space-y-1 text-xs">
                        {calculatedPercentages.slice(0, -1).map((percentage, index) => {
                          const cumAmount = foundAmounts.slice(0, index + 1).reduce((sum, a) => sum + a, 0)
                          return (
                            <div key={index} className="flex justify-between items-center text-purple-600 dark:text-purple-300">
                              <span>Breakpoint {index + 1} (從底層往上):</span>
                              <span className="font-mono">
                                {cumAmount.toLocaleString()} / {totalAmount.toLocaleString()} = {percentage.toFixed(1)}%
                              </span>
                            </div>
                          )
                        })}
                        <div className="pt-2 mt-2 border-t border-purple-200 dark:border-purple-700 space-y-1">
                          <div className="text-purple-700 dark:text-purple-300 font-medium">
                            共 {foundAmounts.length - 1} 個 Breakpoint 點
                          </div>
                          <div className="text-purple-600 dark:text-purple-400 text-[10px]">
                            (100% 不顯示在圖表上)
                          </div>
                          <div className="text-purple-700 dark:text-purple-300 font-medium">
                            自動生成 {foundAmounts.length + 1} 層
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedSheet && !foundCellAddress && uploadedFile && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                  <div className="text-amber-700 dark:text-amber-400">
                    未找到包含 "Incremental" 的儲存格
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Draggable Segment Panel */}
      <div className="flex-1 overflow-hidden">
        <DraggableSegmentPanel config={config} onChange={onChange} />
      </div>
    </div>
  )
}
