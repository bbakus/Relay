import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Nav } from './Nav'
import '../styles/map.css'

export const Map = () => {
    const [scale, setScale] = useState(1)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [lastTouchDistance, setLastTouchDistance] = useState(0)
    const [isPinching, setIsPinching] = useState(false)
    const mapRef = useRef(null)
    const containerRef = useRef(null)

    // Handle mouse wheel zoom with better zoom behavior
    const handleWheel = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        
        const rect = containerRef.current.getBoundingClientRect()
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        const newScale = Math.max(0.3, Math.min(5, scale * delta))
        
        // Zoom towards mouse position
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        
        const newPosition = {
            x: centerX - (centerX - position.x) * (newScale / scale) - (mouseX - centerX) * (newScale / scale - 1),
            y: centerY - (centerY - position.y) * (newScale / scale) - (mouseY - centerY) * (newScale / scale - 1)
        }
        
        setScale(newScale)
        setPosition(newPosition)
    }, [scale, position])

    // Handle mouse drag start
    const handleMouseDown = useCallback((e) => {
        if (e.target.tagName === 'IMG' && e.button === 0) { // Left mouse button only
            e.preventDefault()
            setIsDragging(true)
            setDragStart({ 
                x: e.clientX - position.x, 
                y: e.clientY - position.y 
            })
        }
    }, [position])

    // Handle mouse drag move
    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            e.preventDefault()
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            })
        }
    }, [isDragging, dragStart])

    // Handle mouse drag end
    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Handle touch start
    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 1) {
            // Single touch - drag
            const touch = e.touches[0]
            setIsDragging(true)
            setDragStart({ 
                x: touch.clientX - position.x, 
                y: touch.clientY - position.y 
            })
            setIsPinching(false)
        } else if (e.touches.length === 2) {
            // Two touches - pinch zoom
            const touch1 = e.touches[0]
            const touch2 = e.touches[1]
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            )
            setLastTouchDistance(distance)
            setIsPinching(true)
            setIsDragging(false)
        }
    }, [position])

    // Handle touch move
    const handleTouchMove = useCallback((e) => {
        e.preventDefault()
        
        if (e.touches.length === 1 && isDragging && !isPinching) {
            // Single touch - drag
            const touch = e.touches[0]
            setPosition({
                x: touch.clientX - dragStart.x,
                y: touch.clientY - dragStart.y
            })
        } else if (e.touches.length === 2 && isPinching) {
            // Two touches - pinch zoom
            const touch1 = e.touches[0]
            const touch2 = e.touches[1]
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            )
            
            if (lastTouchDistance > 0) {
                const scaleChange = distance / lastTouchDistance
                const newScale = Math.max(0.3, Math.min(5, scale * scaleChange))
                setScale(newScale)
            }
            setLastTouchDistance(distance)
        }
    }, [isDragging, isPinching, dragStart, scale, lastTouchDistance])

    // Handle touch end
    const handleTouchEnd = useCallback(() => {
        setIsDragging(false)
        setIsPinching(false)
        setLastTouchDistance(0)
    }, [])

    // Reset zoom and position
    const resetView = useCallback(() => {
        setScale(1)
        setPosition({ x: 0, y: 0 })
    }, [])

    // Fit to screen
    const fitToScreen = useCallback(() => {
        if (mapRef.current && containerRef.current) {
            const container = containerRef.current
            const img = mapRef.current
            
            const containerAspect = container.clientWidth / container.clientHeight
            const imgAspect = img.naturalWidth / img.naturalHeight
            
            let newScale
            if (containerAspect > imgAspect) {
                newScale = container.clientHeight / img.naturalHeight
            } else {
                newScale = container.clientWidth / img.naturalWidth
            }
            
            setScale(newScale)
            setPosition({ x: 0, y: 0 })
        }
    }, [])

    // Add event listeners
    useEffect(() => {
        const container = containerRef.current
        const img = mapRef.current
        
        if (container && img) {
            // Mouse events
            container.addEventListener('wheel', handleWheel, { passive: false })
            container.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            img.addEventListener('mousedown', handleMouseDown)
            
            // Touch events
            container.addEventListener('touchstart', handleTouchStart, { passive: false })
            container.addEventListener('touchmove', handleTouchMove, { passive: false })
            container.addEventListener('touchend', handleTouchEnd)
            
            return () => {
                container.removeEventListener('wheel', handleWheel)
                container.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
                img.removeEventListener('mousedown', handleMouseDown)
                container.removeEventListener('touchstart', handleTouchStart)
                container.removeEventListener('touchmove', handleTouchMove)
                container.removeEventListener('touchend', handleTouchEnd)
            }
        }
    }, [handleWheel, handleMouseMove, handleMouseUp, handleMouseDown, handleTouchStart, handleTouchMove, handleTouchEnd])

    return (
        <div className='page-container'>
            <Nav />
            <div className='view-container'>
                <div className='map-container'>
                    <div className='map-header'>
                        <h1>Location Map</h1>
                        <div className='map-controls'>
                            <button onClick={resetView} className='map-control-btn'>
                                Reset View
                            </button>
                            <button onClick={fitToScreen} className='map-control-btn'>
                                Fit to Screen
                            </button>
                        </div>
                    </div>
                    
                    <div 
                        ref={containerRef}
                        className={`map-viewer ${isDragging ? 'dragging' : ''}`}
                    >
                        <img
                            ref={mapRef}
                            src='/images/map/map-screenshot.png'
                            alt='Location Map'
                            className='map-image'
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transformOrigin: 'center center',
                                willChange: 'transform'
                            }}
                            draggable={false}
                        />
                    </div>
                    
                    <div className='map-info'>
                        <p>Use mouse wheel to zoom, drag to pan, or pinch on mobile</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
