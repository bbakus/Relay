import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_CONFIG } from '../utils/apiConfig'
import { Nav } from './Nav'
import '../styles/ingest.css'

export const Ingest = () => {
    const { user, selectedProjectId } = useAuth()
    const [loading, setLoading] = useState(false)
    const [images, setImages] = useState([])
    const [events, setEvents] = useState([])
    const [personnel, setPersonnel] = useState([])
    const [showIngestWizard, setShowIngestWizard] = useState(false)
    const [wizardStep, setWizardStep] = useState(1) // 1: Upload, 2: Name Folder, 3: Review
    const [folderName, setFolderName] = useState('')
    const [ingestDate, setIngestDate] = useState('')
    const [selectedPhotographerId, setSelectedPhotographerId] = useState(null)
    const [selectedFiles, setSelectedFiles] = useState([])
    const [parsedImages, setParsedImages] = useState([])
    const [expandedDateFolders, setExpandedDateFolders] = useState({})
    const [expandedCustomFolders, setExpandedCustomFolders] = useState({})
    const [selectedImagesForBatch, setSelectedImagesForBatch] = useState([])
    const [showBatchAssignModal, setShowBatchAssignModal] = useState(false)
    const [batchAssignEventId, setBatchAssignEventId] = useState(null)

    // Fetch images, events, and personnel
    useEffect(() => {
        if (selectedProjectId) {
            fetchImages()
            fetchEvents()
            fetchPersonnel()
        }
    }, [selectedProjectId])

    const fetchImages = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${API_CONFIG.baseUrl}/api/images?project_id=${selectedProjectId}`)
            if (response.ok) {
                const data = await response.json()
                setImages(data)
            }
        } catch (error) {
            console.error('Error fetching images:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchEvents = async () => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events?project_id=${selectedProjectId}`)
            if (response.ok) {
                const data = await response.json()
                setEvents(data)
            }
        } catch (error) {
            console.error('Error fetching events:', error)
        }
    }

    const fetchPersonnel = async () => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel`)
            if (response.ok) {
                const data = await response.json()
                // Filter to only photographers/videographers assigned to this project
                const projectPersonnel = data.filter(person => {
                    const role = (person.role || '').toLowerCase()
                    const isPhotographerOrVideographer = role.includes('photographer') || role.includes('videographer')
                    return isPhotographerOrVideographer && person.project_ids && person.project_ids.includes(parseInt(selectedProjectId))
                })
                setPersonnel(projectPersonnel)
            }
        } catch (error) {
            console.error('Error fetching personnel:', error)
        }
    }

    // Organize images into date → folder → files hierarchy
    const folderStructure = useMemo(() => {
        const structure = {}
        
        images.forEach(image => {
            const date = image.ingest_date || 'Unknown Date'
            const folder = image.folder_name || 'Unnamed Folder'
            
            if (!structure[date]) {
                structure[date] = {}
            }
            if (!structure[date][folder]) {
                structure[date][folder] = []
            }
            structure[date][folder].push(image)
        })
        
        return structure
    }, [images])

    // Process point colors (same as Schedule)
    const getProcessPointColor = (processPoint) => {
        switch (processPoint?.toLowerCase()) {
            case 'idle': return 'rgba(0, 255, 255, 0.15)'
            case 'ingest': return 'rgba(0, 128, 255, 0.15)'
            case 'cull': return 'rgba(255, 122, 24, 0.15)'
            case 'color': return 'rgba(255, 64, 64, 0.15)'
            case 'delivered': return 'rgba(34, 197, 94, 0.15)'
            default: return 'rgba(107, 114, 128, 0.15)'
        }
    }

    // Auto-attribute images to events based on timestamp AND photographer assignment
    const autoAttributeToEvent = (imageTimestamp) => {
        if (!imageTimestamp || !selectedPhotographerId) return null
        
        const matchedEvent = events.find(event => {
            if (!event.date || !event.start_time || !event.end_time) return false
            
            // Check if this photographer is assigned to this event
            const isPhotographerAssigned = event.assigned_personnel && event.assigned_personnel.some(
                person => person.personnel_id === parseInt(selectedPhotographerId)
            )
            
            if (!isPhotographerAssigned) return false
            
            // Parse image timestamp
            const imgDate = new Date(imageTimestamp)
            const imgTimeStr = imgDate.toTimeString().substring(0, 8) // HH:MM:SS
            
            // Check if date matches
            const eventDate = event.date
            const imgDateStr = imgDate.toISOString().split('T')[0]
            
            if (eventDate !== imgDateStr) return false
            
            // Check if time is within event window
            return imgTimeStr >= event.start_time && imgTimeStr <= event.end_time
        })
        
        return matchedEvent || null
    }

    // Handle file selection (drag-and-drop or browse)
    const handleFileSelect = async (files) => {
        setSelectedFiles(Array.from(files))
        
        // Parse EXIF data from files (client-side only, no upload)
        const parsed = []
        for (const file of files) {
            try {
                // Read EXIF data using FileReader
                const exifData = await readExifData(file)
                const event = autoAttributeToEvent(exifData.capture_timestamp)
                
                parsed.push({
                    filename: file.name,
                    file_size: file.size,
                    ...exifData,
                    suggested_event: event,
                    event_id: event?.id || null
                })
            } catch (error) {
                console.error('Error reading EXIF from', file.name, error)
            }
        }
        
        setParsedImages(parsed)
    }

    // Read EXIF data from file (simplified - in production use exif-js or similar library)
    const readExifData = (file) => {
        return new Promise((resolve) => {
            // For now, return basic file metadata
            // In production, use a library like exif-js to extract real EXIF data
            const reader = new FileReader()
            
            reader.onload = (e) => {
                const img = new Image()
                img.onload = () => {
                    resolve({
                        width: img.width,
                        height: img.height,
                        capture_timestamp: file.lastModified ? new Date(file.lastModified) : new Date(),
                        // These would come from actual EXIF parsing in production
                        camera_make: 'Unknown',
                        camera_model: 'Unknown',
                        lens: 'Unknown',
                        iso: null,
                        shutter_speed: null,
                        aperture: null,
                        focal_length: null,
                        orientation: 1
                    })
                }
                img.src = e.target.result
            }
            
            reader.readAsDataURL(file)
        })
    }

    // Submit ingested images to backend
    const handleIngestSubmit = async () => {
        try {
            setLoading(true)
            
            const payload = parsedImages.map(img => ({
                ...img,
                folder_name: folderName,
                ingest_date: ingestDate,
                photographer_id: selectedPhotographerId,
                project_id: selectedProjectId,
                upload_date: new Date().toISOString().split('T')[0]
            }))
            
            const response = await fetch(`${API_CONFIG.baseUrl}/api/images/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            
            if (response.ok) {
                // Refresh images list
                await fetchImages()
                // Close wizard
                closeWizard()
            }
        } catch (error) {
            console.error('Error submitting ingest:', error)
        } finally {
            setLoading(false)
        }
    }

    const closeWizard = () => {
        setShowIngestWizard(false)
        setWizardStep(1)
        setFolderName('')
        setIngestDate('')
        setSelectedPhotographerId(null)
        setSelectedFiles([])
        setParsedImages([])
    }

    const toggleDateFolder = (date) => {
        setExpandedDateFolders(prev => ({ ...prev, [date]: !prev[date] }))
    }

    const toggleCustomFolder = (date, folder) => {
        const key = `${date}_${folder}`
        setExpandedCustomFolders(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const toggleImageSelection = (imageId) => {
        setSelectedImagesForBatch(prev => {
            if (prev.includes(imageId)) {
                return prev.filter(id => id !== imageId)
            } else {
                return [...prev, imageId]
            }
        })
    }

    const openBatchAssignModal = () => {
        if (selectedImagesForBatch.length === 0) {
            alert('Please select at least one image')
            return
        }
        setShowBatchAssignModal(true)
    }

    const handleBatchAssign = async () => {
        if (!batchAssignEventId) {
            alert('Please select an event')
            return
        }
        
        try {
            setLoading(true)
            const response = await fetch(`${API_CONFIG.baseUrl}/api/images/batch-assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_ids: selectedImagesForBatch,
                    event_id: batchAssignEventId
                })
            })
            
            if (response.ok) {
                await fetchImages()
                setShowBatchAssignModal(false)
                setSelectedImagesForBatch([])
                setBatchAssignEventId(null)
            }
        } catch (error) {
            console.error('Error batch assigning:', error)
        } finally {
            setLoading(false)
        }
    }

    if (!selectedProjectId) {
        return (
            <div className='view-container'>
                <Nav />
                <div className='ingest-empty-state'>
                    <p>Please select a project to view ingested images.</p>
                </div>
            </div>
        )
    }

    return (
        <div className='view-container'>
            <Nav />
            
            <div className='ingest-container'>
                <div className='ingest-header'>
                    <h2>Ingest</h2>
                    <button className='ingest-btn' onClick={() => setShowIngestWizard(true)}>
                        📥 Ingest
                    </button>
                </div>

                {selectedImagesForBatch.length > 0 && (
                    <div className='batch-actions-bar'>
                        <span>{selectedImagesForBatch.length} images selected</span>
                        <button onClick={openBatchAssignModal}>Batch Assign to Event</button>
                        <button onClick={() => setSelectedImagesForBatch([])}>Clear Selection</button>
                    </div>
                )}

                {loading && <div className='ingest-loading'>Loading...</div>}

                <div className='folder-structure'>
                    {Object.keys(folderStructure).length === 0 ? (
                        <div className='empty-state'>
                            <p>No images ingested yet. Click "Ingest" to get started!</p>
                        </div>
                    ) : (
                        Object.keys(folderStructure).sort().reverse().map(date => (
                            <div key={date} className='date-folder'>
                                <div 
                                    className='date-folder-header' 
                                    onClick={() => toggleDateFolder(date)}
                                >
                                    <span className='folder-icon'>{expandedDateFolders[date] ? '📂' : '📁'}</span>
                                    <span className='folder-name'>{date}</span>
                                    <span className='folder-count'>
                                        {Object.keys(folderStructure[date]).length} folders
                                    </span>
                                </div>

                                {expandedDateFolders[date] && (
                                    <div className='custom-folders'>
                                        {Object.keys(folderStructure[date]).sort().map(customFolder => {
                                            const folderKey = `${date}_${customFolder}`
                                            const imageList = folderStructure[date][customFolder]
                                            
                                            return (
                                                <div key={folderKey} className='custom-folder'>
                                                    <div 
                                                        className='custom-folder-header'
                                                        onClick={() => toggleCustomFolder(date, customFolder)}
                                                    >
                                                        <span className='folder-icon'>{expandedCustomFolders[folderKey] ? '📂' : '📁'}</span>
                                                        <span className='folder-name'>{customFolder}</span>
                                                        <span className='folder-count'>{imageList.length} images</span>
                                                    </div>

                                                    {expandedCustomFolders[folderKey] && (
                                                        <div className='image-list'>
                                                            {imageList.map(image => {
                                                                const event = events.find(e => e.id === image.event_id)
                                                                const bgColor = event ? getProcessPointColor(event.process_point) : 'rgba(107, 114, 128, 0.15)'
                                                                const isSelected = selectedImagesForBatch.includes(image.id)
                                                                
                                                                return (
                                                                    <div 
                                                                        key={image.id} 
                                                                        className={`image-item ${isSelected ? 'selected' : ''}`}
                                                                        style={{ backgroundColor: bgColor }}
                                                                        onClick={() => toggleImageSelection(image.id)}
                                                                    >
                                                                        <div className='image-item-header'>
                                                                            <input 
                                                                                type='checkbox' 
                                                                                checked={isSelected}
                                                                                onChange={() => {}}
                                                                            />
                                                                            <span className='image-filename'>{image.filename}</span>
                                                                        </div>
                                                                        <div className='image-metadata'>
                                                                            {image.camera_model && <span>📷 {image.camera_model}</span>}
                                                                            {image.lens && <span>🔍 {image.lens}</span>}
                                                                            {image.iso && <span>ISO {image.iso}</span>}
                                                                            {image.aperture && <span>{image.aperture}</span>}
                                                                            {image.shutter_speed && <span>{image.shutter_speed}</span>}
                                                                            {image.focal_length && <span>{image.focal_length}</span>}
                                                                        </div>
                                                                        {event && (
                                                                            <div className='image-event'>
                                                                                📍 {event.name}
                                                                            </div>
                                                                        )}
                                                                        {!event && (
                                                                            <div className='image-no-event'>
                                                                                ⚠️ No event assigned
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Ingest Wizard Modal */}
            {showIngestWizard && (
                <div className='modal-overlay' onClick={closeWizard}>
                    <div className='ingest-wizard-modal' onClick={(e) => e.stopPropagation()}>
                        <div className='modal-header'>
                            <h2>Ingest Images</h2>
                            <button className='close-btn' onClick={closeWizard}>×</button>
                        </div>

                        <div className='wizard-steps'>
                            <div className={`wizard-step ${wizardStep === 1 ? 'active' : ''}`}>1. Upload</div>
                            <div className={`wizard-step ${wizardStep === 2 ? 'active' : ''}`}>2. Name Folder</div>
                            <div className={`wizard-step ${wizardStep === 3 ? 'active' : ''}`}>3. Review</div>
                        </div>

                        <div className='wizard-content'>
                            {wizardStep === 1 && (
                                <div className='wizard-step-content'>
                                    <h3>Select Images</h3>
                                    <div 
                                        className='drop-zone'
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            handleFileSelect(e.dataTransfer.files)
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <p>Drag and drop images here, or</p>
                                        <input 
                                            type='file' 
                                            multiple 
                                            accept='image/*'
                                            onChange={(e) => handleFileSelect(e.target.files)}
                                            id='file-input'
                                            style={{ display: 'none' }}
                                        />
                                        <label htmlFor='file-input' className='browse-btn'>
                                            Browse Files
                                        </label>
                                    </div>
                                    {selectedFiles.length > 0 && (
                                        <p className='file-count'>{selectedFiles.length} files selected</p>
                                    )}
                                    <button 
                                        className='wizard-next-btn'
                                        disabled={selectedFiles.length === 0}
                                        onClick={() => setWizardStep(2)}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className='wizard-step-content'>
                                    <h3>Name Your Folder & Select Photographer</h3>
                                    <div className='form-field'>
                                        <label>Photographer:</label>
                                        <select 
                                            value={selectedPhotographerId || ''}
                                            onChange={(e) => setSelectedPhotographerId(e.target.value)}
                                        >
                                            <option value=''>Select photographer</option>
                                            {personnel.map(person => (
                                                <option key={person.id} value={person.id}>
                                                    {person.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className='form-field'>
                                        <label>Folder Name:</label>
                                        <input 
                                            type='text'
                                            placeholder='e.g., Marc_01'
                                            value={folderName}
                                            onChange={(e) => setFolderName(e.target.value)}
                                        />
                                    </div>
                                    <div className='form-field'>
                                        <label>Ingest Date:</label>
                                        <input 
                                            type='date'
                                            value={ingestDate}
                                            onChange={(e) => setIngestDate(e.target.value)}
                                        />
                                    </div>
                                    <div className='wizard-actions'>
                                        <button onClick={() => setWizardStep(1)}>Back</button>
                                        <button 
                                            className='wizard-next-btn'
                                            disabled={!folderName || !ingestDate || !selectedPhotographerId}
                                            onClick={() => setWizardStep(3)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 3 && (
                                <div className='wizard-step-content'>
                                    <h3>Review & Submit</h3>
                                    <div className='review-summary'>
                                        <p><strong>Photographer:</strong> {personnel.find(p => p.id === parseInt(selectedPhotographerId))?.name}</p>
                                        <p><strong>Folder:</strong> {ingestDate} / {folderName}</p>
                                        <p><strong>Images:</strong> {parsedImages.length}</p>
                                        <p><strong>Auto-attributed:</strong> {parsedImages.filter(img => img.suggested_event).length} images</p>
                                        <p className='attribution-note'>⚡ Images matched to events where this photographer is assigned</p>
                                    </div>
                                    <div className='review-list'>
                                        {parsedImages.map((img, idx) => (
                                            <div key={idx} className='review-item'>
                                                <span>{img.filename}</span>
                                                {img.suggested_event ? (
                                                    <span className='event-tag'>→ {img.suggested_event.name}</span>
                                                ) : (
                                                    <span className='no-event-tag'>⚠️ No match</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className='wizard-actions'>
                                        <button onClick={() => setWizardStep(2)}>Back</button>
                                        <button 
                                            className='wizard-submit-btn'
                                            onClick={handleIngestSubmit}
                                            disabled={loading}
                                        >
                                            {loading ? 'Submitting...' : 'Submit'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Assign Modal */}
            {showBatchAssignModal && (
                <div className='modal-overlay' onClick={() => setShowBatchAssignModal(false)}>
                    <div className='batch-assign-modal' onClick={(e) => e.stopPropagation()}>
                        <div className='modal-header'>
                            <h2>Batch Assign to Event</h2>
                            <button className='close-btn' onClick={() => setShowBatchAssignModal(false)}>×</button>
                        </div>
                        <div className='modal-body'>
                            <p>{selectedImagesForBatch.length} images selected</p>
                            <div className='form-field'>
                                <label>Select Event:</label>
                                <select 
                                    value={batchAssignEventId || ''}
                                    onChange={(e) => setBatchAssignEventId(parseInt(e.target.value))}
                                >
                                    <option value=''>Select an event</option>
                                    {events.map(event => (
                                        <option key={event.id} value={event.id}>
                                            {event.name} ({event.date} {event.start_time})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='modal-actions'>
                                <button onClick={() => setShowBatchAssignModal(false)}>Cancel</button>
                                <button 
                                    className='assign-btn'
                                    onClick={handleBatchAssign}
                                    disabled={!batchAssignEventId}
                                >
                                    Assign
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

