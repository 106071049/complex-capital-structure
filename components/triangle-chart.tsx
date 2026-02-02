"use client"

import { forwardRef, useMemo, useState } from "react"
import type { ChartConfig } from "@/lib/chart-types"
import { JSX } from "react" // Import JSX to fix the undeclared variable error

interface TriangleChartProps {
  config: ChartConfig
  scale?: number
  labelPositions?: Record<string, { x: number; y: number }>
  onLabelPositionChange?: (positions: Record<string, { x: number; y: number }>) => void
}

export const TriangleChart = forwardRef<SVGSVGElement, TriangleChartProps>(
  function TriangleChart({ config, scale = 1, labelPositions = {}, onLabelPositionChange }, ref) {
    const [draggedLabel, setDraggedLabel] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)
    const [isPanning, setIsPanning] = useState(false)
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
    const [panStart, setPanStart] = useState({ x: 0, y: 0 })
    const { canvas, axes, fan, layers, legend, showNotToScale, typography } = config
    const fontSize = typography?.fontSize ?? 14
    const fontFamily = typography?.fontFamily ?? "Arial, sans-serif"

    const scaledWidth = canvas.width * scale
    const scaledHeight = canvas.height * scale

    // Calculate the fan geometry
    const geometry = useMemo(() => {
      const padding = { left: 60, right: legend.enabled ? 280 : 40, top: 40, bottom: 60 }
      const chartWidth = canvas.width - padding.left - padding.right
      const chartHeight = canvas.height - padding.top - padding.bottom

      // Fan start and end points
      const startX = padding.left + (fan.start.mode === "auto" ? 0 : fan.start.x - padding.left)
      // Adjust startY so triangle base aligns with X-axis (which is at startY + 20)
      const startY = padding.top + chartHeight - 20
      const endX = padding.left + chartWidth
      const endY = padding.top

      // Calculate total height of all layers
      // Use percent if available, otherwise fall back to height
      const hasPercents = layers.some(layer => layer.percent !== undefined)
      const totalLayerHeight = hasPercents
        ? layers.reduce((sum, layer) => sum + (layer.percent || 0), 0)
        : layers.reduce((sum, layer) => sum + layer.height, 0)

      // Calculate layer boundaries on the right edge
      const layerBoundaries: { top: number; bottom: number; layer: typeof layers[0] }[] = []
      let currentY = endY

      layers.forEach((layer) => {
        const layerValue = hasPercents ? (layer.percent || 0) : layer.height
        const layerHeightRatio = layerValue / totalLayerHeight
        const layerHeight = (startY - endY) * layerHeightRatio
        layerBoundaries.push({
          top: currentY,
          bottom: currentY + layerHeight,
          layer,
        })
        currentY += layerHeight
      })

      return {
        padding,
        chartWidth,
        chartHeight,
        startX,
        startY,
        endX,
        endY,
        layerBoundaries,
      }
    }, [canvas, fan, layers, legend])

    // Function to find intersection point on the sloped edge
    const getLeftEdgeX = (y: number) => {
      const { startX, startY, endX, endY } = geometry
      const t = (y - startY) / (endY - startY)
      return startX + t * (endX - startX)
    }

    // Render a layer with its segments
    const renderLayer = (
      layerData: { top: number; bottom: number; layer: typeof layers[0] },
      index: number
    ) => {
      const { layer, top, bottom } = layerData
      const { endX } = geometry

      // Layer's bottom-left corner (origin point for this layer)
      const layerOriginX = getLeftEdgeX(bottom)
      const layerOriginY = bottom

      // Layer's top-left and top-right corners
      const layerTopLeftX = getLeftEdgeX(top)
      const layerTopLeftY = top
      const layerTopRightX = endX
      const layerTopRightY = top
      const layerBottomRightX = endX
      const layerBottomRightY = bottom

      // Calculate the width and height of the layer
      const topWidth = layerTopRightX - layerTopLeftX
      const bottomWidth = layerBottomRightX - layerOriginX
      const layerHeight = layerOriginY - layerTopLeftY

      // Helper function to calculate ratio for area-based distribution
      // This calculates the position t such that the cumulative area from origin
      // to t equals the target percentage of the total layer area
      const calculateRatioForArea = (cumulativeAreaPercent: number): number => {
        if (cumulativeAreaPercent <= 0) return 0
        if (cumulativeAreaPercent >= 1) return 1
        
        // Total trapezoid area:
        const totalArea = 0.5 * layerHeight * (topWidth + bottomWidth)
        const targetArea = cumulativeAreaPercent * totalArea
        
        // The area calculation depends on whether we're still on the top edge (t <= 1)
        // or have extended to the right edge (t > 1)
        
        // First, calculate the maximum area we can get from just the top edge (when t = 1)
        const maxTopEdgeArea = 0.5 * layerHeight * topWidth
        
        if (targetArea <= maxTopEdgeArea) {
          // We're still on the top edge, use simple formula
          // A(t) = 0.5 * layerHeight * topWidth * t
          // Solve for t: t = targetArea / (0.5 * layerHeight * topWidth)
          const ratio = targetArea / maxTopEdgeArea
          return ratio
        } else {
          // We've filled the top edge and need to extend to the right edge
          // The area beyond the top edge forms a quadrilateral
          // We need to find the position s along the right edge (0 <= s <= 1)
          // such that the total area equals targetArea
          
          // Area = maxTopEdgeArea + area of quadrilateral on right edge
          // Quadrilateral vertices: top-right corner, point at s on right edge, origin, top-left corner
          // But this is getting complex. Let's use a different approach.
          
          // Actually, we should return a value > 1 to indicate we're on the right edge
          // and handle this in the drawing logic
          const remainingArea = targetArea - maxTopEdgeArea
          
          // The remaining area is along the right edge
          // This forms a triangle from origin to top-right to point on right edge
          // Area of this triangle = 0.5 * bottomWidth * (layerHeight * s)
          // where s is the ratio along the right edge
          
          // Solve: 0.5 * bottomWidth * layerHeight * s = remainingArea
          const s = remainingArea / (0.5 * bottomWidth * layerHeight)
          
          // Return 1 + s to indicate we're on the right edge
          return 1.0 + Math.min(1.0, s)
        }
      }

      // Calculate segment boundaries
      let currentPercent = 0
      const segmentPolygons: JSX.Element[] = []
      const segmentLabels: JSX.Element[] = []

      layer.segments.forEach((segment, segIndex) => {
        // Calculate the percentage range for this segment
        const startPercent = currentPercent / 100
        const endPercent = (currentPercent + segment.percent) / 100

        // Calculate the ratio for area-based distribution
        const startRatio = calculateRatioForArea(startPercent)
        let endRatio = calculateRatioForArea(endPercent)
        
        // For the last segment, ensure it extends to the bottom-right corner
        if (segIndex === layer.segments.length - 1) {
          endRatio = 2.0 // 2.0 means bottom of right edge
        }

        // Verify the area calculation (for debugging)
        const calculateActualArea = (ratio: number): number => {
          if (ratio <= 1.0) {
            return 0.5 * layerHeight * topWidth * ratio
          } else {
            const maxTopEdgeArea = 0.5 * layerHeight * topWidth
            const s = ratio - 1.0
            const rightEdgeArea = 0.5 * bottomWidth * layerHeight * s
            return maxTopEdgeArea + rightEdgeArea
          }
        }
        
        const startArea = calculateActualArea(startRatio)
        const endArea = calculateActualArea(endRatio)
        const debugSegmentArea = endArea - startArea
        const totalArea = 0.5 * layerHeight * (topWidth + bottomWidth)
        const actualPercent = (debugSegmentArea / totalArea) * 100
        
        // Log if there's a significant discrepancy
        if (Math.abs(actualPercent - segment.percent) > 0.1) {
          console.log(`Layer ${layer.name}, Segment ${segment.label}: Expected ${segment.percent}%, Got ${actualPercent.toFixed(2)}%`)
          console.log(`  startRatio: ${startRatio.toFixed(4)}, endRatio: ${endRatio.toFixed(4)}`)
          console.log(`  topWidth: ${topWidth.toFixed(2)}, bottomWidth: ${bottomWidth.toFixed(2)}`)
          console.log(`  actualPercent: ${actualPercent.toFixed(2)}%`)
        }
        
        // Calculate segment area for label positioning (reuse calculated values)
        const segmentArea = debugSegmentArea

        // Calculate points based on ratio values
        // If ratio <= 1: point is on top edge
        // If ratio > 1: point is on right edge, with (ratio - 1) being the position along right edge
        
        let startPoint: { x: number; y: number }
        let endPoint: { x: number; y: number }
        
        if (startRatio <= 1.0) {
          // Start point is on top edge
          startPoint = {
            x: layerTopLeftX + topWidth * startRatio,
            y: layerTopLeftY
          }
        } else {
          // Start point is on right edge
          const s = startRatio - 1.0
          startPoint = {
            x: layerTopRightX,
            y: layerTopRightY + layerHeight * s
          }
        }
        
        if (endRatio <= 1.0) {
          // End point is on top edge
          endPoint = {
            x: layerTopLeftX + topWidth * endRatio,
            y: layerTopLeftY
          }
        } else {
          // End point is on right edge
          const s = endRatio - 1.0
          endPoint = {
            x: layerTopRightX,
            y: layerTopRightY + layerHeight * s
          }
        }

        // Create polygon points based on segment position
        let points: string
        
        if (startRatio <= 1.0 && endRatio <= 1.0) {
          // Both points on top edge - simple triangle
          points = [
            `${layerOriginX},${layerOriginY}`,
            `${startPoint.x},${startPoint.y}`,
            `${endPoint.x},${endPoint.y}`,
          ].join(" ")
        } else if (startRatio <= 1.0 && endRatio > 1.0) {
          // Start on top edge, end on right edge - quadrilateral
          points = [
            `${layerOriginX},${layerOriginY}`,
            `${startPoint.x},${startPoint.y}`,
            `${layerTopRightX},${layerTopRightY}`, // Top-right corner
            `${endPoint.x},${endPoint.y}`,
          ].join(" ")
        } else {
          // Both on right edge - triangle
          points = [
            `${layerOriginX},${layerOriginY}`,
            `${startPoint.x},${startPoint.y}`,
            `${endPoint.x},${endPoint.y}`,
          ].join(" ")
        }

        // Calculate center for label (original position)
        // Use proper centroid calculation based on polygon shape
        let centerX: number
        let centerY: number
        
        if (startRatio <= 1.0 && endRatio <= 1.0) {
          // Triangle: simple average of three points
          centerX = (layerOriginX + startPoint.x + endPoint.x) / 3
          centerY = (layerOriginY + startPoint.y + endPoint.y) / 3
        } else if (startRatio <= 1.0 && endRatio > 1.0) {
          // Quadrilateral: average of four points
          centerX = (layerOriginX + startPoint.x + layerTopRightX + endPoint.x) / 4
          centerY = (layerOriginY + startPoint.y + layerTopRightY + endPoint.y) / 4
        } else {
          // Triangle on right edge: average of three points
          centerX = (layerOriginX + startPoint.x + endPoint.x) / 3
          centerY = (layerOriginY + startPoint.y + endPoint.y) / 3
        }

        // Get custom label position if exists
        const labelKey = `${layer.id}-${segment.id}`
        const customPos = labelPositions[labelKey]
        const hasCustomPosition = !!customPos
        
        // Use custom position or default position
        const labelX = customPos?.x ?? centerX
        const labelY = customPos?.y ?? centerY

        // Handle label dragging
        const handleLabelMouseDown = (e: React.MouseEvent<SVGGElement>) => {
          if (!onLabelPositionChange) return
          e.stopPropagation()
          setDraggedLabel(labelKey)
          
          const svg = (e.target as SVGElement).ownerSVGElement
          if (!svg) return
          
          const pt = svg.createSVGPoint()
          pt.x = e.clientX
          pt.y = e.clientY
          const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())
          
          setDragOffset({
            x: svgP.x - labelX,
            y: svgP.y - labelY
          })
        }

        const isHovered = hoveredSegment === labelKey

        // Push polygon to array
        segmentPolygons.push(
          <polygon
            key={`${layer.id}-${segment.id}-${segIndex}-poly`}
            points={points}
            fill={segment.color}
            stroke="#000000"
            strokeWidth={isHovered ? fan.innerStrokeWidth * 2 : fan.innerStrokeWidth}
            style={{
              filter: isHovered ? 'brightness(1.15) drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setHoveredSegment(labelKey)}
            onMouseLeave={() => setHoveredSegment(null)}
          />
        )

        // Push label to separate array (will be rendered on top)
        if (segment.label) {
          segmentLabels.push(
            <g 
              key={`${layer.id}-${segment.id}-${segIndex}-label`}
              onMouseEnter={() => setHoveredSegment(labelKey)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {/* Draggable label */}
              <g
                onMouseDown={handleLabelMouseDown}
                style={{ 
                  cursor: onLabelPositionChange ? 'move' : 'default',
                  transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                  transformOrigin: `${labelX}px ${labelY}px`,
                  transition: 'transform 0.2s ease'
                }}
              >
                {/* Leader line when label is moved (render first, behind text) */}
                {hasCustomPosition && (() => {
                  // Calculate the direction vector from center to label
                  const dx = labelX - centerX
                  const dy = labelY - centerY
                  const distance = Math.sqrt(dx * dx + dy * dy)
                  
                  // Stop the line before reaching the text (leave a gap)
                  const gap = isHovered ? 45 : 35 // Larger gap on hover due to background box
                  const ratio = distance > gap ? (distance - gap) / distance : 0
                  
                  // Calculate the end point of the line (before the text)
                  const lineEndX = centerX + dx * ratio
                  const lineEndY = centerY + dy * ratio
                  
                  return (
                    <line
                      x1={centerX}
                      y1={centerY}
                      x2={lineEndX}
                      y2={lineEndY}
                      stroke="#000000"
                      strokeWidth={isHovered ? 1.5 : 1}
                      strokeDasharray="4 2"
                      opacity={isHovered ? 0.7 : 0.5}
                      style={{ transition: 'all 0.2s ease' }}
                    />
                  )
                })()}
                {/* Background for better readability on hover */}
                {isHovered && (
                  <rect
                    x={labelX - 40}
                    y={labelY - 15}
                    width={80}
                    height={35}
                    fill={segment.color}
                    opacity={0.95}
                    rx={4}
                    style={{
                      filter: 'brightness(1.3) drop-shadow(0 2px 4px rgba(0,0,0,0.15))'
                    }}
                  />
                )}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground font-medium"
                  style={{ 
                    fontSize: Math.max(9, Math.min(fontSize * 0.85, (bottom - top) / 4)),
                    fontFamily: fontFamily,
                    fontWeight: isHovered ? 600 : 500
                  }}
                >
                  {segment.label}
                  <tspan x={labelX} dy="1.2em" style={{ fontSize: fontSize * 0.7, fontFamily: fontFamily }}>
                    {segment.percent.toFixed(1)}%
                  </tspan>
                </text>
              </g>
            </g>
          )
        }

        // Push dotted separator
        if (fan.showDottedSeparators && segIndex < layer.segments.length - 1) {
          segmentPolygons.push(
            <line
              key={`${layer.id}-${segment.id}-${segIndex}-separator`}
              x1={layerOriginX}
              y1={layerOriginY}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="#000000"
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.5}
            />
          )
        }

        currentPercent += segment.percent
      })

      return (
        <g key={layer.id}>
          {/* Render polygons and separators first */}
          {segmentPolygons}
          {/* Layer separator line */}
          {index < layers.length - 1 && (
            <line
              x1={getLeftEdgeX(bottom)}
              y1={bottom}
              x2={endX}
              y2={bottom}
              stroke="#000000"
              strokeWidth={fan.innerStrokeWidth}
            />
          )}
          {/* Render labels on top */}
          {segmentLabels}
        </g>
      )
    }

    // Render legend
    const renderLegend = () => {
      if (!legend.enabled) return null

      const legendX = geometry.endX + 20
      let legendY = geometry.endY

      const items: JSX.Element[] = []

      layers.forEach((layer, layerIndex) => {
        items.push(
          <text
            key={`legend-title-${layer.id}`}
            x={legendX}
            y={legendY}
            className="fill-foreground font-semibold"
            style={{ fontSize: fontSize * 0.85, fontFamily: fontFamily }}
          >
            {layer.name}
          </text>
        )
        legendY += 18

        layer.segments.forEach((segment) => {
          items.push(
            <g key={`legend-${layer.id}-${segment.id}`}>
              <rect x={legendX} y={legendY - 10} width={12} height={12} fill={segment.color} rx={2} />
              <text x={legendX + 18} y={legendY} className="fill-muted-foreground" style={{ fontSize: fontSize * 0.75, fontFamily: fontFamily }}>
                {segment.label}: {segment.percent.toFixed(1)}%
              </text>
            </g>
          )
          legendY += 16
        })

        if (layerIndex < layers.length - 1) {
          legendY += 10
        }
      })

      return <g>{items}</g>
    }

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        width={scaledWidth}
        height={scaledHeight}
        className="bg-background"
        onMouseMove={(e) => {
          if (draggedLabel) {
            const svg = e.currentTarget
            const pt = svg.createSVGPoint()
            pt.x = e.clientX
            pt.y = e.clientY
            const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())
            
            if (onLabelPositionChange) {
              onLabelPositionChange({
                ...labelPositions,
                [draggedLabel]: {
                  x: svgP.x - dragOffset.x,
                  y: svgP.y - dragOffset.y
                }
              })
            }
          } else if (isPanning) {
            const svg = e.currentTarget
            const pt = svg.createSVGPoint()
            pt.x = e.clientX
            pt.y = e.clientY
            const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())
            setPanOffset({
              x: svgP.x - panStart.x,
              y: svgP.y - panStart.y
            })
          }
        }}
        onMouseUp={() => {
          setDraggedLabel(null)
          setIsPanning(false)
        }}
        onMouseLeave={() => {
          setDraggedLabel(null)
          setIsPanning(false)
        }}
      >
        {/* Background */}
        <rect 
          width={canvas.width} 
          height={canvas.height} 
          fill="#ffffff"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            const svg = e.currentTarget.ownerSVGElement
            if (!svg) return
            const pt = svg.createSVGPoint()
            pt.x = e.clientX
            pt.y = e.clientY
            const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())
            setIsPanning(true)
            setPanStart({ x: svgP.x - panOffset.x, y: svgP.y - panOffset.y })
          }}
        />

        {/* Main content group with pan transform */}
        <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>

        {/* Axes - L-shaped connected axes */}
        {(axes.showY || axes.showX) && (
          <g>
            {/* Y-axis (vertical) */}
            {axes.showY && (
              <>
                <line
                  x1={geometry.startX}
                  y1={geometry.startY}
                  x2={geometry.startX}
                  y2={geometry.endY - 20}
                  stroke="#000000"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
                <text
                  x={geometry.startX - 15}
                  y={(geometry.startY + geometry.endY) / 2}
                  textAnchor="middle"
                  fill="#666666"
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  fontWeight="500"
                  transform={`rotate(-90, ${geometry.startX - 15}, ${(geometry.startY + geometry.endY) / 2})`}
                >
                  Value
                </text>
              </>
            )}
            
            {/* X-axis (horizontal) */}
            {axes.showX && (
              <>
                <line
                  x1={geometry.startX}
                  y1={geometry.startY}
                  x2={geometry.endX + 40}
                  y2={geometry.startY}
                  stroke="#000000"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
                <text
                  x={(geometry.padding.left + geometry.endX) / 2}
                  y={geometry.startY + 25}
                  textAnchor="middle"
                  fill="#666666"
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  fontWeight="500"
                >
                  Proceeds
                </text>
              </>
            )}
          </g>
        )}

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--foreground)" />
          </marker>
        </defs>

        {/* Fan layers */}
        {fan.enabled && (
          <g>
            {geometry.layerBoundaries.map((layerData, index) => renderLayer(layerData, index))}

            {/* Outer border - sloped edge */}
            <line
              x1={geometry.startX}
              y1={geometry.startY}
              x2={geometry.endX}
              y2={geometry.endY}
              stroke="#000000"
              strokeWidth={fan.outerStrokeWidth}
            />

            {/* Outer border - right edge */}
            <line
              x1={geometry.endX}
              y1={geometry.endY}
              x2={geometry.endX}
              y2={geometry.startY}
              stroke="#000000"
              strokeWidth={fan.outerStrokeWidth}
            />

            {/* Outer border - bottom edge */}
            <line
              x1={geometry.startX}
              y1={geometry.startY}
              x2={geometry.endX}
              y2={geometry.startY}
              stroke="#000000"
              strokeWidth={fan.outerStrokeWidth}
            />
          </g>
        )}

        {renderLegend()}
        </g>
      </svg>
    )
  }
)
