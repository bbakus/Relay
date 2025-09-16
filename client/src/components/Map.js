import React, { useState, useRef, useEffect } from 'react'
import { Nav } from './Nav'
import '../styles/map.css'

export const Map = () => {
    const [scale, setScale] = useState(1)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [lastTouchDistance, setLastTouchDistance] = useState(0)
    const mapRef = useRef(null)
    const containerRef = useRef(null)

    // Handle mouse wheel zoom
    const handleWheel = (e) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        const newScale = Math.max(0.5, Math.min(3, scale * delta))
        setScale(newScale)
    }

    // Handle mouse drag
    const handleMouseDown = (e) => {
        if (e.target.tagName === 'IMG') {
            setIsDragging(true)
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
        }
    }

    const handleMouseMove = (e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            })
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    // Handle touch events for mobile
    const handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            // Single touch - drag
            const touch = e.touches[0]
            setIsDragging(true)
            setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
        } else if (e.touches.length === 2) {
            // Two touches - pinch zoom
            const touch1 = e.touches[0]
            const touch2 = e.touches[1]
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            )
            setLastTouchDistance(distance)
        }
    }

    const handleTouchMove = (e) => {
        e.preventDefault()
        
        if (e.touches.length === 1 && isDragging) {
            // Single touch - drag
            const touch = e.touches[0]
            setPosition({
                x: touch.clientX - dragStart.x,
                y: touch.clientY - dragStart.y
            })
        } else if (e.touches.length === 2) {
            // Two touches - pinch zoom
            const touch1 = e.touches[0]
            const touch2 = e.touches[1]
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            )
            
            if (lastTouchDistance > 0) {
                const scaleChange = distance / lastTouchDistance
                const newScale = Math.max(0.5, Math.min(3, scale * scaleChange))
                setScale(newScale)
            }
            setLastTouchDistance(distance)
        }
    }

    const handleTouchEnd = () => {
        setIsDragging(false)
        setLastTouchDistance(0)
    }

    // Reset zoom and position
    const resetView = () => {
        setScale(1)
        setPosition({ x: 0, y: 0 })
    }

    // Fit to screen
    const fitToScreen = () => {
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
    }

    // Add event listeners
    useEffect(() => {
        const container = containerRef.current
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false })
            container.addEventListener('mousemove', handleMouseMove)
            container.addEventListener('mouseup', handleMouseUp)
            container.addEventListener('touchmove', handleTouchMove, { passive: false })
            container.addEventListener('touchend', handleTouchEnd)
            
            return () => {
                container.removeEventListener('wheel', handleWheel)
                container.removeEventListener('mousemove', handleMouseMove)
                container.removeEventListener('mouseup', handleMouseUp)
                container.removeEventListener('touchmove', handleTouchMove)
                container.removeEventListener('touchend', handleTouchEnd)
            }
        }
    }, [isDragging, dragStart, position, scale, lastTouchDistance])

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
                        className='map-viewer'
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                    >
                        <img
                            ref={mapRef}
                            src='/images/map/map-screenshot.png'
                            alt='Location Map'
                            className='map-image'
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transformOrigin: 'center center'
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
