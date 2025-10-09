# Events Page Search Feature

## Overview
Added a comprehensive search feature to the Events page that allows users to quickly find events by searching across multiple fields.

## Features

### 1. Search Input
- **Location**: Top of the Events page, next to the "Add Event" button
- **Placeholder**: "Search events by name, location, or notes..."
- **Real-time filtering**: Results update as you type
- **Clear button**: Click the × button to clear the search quickly

### 2. Search Scope
The search filters events across the following fields:
- Event name
- Location
- Notes
- Photographer notes
- Completed notes

### 3. Search Applies to All Sections
The search feature filters events in:
- **Today's Events** (or selected date events)
- **Live Events**
- **Upcoming Events**
- **All Events in Project**

### 4. Visual Indicators
- **Search indicator badge**: Shows "Searching..." in each section header when a search is active
- **Animated pulse effect**: The search indicator gently pulses to show search is active
- **Result counts**: Badge shows number of matching events in each section
- **Clear button**: Appears when text is entered, positioned inside the search input

### 5. Compatibility with Existing Filters
The search feature works **in conjunction** with existing filters:
- Quick Turn filter (Yes/No/All)
- Process Point filter (Idle/Ingest/Cull/Color/Delivered)
- Date filter (in All Events section)

Events must match **both** the search query **and** the selected filters.

## How to Use

### Basic Search
1. Navigate to the Events page
2. Type your search query in the search input at the top
3. Results filter automatically across all sections
4. Click the × button or clear the input to show all events again

### Search Examples
- **"Room 201"** - Find all events in Room 201
- **"headshots"** - Find all headshot events
- **"VIP"** - Find events with VIP in any field
- **"urgent"** - Find events marked as urgent in notes

### Combined Search and Filters
1. Enter a search term (e.g., "conference")
2. Apply additional filters:
   - Set Quick Turn to "Yes" to show only quick turn conference events
   - Set Process to "Delivered" to show only completed conference events
3. Results show events matching **all** criteria

## Technical Details

### Files Modified
1. **`client/src/components/Events.js`**
   - Added `searchQuery` state
   - Created `filterBySearch()` helper function
   - Updated all filtered event hooks to include search filter
   - Added search input UI and clear button
   - Added search indicators to section headers

2. **`client/src/styles/events.css`**
   - Styled search input with focus states
   - Styled clear button with hover effects
   - Added search indicator badge with pulse animation
   - Added responsive styles for mobile devices

### Search Logic
```javascript
const filterBySearch = (events) => {
    if (!searchQuery.trim()) return events
    
    const query = searchQuery.toLowerCase().trim()
    return events.filter(event => {
        const name = (event.name || '').toLowerCase()
        const location = (event.location || '').toLowerCase()
        const notes = (event.notes || '').toLowerCase()
        const photographerNotes = (event.photographer_notes || '').toLowerCase()
        const completedNotes = (event.completed_notes || '').toLowerCase()
        
        return name.includes(query) || 
               location.includes(query) || 
               notes.includes(query) ||
               photographerNotes.includes(query) ||
               completedNotes.includes(query)
    })
}
```

### Performance
- **Case-insensitive**: Search is not case-sensitive
- **Partial matches**: Finds partial matches (e.g., "room" matches "Room 201")
- **Real-time**: Uses React's `useMemo` for efficient re-filtering
- **No API calls**: Filters client-side for instant results

## Responsive Design

### Desktop (> 768px)
- Search input: 350px wide
- Positioned horizontally with "Add Event" button
- Clear button positioned inside input on the right

### Tablet (≤ 768px)
- Search input: Full width
- Stacked vertically above "Add Event" button
- Clear button adjusts position

### Mobile (≤ 480px)
- Search input: Full width with 16px font size (prevents iOS zoom)
- Search indicator: Displays as block element below section title
- All controls stack vertically for easy touch interaction

## UI/UX Details

### Color Scheme
- **Input border**: Orange tint (`rgba(255, 122, 24, 0.3)`)
- **Input focus**: Bright orange (`#ff7a18`)
- **Clear button**: Semi-transparent orange background
- **Search indicator**: Orange badge with pulse animation

### Animations
- **Pulse effect**: Smooth 2-second pulse on search indicator
- **Hover effects**: Clear button scales up on hover
- **Focus state**: Input gets subtle glow when focused

### Accessibility
- Clear placeholder text
- Visual feedback on focus
- Keyboard accessible (Tab to navigate, Enter/Escape support)
- Clear button has title attribute for tooltips

## Future Enhancements (Optional)

Potential improvements for future versions:
1. **Search history**: Remember recent searches
2. **Advanced filters**: Search by specific fields only
3. **Keyboard shortcuts**: Cmd/Ctrl+F to focus search
4. **Highlight matches**: Highlight search terms in results
5. **Search suggestions**: Auto-complete based on event names
6. **Export results**: Export filtered events to CSV/PDF

## Testing Checklist

- [ ] Search filters events correctly across all sections
- [ ] Search works with existing filters (Quick Turn, Process, Date)
- [ ] Clear button appears and works correctly
- [ ] Search is case-insensitive
- [ ] Empty search shows all events
- [ ] Search indicator appears when searching
- [ ] Result counts update correctly
- [ ] Mobile responsive design works on small screens
- [ ] Search input doesn't cause zoom on iOS
- [ ] No performance issues with large event lists

