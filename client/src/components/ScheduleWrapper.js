import React, { useState, useEffect } from 'react'
import { Schedule } from './Schedule'
import { ScheduleMobile } from './ScheduleMobile'

export const ScheduleWrapper = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768)
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Render mobile or desktop version based on screen width
    return isMobile ? <ScheduleMobile /> : <Schedule />
}

