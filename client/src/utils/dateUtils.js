// Helper function to format dates consistently across the app
// Converts "2025-08-16" to "8/16/2025" without timezone issues
export const formatDateDisplay = (dateString) => {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-')
  return `${parseInt(month)}/${parseInt(day)}/${year}`
}

// Helper function to format dates for display in headers and titles
export const formatDateForHeader = (dateString) => {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-')
  return `${parseInt(month)}/${parseInt(day)}/${year}`
}

// Helper function to format time in 12-hour format with AM/PM
export const formatTime12Hour = (timeStr) => {
  if (!timeStr) return ''
  const [rawHour = '0', rawMin = '0'] = String(timeStr).split(':')
  let hour = Number(rawHour)
  const minute = Number(rawMin)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour}:${String(minute).padStart(2, '0')} ${ampm}`
}
