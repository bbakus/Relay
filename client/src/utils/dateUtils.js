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
