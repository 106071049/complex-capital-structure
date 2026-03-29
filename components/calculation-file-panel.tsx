"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, FileSpreadsheet, ChevronDown } from "lucide-react"
import { ChartConfig } from "@/lib/chart-types"

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
  const [productCellAddress, setProductCellAddress] = useState<string>("")
  const [productNames, setProductNames] = useState<string[]>([])
  const [productData, setProductData] = useState<number[][]>([]) // [product][column] = value
  const [layerTotals, setLayerTotals] = useState<number[]>([]) // Total for each column/layer
  const [productPercentages, setProductPercentages] = useState<number[][]>([]) // [product][column] = percentage
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

      // Variables to store for later use with product data
      let storedAmounts: number[] = []
      let storedTotal = 0
      let storedPercentages: number[] = []

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

          // Store for later use with product data
          storedAmounts = amounts
          storedTotal = total
          storedPercentages = percentages

          // Auto-generate layers based on amounts
          // Will be called again after product data is loaded
          generateLayers(amounts, total, percentages, [], [], [])
        }
      } else {
        setFoundAmounts([])
        setTotalAmount(0)
        setCalculatedPercentages([])
      }

      // Search for product cell: "$ / No. of FD CSEs at Breakpoint" or contains "$ / No" and "FD"
      let productAddress = ''
      let productRow = -1
      let productCol = -1

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          const cell = worksheet[cellAddress]
          
          if (cell && cell.v) {
            const cellValue = String(cell.v).toLowerCase()
            
            // First priority: exact match for "$ / No. of FD CSEs at Breakpoint"
            if (cellValue.includes('$ / no. of fd cses at breakpoint')) {
              productAddress = cellAddress
              productRow = row
              productCol = col
              break
            }
            
            // Second priority: contains "$ / no" and "fd"
            if (cellValue.includes('$ / no') && cellValue.includes('fd')) {
              productAddress = cellAddress
              productRow = row
              productCol = col
            }
          }
        }
        if (productAddress && productRow >= 0) break
      }

      setProductCellAddress(productAddress)

      // If found, search for product names below
      if (productAddress && productRow >= 0 && productCol >= 0) {
        const products: string[] = []
        let currentRow = productRow + 1 // Start from the next row

        // Search down until we find "total" or empty cell
        while (currentRow <= range.e.r) {
          const cellAddress = XLSX.utils.encode_cell({ r: currentRow, c: productCol })
          const cell = worksheet[cellAddress]
          
          // Check if cell is empty or doesn't exist
          if (!cell || cell.v === undefined || cell.v === null || cell.v === '') {
            currentRow++
            continue // Skip empty cells
          }

          const cellValue = String(cell.v).trim()
          
          // Stop if we encounter "total"
          if (cellValue.toLowerCase() === 'total') {
            break
          }

          // Add non-empty product name
          if (cellValue) {
            products.push(cellValue)
          }

          currentRow++
        }

        setProductNames(products)

        // Now read data for each product to the right
        if (products.length > 0) {
          const allProductData: number[][] = []
          const productStartRow = productRow + 1

          // For each product, read values to the right
          for (let i = 0; i < products.length; i++) {
            const productRowIndex = productStartRow + i
            const rowData: number[] = []
            let currentCol = productCol + 1 // Start from the next column

            // Read right until we find a column where ALL products have empty cells
            while (currentCol <= range.e.c) {
              const cellAddress = XLSX.utils.encode_cell({ r: productRowIndex, c: currentCol })
              const cell = worksheet[cellAddress]
              
              // Parse value
              let value = 0
              if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
                value = typeof cell.v === 'number' ? cell.v : parseFloat(String(cell.v).replace(/,/g, ''))
                if (isNaN(value)) value = 0
              }
              
              rowData.push(value)
              currentCol++
            }

            allProductData.push(rowData)
          }

          // Find the maximum number of columns (some products might have different lengths)
          const maxCols = Math.max(...allProductData.map(row => row.length))

          // Normalize all rows to have the same length, padding with 0
          const normalizedData = allProductData.map(row => {
            const normalized = [...row]
            while (normalized.length < maxCols) {
              normalized.push(0)
            }
            return normalized
          })

          // Check which columns have all zeros and trim from the end
          let lastNonZeroCol = -1
          for (let col = 0; col < maxCols; col++) {
            const hasNonZero = normalizedData.some(row => row[col] !== 0)
            if (hasNonZero) {
              lastNonZeroCol = col
            }
          }

          // Trim to only include columns up to the last non-zero column
          const trimmedData = normalizedData.map(row => row.slice(0, lastNonZeroCol + 1))
          
          setProductData(trimmedData)

          // Calculate layer totals (sum each column)
          const totals: number[] = []
          const numCols = trimmedData[0]?.length || 0
          for (let col = 0; col < numCols; col++) {
            const total = trimmedData.reduce((sum, row) => sum + (row[col] || 0), 0)
            totals.push(total)
          }
          setLayerTotals(totals)

          // Calculate percentages for each product in each column
          const percentages: number[][] = []
          for (let i = 0; i < trimmedData.length; i++) {
            const productPercentages: number[] = []
            for (let col = 0; col < numCols; col++) {
              const value = trimmedData[i][col] || 0
              const total = totals[col] || 0
              const percentage = total > 0 ? (value / total) * 100 : 0
              productPercentages.push(percentage)
            }
            percentages.push(productPercentages)
          }
          setProductPercentages(percentages)

          // Re-generate layers with product data
          if (storedAmounts.length > 0 && storedTotal > 0 && storedPercentages.length > 0) {
            generateLayers(storedAmounts, storedTotal, storedPercentages, products, trimmedData, percentages)
          }
        } else {
          setProductData([])
          setLayerTotals([])
          setProductPercentages([])
        }
      } else {
        setProductNames([])
        setProductData([])
        setLayerTotals([])
        setProductPercentages([])
      }
    } catch (error) {
      console.error('Error searching for Incremental cell:', error)
      setFoundCellAddress('')
      setFoundAmounts([])
      setTotalAmount(0)
      setCalculatedPercentages([])
      setProductCellAddress('')
      setProductNames([])
      setProductData([])
      setLayerTotals([])
      setProductPercentages([])
    }
  }

  const generateLayers = (
    amounts: number[], 
    total: number, 
    percentages: number[],
    products: string[],
    prodData: number[][],
    prodPercentages: number[][]
  ) => {
    // n amounts = n+1 layers (including the top layer which is 100%)
    // All n amounts will have breakpoint data (cumulative from bottom)
    const numLayers = amounts.length + 1
    const newLayers = []
    
    // Define colors for different products
    const productColors = [
      '#86efac', // green
      '#fdba74', // orange
      '#bfdbfe', // blue
      '#fcd34d', // yellow
      '#fecaca', // red
      '#c4b5fd', // purple
      '#fda4af', // pink
      '#a7f3d0', // teal
      '#fde68a', // amber
      '#ddd6fe', // lavender
    ]

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
    // No cumulative data for top layer (it's 100%)
    newLayers.push({
      id: `L1`,
      name: `Layer 1`,
      height: 100,
      percent: topLayerPercent,
      value: total - amounts.reduce((sum, a) => sum + a, 0),
      segments: [
        { id: `s1`, label: '', percent: 100, color: '#e5e7eb' }
      ]
    })

    // Generate layers from Layer 2 to Layer n+1
    // Layer 2 is right below top layer
    // Layer n+1 is the bottom layer
    // Breakpoints are assigned from bottom up, but shifted up by one layer:
    // - Layer n (second from bottom) gets breakpoint 1
    // - Layer n-1 (third from bottom) gets breakpoint 2
    // - Layer n+1 (bottom layer) has no breakpoint
    for (let i = amounts.length - 1; i >= 0; i--) {
      const layerIndex = amounts.length - i + 1 // Layer 2, 3, 4...
      const percentage = layerPercentages[i]
      const value = amounts[i]
      
      // Assign cumulative data, shifted up by one layer
      // Layer n (layerIndex = amounts.length) should get percentages[0] (first breakpoint)
      // Layer n-1 (layerIndex = amounts.length - 1) should get percentages[1] (second breakpoint)
      // Layer n+1 (layerIndex = amounts.length + 1, bottom) has no cumulative data
      const cumulativeIndex = amounts.length - layerIndex
      const hasCumulativeData = cumulativeIndex >= 0 && cumulativeIndex < percentages.length
      
      // Create segments based on product data
      // Product data columns: column 0 = 層級1 (bottom layer), column 1 = 層級2, etc.
      // layerIndex: Layer 2 = second from top, Layer 3 = third from top, ..., Layer n+1 = bottom
      // Bottom layer (Layer n+1) should use column 0
      // Second from bottom (Layer n) should use column 1
      // So: columnIndex = amounts.length - layerIndex + 1
      // But we need to map: Layer n+1 -> column 0, Layer n -> column 1
      // layerIndex goes from (amounts.length + 1) down to 2
      // When layerIndex = amounts.length + 1 (bottom), we want column 0
      // When layerIndex = amounts.length (second from bottom), we want column 1
      // Formula: columnIndex = amounts.length - layerIndex + 1
      const columnIndex = amounts.length - layerIndex + 1
      const segments = []
      
      if (products.length > 0 && prodPercentages.length > 0 && columnIndex >= 0 && columnIndex < prodPercentages[0]?.length) {
        // Add segments for products with percentage > 0
        for (let p = 0; p < products.length; p++) {
          const productPercent = prodPercentages[p]?.[columnIndex] || 0
          if (productPercent > 0) {
            segments.push({
              id: `s${p + 1}`,
              label: products[p],
              percent: productPercent,
              color: productColors[p % productColors.length]
            })
          }
        }
      }
      
      // If no segments were created (no product data), use default segment
      if (segments.length === 0) {
        segments.push({
          id: `s1`,
          label: `Segment ${layerIndex}`,
          percent: 100,
          color: '#e5e7eb'
        })
      }
      
      const layer: any = {
        id: `L${layerIndex}`,
        name: `Layer ${layerIndex}`,
        height: 100,
        percent: percentage,
        value: value,
        segments: segments
      }
      
      if (hasCumulativeData) {
        layer.cumulativePercent = percentages[cumulativeIndex]
        layer.cumulativeAmount = amounts.slice(0, cumulativeIndex + 1).reduce((sum, a) => sum + a, 0)
      }

      newLayers.push(layer)
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
      <div className="flex-1 overflow-y-auto p-4 border-b border-border bg-muted/30">
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
                          <div className="text-purple-700 dark:text-purple-300 font-medium">
                            自動生成 {foundAmounts.length} 層
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product Information */}
                  {productCellAddress && (
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">找到金融商品儲存格</span>
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-300 font-mono text-xs mb-2">
                        座標: {productCellAddress}
                      </div>
                      {productNames.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-emerald-700 dark:text-emerald-300 font-medium text-xs">
                            偵測到 {productNames.length} 個金融商品:
                          </div>
                          <div className="space-y-0.5 text-xs">
                            {productNames.map((product, index) => (
                              <div key={index} className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400">
                                <span className="font-mono">{index + 1}.</span>
                                <span>{product}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Product Data Table */}
                  {productData.length > 0 && layerTotals.length > 0 && (
                    <div className="p-2 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-md">
                      <div className="text-slate-700 dark:text-slate-300 font-medium mb-2 text-xs">
                        產品數據與百分比 ({layerTotals.length} 個層級)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] border-collapse">
                          <thead>
                            <tr className="border-b border-slate-300 dark:border-slate-700">
                              <th className="text-left p-1 text-slate-600 dark:text-slate-400">產品</th>
                              {layerTotals.map((_, colIndex) => (
                                <th key={colIndex} className="text-right p-1 text-slate-600 dark:text-slate-400">
                                  層級 {colIndex + 1}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {productNames.map((product, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-slate-200 dark:border-slate-800">
                                <td className="p-1 text-slate-700 dark:text-slate-300 font-medium">{product}</td>
                                {productData[rowIndex]?.map((value, colIndex) => (
                                  <td key={colIndex} className="text-right p-1 text-slate-600 dark:text-slate-400">
                                    <div>{value.toLocaleString()}</div>
                                    <div className="text-[9px] text-slate-500 dark:text-slate-500">
                                      ({productPercentages[rowIndex]?.[colIndex]?.toFixed(2) || '0.00'}%)
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="border-t-2 border-slate-400 dark:border-slate-600 font-semibold">
                              <td className="p-1 text-slate-800 dark:text-slate-200">Total</td>
                              {layerTotals.map((total, colIndex) => (
                                <td key={colIndex} className="text-right p-1 text-slate-800 dark:text-slate-200">
                                  {total.toLocaleString()}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
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

    </div>
  )
}
