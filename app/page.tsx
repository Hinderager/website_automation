'use client'

import { useState, useRef, useEffect } from 'react'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'text' | 'pictures'>('text')

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Website Automator
          </h1>
          <p className="text-lg text-gray-600">
            Internal tool for WordPress page copy and image assets
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 justify-center">
              <button
                onClick={() => setActiveTab('text')}
                className={`py-2 px-4 border-b-2 font-medium text-sm ${
                  activeTab === 'text'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📝 Text Generation
              </button>
              <button
                onClick={() => setActiveTab('pictures')}
                className={`py-2 px-4 border-b-2 font-medium text-sm ${
                  activeTab === 'pictures'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🖼️ Image Processing
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'text' ? <TextTab /> : <PicturesTab />}
      </div>
    </main>
  )
}

function TextTab() {
  const [keyword, setKeyword] = useState('')
  const [competitorUrls, setCompetitorUrls] = useState('')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [classification, setClassification] = useState<{
    category: string | null
    reason: string
    loading: boolean
    subtopics?: string[]
  }>({
    category: null,
    reason: 'Not yet classified',
    loading: false
  })
  const [outputFields, setOutputFields] = useState<Record<string, string>>({})
  const [generatingFields, setGeneratingFields] = useState<Record<string, boolean>>({})
  const [generatingAll, setGeneratingAll] = useState(false)
  const [keywordError, setKeywordError] = useState<string | null>(null)

  // Check for stored access token on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First check for pre-authenticated tokens from environment
      checkPreAuthTokens()
      
      // Then check for stored token from OAuth flow
      const storedToken = sessionStorage.getItem('google_access_token')
      if (storedToken) {
        setAccessToken(storedToken)
      }
      
      // Restore state after OAuth redirect
      const pendingKeyword = sessionStorage.getItem('pendingKeyword')
      const pendingCompetitorUrls = sessionStorage.getItem('pendingCompetitorUrls')
      
      if (pendingKeyword) {
        setKeyword(pendingKeyword)
        sessionStorage.removeItem('pendingKeyword')
      }
      if (pendingCompetitorUrls) {
        setCompetitorUrls(pendingCompetitorUrls)
        sessionStorage.removeItem('pendingCompetitorUrls')
      }
    }
  }, [])

  // Auto-resize textareas when content changes
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach((textarea) => {
        if (textarea instanceof HTMLTextAreaElement && textarea.value) {
          // Reset height to auto to get correct scrollHeight
          textarea.style.height = 'auto';
          // Set height to content height + small buffer
          textarea.style.height = (textarea.scrollHeight + 2) + 'px';
        }
      });
    }, 50);
    
    return () => clearTimeout(timer);
  }, [outputFields]);
  
  // Check for pre-authenticated tokens from environment
  const checkPreAuthTokens = async () => {
    try {
      const response = await fetch('/api/auth/tokens')
      const data = await response.json()
      
      if (data.access_token) {
        console.log('Using pre-authenticated tokens:', data.method)
        setAccessToken(data.access_token)
        // Store in session for consistency
        sessionStorage.setItem('google_access_token', data.access_token)
      }
    } catch (error) {
      console.error('Error checking pre-auth tokens:', error)
    }
  }

  const handleClassify = async () => {
    if (!keyword.trim()) {
      alert('Please enter a keyword first')
      return
    }

    setClassification(prev => ({ ...prev, loading: true }))
    setKeywordError(null) // Clear any previous error
    
    try {
      // Run classification and competitor lookup in parallel when user clicks classify
      const [classifyResponse, competitorResponse] = await Promise.all([
        fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            keyword: keyword.trim(),
            accessToken: accessToken
          })
        }),
        fetch('/api/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            keyword: keyword.trim(),
            accessToken: accessToken
          })
        })
      ])
      
      const classifyResult = await classifyResponse.json()
      let competitorResult = null
      let competitorError = null
      
      // Handle competitor response
      try {
        if (competitorResponse.ok) {
          competitorResult = await competitorResponse.json()
        } else {
          competitorError = `API failed ${competitorResponse.status}: ${await competitorResponse.text()}`
        }
      } catch (err) {
        competitorError = `Competitor API error: ${err instanceof Error ? err.message : 'Unknown'}`
      }
      
      if (!classifyResponse.ok) {
        throw new Error(classifyResult.error || 'Classification failed')
      }
      
      // Update classification
      setClassification({
        category: classifyResult.category,
        reason: classifyResult.reason,
        loading: false,
        subtopics: classifyResult.subtopics
      })
      
      // Auto-populate competitor URLs from Google Sheets
      if (competitorResult) {
        if (competitorResult.found && competitorResult.competitorUrls && competitorResult.competitorUrls.length > 0) {
          // Found URLs - populate them in the textarea
          setCompetitorUrls(competitorResult.competitorUrls.join('\n'))
          setKeywordError(null) // Clear any keyword error
        } else {
          // No URLs found - show more specific message
          setCompetitorUrls('')
          setKeywordError('No competitor URLs found in spreadsheet for this keyword')
        }
      } else {
        // API error - clear the field and show error
        setCompetitorUrls('')
        if (competitorError) {
          setKeywordError(`Error looking up competitor URLs: ${competitorError}`)
        } else {
          setKeywordError('No competitor URLs found in spreadsheet for this keyword')
        }
      }
      
    } catch (error) {
      setClassification({
        category: null,
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        loading: false
      })
    }
  }

  const generateAllPictures = async () => {
    if (!classification.category) return
    
    // Set all picture fields as generating
    setGeneratingFields(prev => ({ 
      ...prev, 
      pic1: true, 
      pic2: true, 
      pic3: true, 
      pic4: true 
    }))
    
    try {
      const response = await fetch('/api/generate/pictures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          flow: classification.category,
          accessToken: accessToken
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Pictures generation failed')
      }
      
      // Update all picture fields at once
      setOutputFields(prev => ({ 
        ...prev, 
        ...result.outputs 
      }))
      
    } catch (error) {
      alert(`Failed to generate pictures: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGeneratingFields(prev => ({ 
        ...prev, 
        pic1: false, 
        pic2: false, 
        pic3: false, 
        pic4: false 
      }))
    }
  }

  const generateField = async (fieldId: string) => {
    if (!classification.category) return
    
    // If it's a picture field, generate all pictures at once
    if (fieldId.startsWith('pic')) {
      await generateAllPictures()
      return
    }
    
    setGeneratingFields(prev => ({ ...prev, [fieldId]: true }))
    
    try {
      const response = await fetch(`/api/generate/${fieldId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          flow: classification.category,
          competitorUrls: competitorUrls.split('\n').filter(url => url.trim()),
          accessToken: accessToken,
          subtopics: classification.subtopics
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Generation failed')
      }
      
      setOutputFields(prev => ({ ...prev, [fieldId]: result.output }))
      
    } catch (error) {
      alert(`Failed to generate ${fieldId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGeneratingFields(prev => ({ ...prev, [fieldId]: false }))
    }
  }

  const generateAll = async () => {
    if (!classification.category) return
    
    setGeneratingAll(true)
    
    // Generate text fields first
    const textFields = [
      'title', 'intro',
      ...(classification.category === 'with subtopics' ? ['subtopics'] : []),
      'cost', 'why', 'faq'
    ]
    
    // Generate all text fields
    for (const fieldId of textFields) {
      await generateField(fieldId)
    }
    
    // Generate all pictures at once using the combined approach
    await generateAllPictures()
    
    setGeneratingAll(false)
  }

  const copyToClipboard = (content: string, fieldLabel: string) => {
    navigator.clipboard.writeText(content)
      .then(() => alert(`${fieldLabel} copied to clipboard!`))
      .catch(() => alert('Failed to copy to clipboard'))
  }

  const handleGoogleAuth = async () => {
    try {
      const response = await fetch('/api/auth/google')
      const data = await response.json()
      
      if (data.authUrl) {
        // Store current state before redirecting
        if (keyword) {
          sessionStorage.setItem('pendingKeyword', keyword)
        }
        if (competitorUrls) {
          sessionStorage.setItem('pendingCompetitorUrls', competitorUrls)
        }
        
        // Redirect to Google OAuth instead of popup
        window.location.href = data.authUrl
        
      } else {
        alert('Failed to setup authentication')
      }
    } catch (error) {
      console.error('Auth error:', error)
      alert('Authentication setup failed')
    }
  }

  return (
    <div className="space-y-8">
      {/* Authentication Section */}
      {accessToken ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="text-green-600">✅</div>
            <div className="flex-1">
              <p className="text-sm text-green-800">
                <strong>Authenticated with Google:</strong> Ready to access documents and sheets for keyword classification.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="text-yellow-600">⚠️</div>
            <div className="flex-1">
              <p className="text-sm text-yellow-800">
                <strong>Authentication Required:</strong> Please authenticate with Google to access documents and sheets for keyword classification.
              </p>
            </div>
            <button
              onClick={handleGoogleAuth}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Authenticate with Google
            </button>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Input</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Keyword
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && keyword.trim() && !classification.loading) {
                  handleClassify()
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your primary keyword..."
            />
            {keywordError && (
              <div className="mt-1 text-sm text-red-600 font-medium">
                {keywordError}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Competitor URLs
              <span className="text-xs text-gray-500 ml-2">(newline-separated)</span>
            </label>
            <textarea
              rows={4}
              value={competitorUrls}
              onChange={(e) => setCompetitorUrls(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://competitor1.com&#10;https://competitor2.com&#10;https://competitor3.com"
            />
            <div className="mt-1 text-xs text-gray-500">
              Enter competitor URLs (one per line). Used for FAQ generation themes only.
            </div>
          </div>
        </div>
        
        {/* Classification Result */}
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <span className="text-sm text-gray-600">
                Classification: {' '}
                <span className={`font-medium ${
                  classification.category === 'with subtopics' ? 'text-green-600' :
                  classification.category === 'no subtopics' ? 'text-blue-600' :
                  'text-gray-600'
                }`}>
                  {classification.loading ? 'Classifying...' : 
                   classification.category || 'Not yet classified'}
                </span>
              </span>
              {classification.reason && !classification.loading && (
                <div className="text-xs text-gray-500 mt-1">
                  {classification.reason}
                </div>
              )}
            </div>
            <button
              onClick={handleClassify}
              disabled={classification.loading || !keyword.trim() || !accessToken}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {classification.loading ? 'Classifying...' : 'Classify Keyword'}
            </button>
          </div>
        </div>
      </div>

      {/* Output Boxes - Only show after classification */}
      {classification.category && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              Generated Content {classification.category && (
                <span className="text-sm font-normal text-gray-500">
                  ({classification.category === 'with subtopics' ? 'Flow A - With Subtopics' : 'Flow B - No Subtopics'})
                </span>
              )}
            </h2>
            <div className="flex items-center space-x-2">
              <a 
                href="/debug" 
                target="_blank" 
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
              >
                🔍 Debug
              </a>
              <button 
                onClick={generateAll}
                disabled={!classification.category || classification.category === null || generatingAll}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingAll ? 'Generating All...' : 'Generate All'}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Same fields for both classifications, just include Subtopics when needed */}
            {[
              { id: 'title', label: 'Title' },
              { id: 'intro', label: 'Introduction' },
              { id: 'pic1', label: 'Picture 1 Description' },
              { id: 'pic2', label: 'Picture 2 Description' },
              { id: 'pic3', label: 'Picture 3 Description' },
              { id: 'pic4', label: 'Picture 4 Description' },
              ...(classification.category === 'with subtopics' ? [{ id: 'subtopics', label: 'Subtopics' }] : []),
              { id: 'cost', label: 'Cost Information' },
              { id: 'why', label: 'Why Choose Us' },
              { id: 'faq', label: 'FAQs' }
            ].map((field) => (
              <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    {field.label}
                  </label>
                  <div className="space-x-2">
                    <button 
                      onClick={() => generateField(field.id)}
                      disabled={!classification.category || generatingFields[field.id] || generatingAll}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingFields[field.id] ? 'Generating...' : 'Generate'}
                    </button>
                    {outputFields[field.id] && (
                      <button 
                        onClick={() => generateField(field.id)}
                        disabled={generatingFields[field.id] || generatingAll}
                        className="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Regenerate
                      </button>
                    )}
                    <button 
                      onClick={() => copyToClipboard(outputFields[field.id] || '', field.label)}
                      disabled={!outputFields[field.id]}
                      className="px-3 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <textarea
                  value={outputFields[field.id] || ''}
                  onChange={(e) => {
                    setOutputFields(prev => ({ ...prev, [field.id]: e.target.value }));
                    // Auto-resize textarea immediately
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = (target.scrollHeight + 2) + 'px';
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  style={{ 
                    minHeight: '80px',
                    overflow: 'hidden',
                    overflowY: 'hidden'
                  }}
                  placeholder="Click Generate to create content..."
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PicturesTab() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([])
  const [processingIndex, setProcessingIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  interface ProcessedImage {
    id: string
    originalName: string
    webp: string
    alt: string
    geotagApplied: boolean
    location?: { name: string; lat: number; lng: number }
    sizeKb: number
  }

  const handleFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    )
    setUploadedFiles(prev => [...prev, ...imageFiles])
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const processImage = async (file: File, index: number) => {
    setProcessingIndex(index)
    
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('instruction', 'I want to apply the frame to the picture. The picture called "done" is an example of the final output. I want the frame to be applied in a natural way around the picture, as if it was literally a framed picture. Resize the frame as needed to fit the picture. The dropshadow under the lower frame should be a pixel-perfect duplication. Don\'t extend any background beyond the image.')
      formData.append('geotag', 'true')

      const response = await fetch('/api/image/process', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Processing failed')
      }

      const result = await response.json()
      
      const processedImage: ProcessedImage = {
        id: Date.now().toString() + index,
        originalName: result.original_filename,
        webp: result.webp,
        alt: result.alt,
        geotagApplied: result.geotag_applied,
        location: result.location,
        sizeKb: result.size_kb
      }

      setProcessedImages(prev => [...prev, processedImage])
      
      // Remove the processed file from upload list
      removeFile(index)
      
    } catch (error) {
      console.error('Image processing failed:', error)
      alert(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setProcessingIndex(null)
    }
  }

  const copyImageData = (image: ProcessedImage) => {
    navigator.clipboard.writeText(image.webp)
      .then(() => alert('Image data copied to clipboard!'))
      .catch(() => alert('Failed to copy to clipboard'))
  }

  const downloadImage = (image: ProcessedImage) => {
    const link = document.createElement('a')
    link.href = image.webp
    link.download = `${image.originalName.split('.')[0]}_processed.webp`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Image Upload</h2>
        
        {/* Drag & Drop Zone */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          <div className="space-y-4">
            <div className="text-4xl">📁</div>
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drag and drop your images here
              </p>
              <p className="text-sm text-gray-500">
                or click to browse files
              </p>
            </div>
            <button 
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={(e) => {
                e.stopPropagation()
                handleFileSelect()
              }}
            >
              Select Images
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="mt-4 text-sm text-gray-600">
          <p>• Accepts any image format (JPG, PNG, GIF, etc.)</p>
          <p>• Images will be converted to WebP automatically</p>
          <p>• AI processing with Nano Banana (Gemini 2.5 Flash Image)</p>
        </div>

        {/* Uploaded Files Preview */}
        {uploadedFiles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Uploaded Files ({uploadedFiles.length})
            </h3>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                      📷
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => processImage(file, index)}
                      disabled={processingIndex === index}
                      className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingIndex === index ? 'Processing...' : 'Process'}
                    </button>
                    <button 
                      onClick={() => removeFile(index)}
                      disabled={processingIndex === index}
                      className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Processing Results */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Processed Images {processedImages.length > 0 && `(${processedImages.length})`}
        </h2>
        
        {processedImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">🖼️</div>
            <p>Upload and process images to see results here</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processedImages.map((image) => (
              <div key={image.id} className="border border-gray-200 rounded-lg p-4">
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                  <img 
                    src={image.webp} 
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate" title={image.originalName}>
                      {image.originalName}
                    </span>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => copyImageData(image)}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                        title="Copy image data"
                      >
                        Copy
                      </button>
                      <button 
                        onClick={() => downloadImage(image)}
                        className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                        title="Download WebP"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600" title={image.alt}>
                    Alt: {image.alt.length > 50 ? image.alt.substring(0, 47) + '...' : image.alt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      {image.geotagApplied && image.location ? 
                        `📍 ${image.location.name}, ID` : 
                        '📍 No location'
                      }
                    </span>
                    <span>{image.sizeKb} KB</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}