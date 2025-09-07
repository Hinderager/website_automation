import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

// Idaho locations for random geotag selection
const IDAHO_LOCATIONS = [
  { name: 'Boise', lat: 43.6150, lng: -116.2023 },
  { name: 'Meridian', lat: 43.6121, lng: -116.3915 },
  { name: 'Eagle', lat: 43.6963, lng: -116.3540 },
  { name: 'Nampa', lat: 43.5407, lng: -116.5635 },
  { name: 'Kuna', lat: 43.4913, lng: -116.4201 },
  { name: 'Garden City', lat: 43.6046, lng: -116.2708 }
]

const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY
const FREEPIK_IMAGE_MODEL = process.env.FREEPIK_IMAGE_MODEL || 'imagen nano banana'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const instruction = formData.get('instruction') as string || 'Enhance this image for professional web use'
    const includeGeotag = formData.get('geotag') === 'true'

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    if (!FREEPIK_API_KEY) {
      return NextResponse.json({ error: 'Freepik API key not configured' }, { status: 500 })
    }

    // Convert image to buffer
    const imageBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(imageBuffer)

    // Convert to WebP using Sharp
    let webpBuffer = await sharp(buffer)
      .webp({ quality: 85 })
      .toBuffer()

    // Get image metadata for alt text generation
    const metadata = await sharp(buffer).metadata()
    
    // Convert to base64 for Freepik API
    const imageBase64 = webpBuffer.toString('base64')

    // Call Freepik API for AI processing
    let processedImageBase64 = imageBase64
    let aiGeneratedAlt = `Professional image (${metadata.width}x${metadata.height})`

    try {
      const freepikResponse = await fetch('https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview', {
        method: 'POST',
        headers: {
          'x-freepik-api-key': FREEPIK_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: FREEPIK_IMAGE_MODEL,
          image: `data:image/webp;base64,${imageBase64}`,
          prompt: instruction,
          aspect_ratio: process.env.FREEPIK_ASPECT_RATIO || 'auto'
        })
      })

      if (freepikResponse.ok) {
        const freepikResult = await freepikResponse.json()
        
        // Extract processed image and generate alt text
        if (freepikResult.data && freepikResult.data.length > 0) {
          const processedImage = freepikResult.data[0]
          
          // Get the processed image URL and convert to base64
          if (processedImage.url) {
            const imageResponse = await fetch(processedImage.url)
            const imageArrayBuffer = await imageResponse.arrayBuffer()
            processedImageBase64 = Buffer.from(imageArrayBuffer).toString('base64')
          }
          
          // Generate AI alt text based on the instruction and processing
          aiGeneratedAlt = `AI-enhanced ${instruction.toLowerCase().includes('professional') ? 'professional' : 'web'} image`
        }
      } else {
        console.warn('Freepik API failed, using original image:', await freepikResponse.text())
      }
    } catch (freepikError) {
      console.warn('Freepik API error, using original image:', freepikError)
    }

    // Add geotag if requested  
    let geotaggedImageBase64 = processedImageBase64
    let appliedLocation = null

    if (includeGeotag) {
      // Select random Idaho location
      const randomLocation = IDAHO_LOCATIONS[Math.floor(Math.random() * IDAHO_LOCATIONS.length)]
      appliedLocation = randomLocation
      
      try {
        // Add GPS EXIF data using Sharp
        const gpsBuffer = await sharp(Buffer.from(processedImageBase64, 'base64'))
          .withMetadata({
            exif: {
              IFD0: {
                ImageDescription: aiGeneratedAlt
              },
              GPS: {
                GPSLatitudeRef: randomLocation.lat >= 0 ? 'N' : 'S',
                GPSLatitude: Math.abs(randomLocation.lat),
                GPSLongitudeRef: randomLocation.lng >= 0 ? 'E' : 'W',
                GPSLongitude: Math.abs(randomLocation.lng)
              }
            }
          })
          .webp({ quality: 85 })
          .toBuffer()
        
        geotaggedImageBase64 = gpsBuffer.toString('base64')
      } catch (geotagError) {
        console.warn('Geotag embedding failed:', geotagError)
      }
    }

    // Generate final alt text (max 125 chars)
    let finalAltText = aiGeneratedAlt
    if (finalAltText.length > 125) {
      finalAltText = finalAltText.substring(0, 122) + '...'
    }

    return NextResponse.json({
      success: true,
      webp: `data:image/webp;base64,${geotaggedImageBase64}`,
      alt: finalAltText,
      geotag_applied: includeGeotag,
      location: appliedLocation,
      original_filename: imageFile.name,
      size_kb: Math.round(geotaggedImageBase64.length * 0.75 / 1024) // Approximate KB size
    })

  } catch (error) {
    console.error('Image processing error:', error)
    return NextResponse.json({ 
      error: 'Failed to process image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}