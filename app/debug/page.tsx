'use client'

import { useState, useEffect } from 'react'

interface DebugResult {
  googleDoc: {
    url: string
    accessMethod: string
    classification: string
    reason: string
    error?: string
  }
  googleSheet: {
    url: string
    accessMethod: string
    columnForKeyword: string
    rowFound: number | null
    columnHHasContent: boolean
    columnHContents: string[]
    error?: string
  }
}

export default function DebugPage() {
  const [keyword, setKeyword] = useState('')
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [authenticating, setAuthenticating] = useState(false)

  // Check for stored access token on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = sessionStorage.getItem('google_access_token')
      if (storedToken) {
        setAccessToken(storedToken)
      }
    }
  }, [])

  const handleGoogleAuth = async () => {
    setAuthenticating(true)
    try {
      const response = await fetch('/api/auth/google')
      const data = await response.json()
      
      if (data.authUrl) {
        // Open Google OAuth in same window
        window.location.href = data.authUrl
      } else {
        alert('Failed to setup authentication')
      }
    } catch (error) {
      console.error('Auth error:', error)
      alert('Authentication setup failed')
    }
    setAuthenticating(false)
  }

  const handleDebug = async () => {
    if (!keyword.trim()) {
      alert('Please enter a keyword first')
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword: keyword.trim(),
          accessToken: accessToken 
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Debug request failed')
      }
      
      setDebugResult(result)
      
    } catch (error) {
      console.error('Debug error:', error)
      alert(`Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Debug Tool
          </h1>
          <p className="text-lg text-gray-600">
            Debug keyword classification and Google Sheets integration
          </p>
        </header>

        {/* Authentication Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Google Authentication</h2>
          {accessToken ? (
            <div className="flex items-center space-x-4">
              <div className="text-green-600 font-medium">✅ Authenticated with Google</div>
              <button
                onClick={() => {
                  setAccessToken(null)
                  sessionStorage.removeItem('google_access_token')
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="text-orange-600 font-medium">⚠️ Not authenticated</div>
              <button
                onClick={handleGoogleAuth}
                disabled={authenticating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authenticating ? 'Authenticating...' : 'Authenticate with Google'}
              </button>
            </div>
          )}
          <p className="text-sm text-gray-600 mt-2">
            Authentication is required to access Google Sheets with real-time data.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Input</h2>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Keyword
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && keyword.trim() && !loading) {
                    handleDebug()
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your primary keyword..."
              />
            </div>
            <button
              onClick={handleDebug}
              disabled={loading || !keyword.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Debugging...' : 'Debug'}
            </button>
          </div>
        </div>

        {/* Debug Results */}
        {debugResult && (
          <div className="space-y-6">
            {/* Google Doc Debug Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Google Doc Classification</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document URL</label>
                  <a 
                    href={debugResult.googleDoc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
                  >
                    {debugResult.googleDoc.url}
                  </a>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Method</label>
                  <p className="text-sm text-gray-900">{debugResult.googleDoc.accessMethod}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
                  <p className={`text-sm font-medium ${
                    debugResult.googleDoc.classification === 'with subtopics' ? 'text-green-600' :
                    debugResult.googleDoc.classification === 'no subtopics' ? 'text-blue-600' :
                    'text-red-600'
                  }`}>
                    {debugResult.googleDoc.classification}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <p className="text-sm text-gray-900">{debugResult.googleDoc.reason}</p>
                </div>
                {debugResult.googleDoc.error && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-red-700 mb-1">Error</label>
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{debugResult.googleDoc.error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Google Sheets Debug Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Google Sheets Integration</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sheets URL</label>
                  <a 
                    href={debugResult.googleSheet.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
                  >
                    {debugResult.googleSheet.url}
                  </a>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Method</label>
                  <p className="text-sm text-gray-900">{debugResult.googleSheet.accessMethod}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Column for Keyword Search</label>
                  <p className="text-sm text-gray-900">{debugResult.googleSheet.columnForKeyword}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Row Where Keyword Found</label>
                  <p className={`text-sm font-medium ${
                    debugResult.googleSheet.rowFound !== null ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {debugResult.googleSheet.rowFound !== null ? `Row ${debugResult.googleSheet.rowFound}` : 'Not Found'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Column H Has Content</label>
                  <p className={`text-sm font-medium ${
                    debugResult.googleSheet.columnHHasContent ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {debugResult.googleSheet.columnHHasContent ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Column H Contents</label>
                  <div className="text-sm text-gray-900">
                    {debugResult.googleSheet.columnHContents.length > 0 ? (
                      <ul className="space-y-1 max-h-32 overflow-y-auto">
                        {debugResult.googleSheet.columnHContents.map((url, index) => (
                          <li key={index} className="break-all">
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">No URLs found</p>
                    )}
                  </div>
                </div>
                {debugResult.googleSheet.error && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-red-700 mb-1">Error</label>
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{debugResult.googleSheet.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Back to Main App */}
        <div className="mt-8 text-center">
          <a 
            href="/"
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            ← Back to Main App
          </a>
        </div>
      </div>
    </main>
  )
}