import type { ChartConfig } from "./chart-types"

export function exportToJSON(config: ChartConfig): string {
  return JSON.stringify(config, null, 2)
}

export function downloadJSON(config: ChartConfig, filename = "chart-config.json") {
  const json = exportToJSON(config)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function importFromJSON(jsonString: string): ChartConfig | null {
  try {
    const parsed = JSON.parse(jsonString)
    
    // Basic validation
    if (
      !parsed.canvas ||
      !parsed.axes ||
      !parsed.fan ||
      !parsed.layers ||
      !Array.isArray(parsed.layers)
    ) {
      console.error("Invalid config structure: missing required fields")
      return null
    }
    
    // Validate layers structure
    for (const layer of parsed.layers) {
      if (!layer.id || !layer.name || !layer.segments || !Array.isArray(layer.segments)) {
        console.error("Invalid layer structure:", layer)
        return null
      }
      
      // Validate segments
      for (const segment of layer.segments) {
        if (!segment.id || segment.percent === undefined || !segment.color) {
          console.error("Invalid segment structure:", segment)
          return null
        }
      }
    }
    
    return parsed as ChartConfig
  } catch (error) {
    console.error("Failed to parse JSON:", error)
    return null
  }
}

export async function exportToSVG(svgElement: SVGSVGElement): Promise<string> {
  const serializer = new XMLSerializer()
  let svgString = serializer.serializeToString(svgElement)
  
  // Add XML declaration and namespace
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  
  return svgString
}

export function downloadSVG(svgString: string, filename = "chart.svg") {
  const blob = new Blob([svgString], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportToPNG(
  svgElement: SVGSVGElement,
  scale = 2
): Promise<Blob> {
  const svgString = await exportToSVG(svgElement)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  
  if (!ctx) {
    throw new Error("Could not get canvas context")
  }

  const img = new Image()
  img.crossOrigin = "anonymous"
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      ctx.scale(scale, scale)
      
      // White background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Draw the image
      ctx.drawImage(img, 0, 0)
      
      // Add black border
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 2
      ctx.strokeRect(0, 0, img.width, img.height)
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("Could not create PNG blob"))
        }
      }, "image/png")
    }
    
    img.onerror = () => {
      reject(new Error("Could not load SVG image"))
    }
    
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)
    img.src = url
  })
}

export function downloadPNG(blob: Blob, filename = "chart.png") {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportToPPT(
  svgElement: SVGSVGElement,
  filename = "allocation-chart.pptx"
): Promise<void> {
  try {
    // Dynamic import of pptxgenjs
    const pptxgen = (await import("pptxgenjs")).default
    
    // Create a new presentation
    const pptx = new pptxgen()
    
    // Add a slide
    const slide = pptx.addSlide()
    
    // Convert SVG to PNG blob
    const pngBlob = await exportToPNG(svgElement, 2)
    
    // Convert blob to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        // Remove data URL prefix
        const base64Data = result.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(pngBlob)
    })
    
    // Add title
    slide.addText("複雜資本結構", {
      x: 0.5,
      y: 0.15,
      w: 9,
      h: 0.35,
      fontSize: 20,
      bold: true,
      color: "363636",
      align: "center"
    })
    
    // Add the chart image - adjusted to fit within slide bounds
    // Standard PowerPoint slide is 10" x 7.5"
    // Using very conservative sizing to ensure it fits completely
    slide.addImage({
      data: `image/png;base64,${base64}`,
      x: 0.5,
      y: 0.65,
      w: 9.0,
      h: 5.2,
      sizing: { type: "contain", w: 9.0, h: 5.2 }
    })
    
    // Add footer
    slide.addText("Created by Louis Li", {
      x: 7.0,
      y: 6.9,
      w: 2.5,
      h: 0.25,
      fontSize: 8,
      color: "999999",
      align: "right"
    })
    
    // Save the presentation
    await pptx.writeFile({ fileName: filename })
  } catch (error) {
    console.error("Error exporting to PPT:", error)
    throw error
  }
}
