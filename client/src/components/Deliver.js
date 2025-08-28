import React, { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '../utils/apiConfig'
import { useAuth } from '../context/AuthContext'
import { Nav } from './Nav'
import { formatDateForHeader } from '../utils/dateUtils'
import '../styles/deliver.css'

export const Deliver = () => {
  const { user, selectedOrganizationId, selectedProjectId, selectedDate } = useAuth()
  const [projects, setProjects] = useState([])
  const [events, setEvents] = useState([])
  const [shotRequests, setShotRequests] = useState([])
  const [images, setImages] = useState([])
  const [viewMode, setViewMode] = useState('events') // 'events' or 'shot-requests'
  const [selectedItem, setSelectedItem] = useState(null)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadTarget, setUploadTarget] = useState({ mode: 'events', type: 'existing', eventId: '', shotRequestId: '' })
  const [loading, setLoading] = useState(true)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const responses = await Promise.all([
          fetch(`${API_CONFIG.baseUrl}/api/projects`),
          fetch(`${API_CONFIG.baseUrl}/api/events`),
          fetch(`${API_CONFIG.baseUrl}/api/shot-requests`),
          fetch(`${API_CONFIG.baseUrl}/api/images`)
        ])

        const [projectsRes, eventsRes, shotRequestsRes, imagesRes] = responses

        const projectsData = projectsRes.ok ? await projectsRes.json() : []
        const eventsData = eventsRes.ok ? await eventsRes.json() : []
        const shotRequestsData = shotRequestsRes.ok ? await shotRequestsRes.json() : []
        const imagesData = imagesRes.ok ? await imagesRes.json() : []

        setProjects(projectsData)
        setEvents(eventsData)
        setShotRequests(shotRequestsData)
        setImages(imagesData)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user?.access])

  // Filter projects by organization (use global selection)
  const orgProjects = useMemo(() => {
    if (user?.access === 'Admin' && selectedOrganizationId) {
      return projects.filter(p => p.organization_id === parseInt(selectedOrganizationId))
    } else if (!user?.organization_id) {
      return projects
    } else {
      return projects.filter(p => p.organization_id === user.organization_id)
    }
  }, [projects, user?.organization_id, user?.access, selectedOrganizationId])



  // Get delivered items for selected project and global date
  const deliveredEvents = useMemo(() => {
    if (!selectedProjectId) return []
    return events.filter(event => {
      const matchesProject = event.project_id === parseInt(selectedProjectId)
      const isDelivered = event.process_point === 'delivered'
      const matchesDate = selectedDate ? event.date === selectedDate : true
      return matchesProject && isDelivered && matchesDate
    })
  }, [events, selectedProjectId, selectedDate])

  const deliveredShotRequests = useMemo(() => {
    if (!selectedProjectId) return []
    return shotRequests.filter(sr => {
      const isDelivered = sr.process_point === 'delivered'
      
      // If global date is selected, only show shot requests associated with events on that date
      if (selectedDate && sr.events && sr.events.length > 0) {
        const hasEventOnSelectedDate = sr.events.some(event => event.date === selectedDate)
        return isDelivered && hasEventOnSelectedDate
      }
      
      return isDelivered
    })
  }, [shotRequests, selectedProjectId, selectedDate])

  // Get current items based on view mode
  const currentItems = viewMode === 'events' ? deliveredEvents : deliveredShotRequests

  // Get images for selected item (event or shot request)
  const selectedItemImages = useMemo(() => {
    if (!selectedItem) return []
    if (viewMode === 'events') {
      return images.filter(image => image.event_id === selectedItem.id)
    } else {
      return images.filter(image => image.requests_id === selectedItem.id)
    }
  }, [images, selectedItem, viewMode])

  // Get thumbnail for item (first image)
  const getItemThumbnail = (item) => {
    let itemImages
    if (viewMode === 'events') {
      itemImages = images.filter(img => img.event_id === item.id)
    } else {
      itemImages = images.filter(img => img.requests_id === item.id)
    }
    return itemImages[0]?.thumbnail_path || itemImages[0]?.file_path || '/images/no-image.png'
  }

  const getItemImageCount = (item) => {
    if (viewMode === 'events') {
      return images.filter(img => img.event_id === item.id).length
    } else {
      return images.filter(img => img.requests_id === item.id).length
    }
  }

  // Handle favorite toggle
  const toggleFavorite = async (imageId, currentFavorite) => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/images/${imageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !currentFavorite })
      })

      if (response.ok) {
        setImages(prev => prev.map(img => 
          img.id === imageId ? { ...img, favorite: !currentFavorite } : img
        ))
        
        // Update lightbox image if it's the same image
        if (lightboxImage && lightboxImage.id === imageId) {
          setLightboxImage(prev => ({ ...prev, favorite: !currentFavorite }))
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  // Download functions
  const downloadImage = async (image) => {
    try {
      // Fetch the image to convert it to a blob
      const response = await fetch(image.file_path)
      const blob = await response.blob()
      
      // Create object URL for the blob
      const url = window.URL.createObjectURL(blob)
      
      // Create and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = image.filename
      document.body.appendChild(link)
      link.click()
      
      // Clean up
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      // Fallback to direct link
      const link = document.createElement('a')
      link.href = image.file_path
      link.download = image.filename
      link.target = '_blank'
      link.click()
    }
  }

  const downloadFavorites = () => {
    const favorites = selectedItemImages.filter(img => img.favorite)
    favorites.forEach(img => downloadImage(img))
  }

  const downloadAll = () => {
    selectedItemImages.forEach(img => downloadImage(img))
  }

  // Lightbox navigation
  const currentImageIndex = useMemo(() => {
    return selectedItemImages.findIndex(img => img.id === lightboxImage?.id)
  }, [selectedItemImages, lightboxImage])

  const goToPrevImage = () => {
    const prevIndex = currentImageIndex > 0 ? currentImageIndex - 1 : selectedItemImages.length - 1
    setLightboxImage(selectedItemImages[prevIndex])
  }

  const goToNextImage = () => {
    const nextIndex = currentImageIndex < selectedItemImages.length - 1 ? currentImageIndex + 1 : 0
    setLightboxImage(selectedItemImages[nextIndex])
  }

  // Check if user can upload (admin, editor, coordinator)
  const canUpload = ['Admin', 'Editor', 'Coordinator'].includes(user?.access)

  // Handle file upload
  const handleUpload = async () => {
    const hasValidTarget = (uploadTarget.mode === 'events' && uploadTarget.eventId) || 
                          (uploadTarget.mode === 'shot-requests' && uploadTarget.shotRequestId)
    
    if (!hasValidTarget || selectedFiles.length === 0) return

    try {
      setLoading(true)
      const formData = new FormData()
      
      // Add files to form data
      selectedFiles.forEach((file, index) => {
        formData.append('images', file)
      })
      
      // Add metadata based on mode
      if (uploadTarget.mode === 'events') {
        formData.append('event_id', uploadTarget.eventId)
      } else {
        formData.append('shot_request_id', uploadTarget.shotRequestId)
      }
      formData.append('user_id', user.id)

      const response = await fetch(`${API_CONFIG.baseUrl}/api/upload-images`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const newImages = await response.json()
        setImages(prev => [...prev, ...newImages])
        setShowUploadModal(false)
        setSelectedFiles([])
        setUploadTarget({ mode: 'events', type: 'existing', eventId: '', shotRequestId: '' })
        
        // Force re-fetch of images to ensure we get the latest data
        const imageResponse = await fetch(`${API_CONFIG.baseUrl}/api/images`)
        if (imageResponse.ok) {
          const allImages = await imageResponse.json()
          setImages(allImages)
        }
        
        
      } else {
        const error = await response.text()
        alert(`Upload failed: ${error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <Nav />
        <div className="loading">Loading galleries...</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <Nav />
      
      <div className="deliver-container">
        {/* Header */}
        <div className="deliver-header">
          <h1>Deliver</h1>
                      <div className="header-controls">
            <div className="view-toggle">
              <button 
                className={`toggle-btn ${viewMode === 'events' ? 'active' : ''}`}
                onClick={() => setViewMode('events')}
              >
                Events
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'shot-requests' ? 'active' : ''}`}
                onClick={() => setViewMode('shot-requests')}
              >
                Shot Requests
              </button>
            </div>
            

            
            {canUpload && selectedProjectId && (
              <button 
                className="upload-btn main-upload"
                onClick={() => {
                  // Auto-select current gallery if user is viewing one
                  if (selectedItem) {
                    setUploadTarget({
                      mode: viewMode,
                      type: 'existing',
                      eventId: viewMode === 'events' ? selectedItem.id.toString() : '',
                      shotRequestId: viewMode === 'shot-requests' ? selectedItem.id.toString() : ''
                    })
                  }
                  setShowUploadModal(true)
                }}
              >
                Upload Images
              </button>
            )}
          </div>
        </div>

        {selectedItem ? (
          /* Gallery View */
          <div className="gallery-view">
            <div className="gallery-header">
              <button 
                className="back-btn"
                onClick={() => setSelectedItem(null)}
              >
                ← Back to {viewMode === 'events' ? 'Events' : 'Shot Requests'}
              </button>
              <h2>{selectedItem.name || selectedItem.request}</h2>
              <div className="gallery-controls">
                <div className="gallery-filters">
                  <button 
                    className={`filter-btn ${showFavoritesOnly ? 'active' : ''}`}
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  >
                    Favorites
                  </button>
                </div>
                <div className="gallery-actions">
                  <button 
                    onClick={downloadFavorites} 
                    className={`download-btn ${selectedItemImages.filter(img => img.favorite).length === 0 ? 'disabled' : ''}`}
                    disabled={selectedItemImages.filter(img => img.favorite).length === 0}
                  >
                    Download Favorites ({selectedItemImages.filter(img => img.favorite).length})
                  </button>
                  <button onClick={downloadAll} className="download-btn">
                    Download All ({selectedItemImages.length})
                  </button>
                </div>
              </div>
            </div>

            <div className="images-grid">
              {selectedItemImages
                .filter(image => !showFavoritesOnly || image.favorite)
                .map(image => (
                <div key={image.id} className="image-card">
                  <div className="image-container" onClick={() => setLightboxImage(image)}>
                    <img 
                      src={image.thumbnail_path || image.file_path} 
                      alt={image.filename}
                    />
                    <div className="image-overlay">
                      <span className="view-icon">View</span>
                    </div>
                  </div>
                  <div className="image-actions">
                    <button 
                      className={`favorite-btn ${image.favorite ? 'favorited' : ''}`}
                      onClick={() => toggleFavorite(image.id, image.favorite)}
                    >
                      <div className={`heart-icon ${image.favorite ? 'filled' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </button>
                    <button 
                      className="download-btn"
                      onClick={() => downloadImage(image)}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Items Grid */
          <div className="items-grid">
            {currentItems.length === 0 ? (
              <div className="empty-state">
                <p>No delivered {viewMode === 'events' ? 'events' : 'shot requests'} found for this project.</p>
              </div>
            ) : (
              currentItems.map(item => (
                <div 
                  key={item.id} 
                  className="deliver-item-card"
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="item-thumbnail">
                    <img 
                      src={getItemThumbnail(item)} 
                      alt=""
                    />
                    <div className="item-title-overlay">
                      <h3>{item.name || item.request}</h3>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="lightbox-close"
              onClick={() => setLightboxImage(null)}
            >
              ×
            </button>
            
            <button 
              className="lightbox-nav lightbox-prev"
              onClick={goToPrevImage}
            >
              ←
            </button>
            
            <img 
              src={lightboxImage.file_path} 
              alt={lightboxImage.filename}
            />
            
            <button 
              className="lightbox-nav lightbox-next"
              onClick={goToNextImage}
            >
              →
            </button>
            
            <div className="lightbox-bottom">
              <span className="lightbox-filename">{lightboxImage.filename}</span>
              
              
                <button 
                  className={`favorite-btn ${lightboxImage.favorite ? 'favorited' : ''}`}
                  onClick={() => toggleFavorite(lightboxImage.id, lightboxImage.favorite)}
                >
                  <div className={`heart-icon ${lightboxImage.favorite ? 'filled' : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
                <button 
                  className="download-btn"
                  onClick={() => downloadImage(lightboxImage)}
                >
                  Download
                </button>
              
              
              <span className="lightbox-counter">{currentImageIndex + 1} of {selectedItemImages.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Images</h2>
              <button 
                className="close-btn"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
            </div>
            
            <h3>Upload For</h3>
            <div className="mode-toggle">
              <button 
                className={`mode-btn ${uploadTarget.mode === 'events' ? 'active' : ''}`}
                onClick={() => setUploadTarget({ mode: 'events', type: 'existing', eventId: '' })}
              >
                Events
              </button>
              <button 
                className={`mode-btn ${uploadTarget.mode === 'shot-requests' ? 'active' : ''}`}
                onClick={() => setUploadTarget({ mode: 'shot-requests', type: 'existing', shotRequestId: '' })}
              >
                Shot Requests
              </button>
            </div>

            <h3>Gallery Options</h3>
            <label className="radio-option">
              <input
                type="radio"
                name="uploadTarget"
                value="existing"
                checked={uploadTarget.type === 'existing'}
                onChange={(e) => setUploadTarget({ ...uploadTarget, type: e.target.value })}
              />
              Add to Existing Gallery
            </label>
            
            <label className="radio-option">
              <input
                type="radio"
                name="uploadTarget"
                value="new"
                checked={uploadTarget.type === 'new'}
                onChange={(e) => setUploadTarget({ ...uploadTarget, type: e.target.value })}
              />
              Create New Gallery for {uploadTarget.mode === 'events' ? 'Event' : 'Shot Request'}
            </label>

            {uploadTarget.type === 'existing' && uploadTarget.mode === 'events' && (
              <select
                value={uploadTarget.eventId}
                onChange={(e) => setUploadTarget({ ...uploadTarget, eventId: e.target.value })}
                className="selection-dropdown"
              >
                <option value="">Select Existing Event Gallery</option>
                {events
                  .filter(event => 
                    event.project_id === parseInt(selectedProjectId) &&
                    event.process_point === 'delivered'
                  )
                  .map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {formatDateForHeader(event.date)}
                    </option>
                  ))}
              </select>
            )}

            {uploadTarget.type === 'existing' && uploadTarget.mode === 'shot-requests' && (
              <select
                value={uploadTarget.shotRequestId}
                onChange={(e) => setUploadTarget({ ...uploadTarget, shotRequestId: e.target.value })}
                className="selection-dropdown"
              >
                <option value="">Select Existing Shot Request Gallery</option>
                {shotRequests
                  .filter(sr => 
                    sr.process_point === 'delivered'
                  )
                  .map(sr => (
                    <option key={sr.id} value={sr.id}>
                      {sr.request}
                    </option>
                  ))}
              </select>
            )}

            {uploadTarget.type === 'new' && uploadTarget.mode === 'events' && (
              <select
                value={uploadTarget.eventId}
                onChange={(e) => setUploadTarget({ ...uploadTarget, eventId: e.target.value })}
                className="selection-dropdown"
              >
                <option value="">Select Event</option>
                {events
                  .filter(event => 
                    event.project_id === parseInt(selectedProjectId) &&
                    event.process_point === 'delivered'
                  )
                  .map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {formatDateForHeader(event.date)}
                    </option>
                  ))}
              </select>
            )}

            {uploadTarget.type === 'new' && uploadTarget.mode === 'shot-requests' && (
              <select
                value={uploadTarget.shotRequestId}
                onChange={(e) => setUploadTarget({ ...uploadTarget, shotRequestId: e.target.value })}
                className="selection-dropdown"
              >
                <option value="">Select Shot Request</option>
                {shotRequests
                  .filter(sr => {
                    const event = events.find(e => e.id === sr.event_id)
                    return event && (
                      new Date(event.date) <= new Date() || 
                      event.process_point === 'ongoing'
                    )
                  })
                  .map(sr => (
                    <option key={sr.id} value={sr.id}>
                      {sr.request}
                    </option>
                  ))}
              </select>
            )}

            <h3>Select Images</h3>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
              className="file-input"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="file-label">
              Choose Images ({selectedFiles.length} selected)
            </label>
            
            {selectedFiles.length > 0 && (
              <div className="file-preview">
                <p>{selectedFiles.length} files selected</p>
                <div className="file-list">
                  {selectedFiles.slice(0, 5).map((file, index) => (
                    <span key={index} className="file-name">{file.name}</span>
                  ))}
                  {selectedFiles.length > 5 && (
                    <span className="file-count">+{selectedFiles.length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </button>
              <button 
                className="upload-btn"
                onClick={handleUpload}
                disabled={
                  selectedFiles.length === 0 || 
                  (uploadTarget.mode === 'events' && !uploadTarget.eventId) ||
                  (uploadTarget.mode === 'shot-requests' && !uploadTarget.shotRequestId)
                }
              >
                Upload Images
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}