document.addEventListener('DOMContentLoaded', () => {
    let currentAuthToken = null;
    const authButton = document.getElementById('auth-button');
    const viewCalendarButton = document.getElementById('view-calendar');
    const authStatus = document.getElementById('auth-status');
    const eventsContainer = document.getElementById('events-container');
    const loadingIndicator = document.getElementById('loading');
    
    // Check if already authenticated
    chrome.identity.getAuthToken({ interactive: false }, function(token) {
        if (token) {
            currentAuthToken = token;
            updateUI(true);
        }
    });
    
    // Handle auth button click
    authButton.addEventListener('click', async () => {
        // Check if user is already signed in
        if (authButton.textContent === 'Sign out') {
            // Sign out logic
            chrome.identity.removeCachedAuthToken({ token: currentAuthToken }, () => {
                // Revoke access
                if (currentAuthToken) {
                    fetch(`https://accounts.google.com/o/oauth2/revoke?token=${currentAuthToken}`)
                        .then(() => {
                            console.log('Token revoked');
                        })
                        .catch(error => console.error('Error revoking token:', error))
                        .finally(() => {
                            currentAuthToken = null;
                            updateUI(false);
                        });
                } else {
                    updateUI(false);
                }
            });
        } else {
            // Sign in logic (existing code)
            console.log('Sign in with google');
            authStatus.textContent = 'Signing in...';
            
            try {
                const token = await authenticate();
                if (token) {
                    currentAuthToken = token;
                    updateUI(true);
                }
            } catch (error) {
                console.error('Authentication failed:', error);
                authStatus.textContent = 'Sign-in failed. Please try again.';
            }
        }
    });
    
    // Handle view calendar button click
    viewCalendarButton.addEventListener('click', async () => {
        loadingIndicator.style.display = 'block';
        eventsContainer.innerHTML = '';
        
        try {
            const calendarData = await getCalendarEvents();
            loadingIndicator.style.display = 'none';
            
            if (calendarData && calendarData.items) {
                displayEvents(calendarData.items);
            } else {
                eventsContainer.innerHTML = '<p>No upcoming events found.</p>';
            }
        } catch (error) {
            console.error('Error fetching events:', error);
            loadingIndicator.style.display = 'none';
            eventsContainer.innerHTML = '<p>Failed to load events. Please try again.</p>';
        }
    });
    
    // Function to update UI based on auth state
    function updateUI(isAuthenticated) {
        if (isAuthenticated) {
            authStatus.textContent = 'Signed in';
            authButton.textContent = 'Sign out';
            viewCalendarButton.disabled = false;
        } else {
            authStatus.textContent = 'Not signed in';
            authButton.textContent = 'Sign in with Google';
            viewCalendarButton.disabled = true;
            eventsContainer.innerHTML = '';
        }
    }
    
    // Function to display events in the UI
    function displayEvents(events) {
        if (events.length === 0) {
            eventsContainer.innerHTML = '<p>No upcoming events found.</p>';
            return;
        }
        
        let eventsList = '';
        events.forEach(event => {
            const start = event.start.dateTime || event.start.date;
            const formattedDate = new Date(start).toLocaleString();
            eventsList += `
                <div class="event-item">
                    <strong>${event.summary || 'Untitled Event'}</strong>
                    <div>${formattedDate}</div>
                </div>
            `;
        });
        
        eventsContainer.innerHTML = eventsList;
    }

    // Add this to your DOMContentLoaded event listener
    const toggleScheduleButton = document.getElementById('toggle-schedule');
    const scheduleContainer = document.getElementById('schedule-container');

    toggleScheduleButton.addEventListener('click', () => {
        if (scheduleContainer.style.display === 'none') {
            scheduleContainer.style.display = 'block';
            toggleScheduleButton.textContent = 'Hide Scheduler';
        } else {
            scheduleContainer.style.display = 'none';
            toggleScheduleButton.textContent = 'Schedule New Meeting';
        }
    });

    // Add this inside your DOMContentLoaded event listener
    const scheduleButton = document.getElementById('schedule-button');
    const eventNameInput = document.getElementById('event-name');
    const eventDurationInput = document.getElementById('event-duration');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const scheduleStatus = document.getElementById('schedule-status');

    scheduleButton.addEventListener('click', async () => {
        // Validate form
        const eventName = eventNameInput.value.trim();
        const duration = parseInt(eventDurationInput.value);
        
        if (!eventName) {
            scheduleStatus.textContent = 'Please enter an event name';
            return;
        }
        
        if (!duration || duration < 15) {
            scheduleStatus.textContent = 'Please enter a valid duration (minimum 15 minutes)';
            return;
        }
        
        scheduleStatus.textContent = 'Finding available time slot...';
        
        try {
            // Get current events to find free time
            const calendarData = await getCalendarEvents();
            
            if (!calendarData || !calendarData.items) {
                scheduleStatus.textContent = 'Failed to fetch calendar data';
                return;
            }
            
            // Find suitable time slot
            const timeSlot = findAvailableTimeSlot(calendarData.items, duration, startTimeInput.value, endTimeInput.value);
            
            if (!timeSlot) {
                scheduleStatus.textContent = 'No suitable time slot found. Try different parameters.';
                return;
            }
            
            // Create the event
            const result = await createCalendarEvent(eventName, timeSlot.start, timeSlot.end);
            
            if (result && result.id) {
                const formattedTime = new Date(timeSlot.start).toLocaleString();
                scheduleStatus.textContent = `Success! Event scheduled for ${formattedTime}`;
                
                // Clear form
                eventNameInput.value = '';
                
                // Refresh events list if it's visible
                if (eventsContainer.innerHTML !== '') {
                    viewCalendarButton.click();
                }
            } else {
                scheduleStatus.textContent = 'Failed to create event. Please try again.';
            }
        } catch (error) {
            console.error('Scheduling error:', error);
            scheduleStatus.textContent = 'An error occurred. Please try again.';
        }
    });

    // Find an available time slot based on current calendar events
    function findAvailableTimeSlot(events, durationMinutes, earliestTime, latestTime) {
        // Convert events to time ranges
        const busyRanges = events.map(event => {
            const start = new Date(event.start.dateTime || event.start.date);
            const end = new Date(event.end.dateTime || event.end.date);
            return { start, end };
        });
        
        // Sort events by start time
        busyRanges.sort((a, b) => a.start - b.start);
        
        // Set search boundaries
        const now = new Date();
        let searchStart = new Date(now);
        searchStart.setMinutes(Math.ceil(searchStart.getMinutes() / 15) * 15, 0, 0); // Round to next 15 mins
        
        const searchEnd = new Date();
        searchEnd.setDate(now.getDate() + 3); // Look 3 days ahead
        
        // Apply user-defined time boundaries
        if (earliestTime) {
            const [hours, minutes] = earliestTime.split(':').map(Number);
            searchStart.setHours(hours, minutes, 0, 0);
            
            // If the specified time is in the past, move to tomorrow
            if (searchStart < now) {
                searchStart.setDate(searchStart.getDate() + 1);
            }
        }
        
        if (latestTime) {
            const [hours, minutes] = latestTime.split(':').map(Number);
            const todayLatest = new Date(now);
            todayLatest.setHours(hours, minutes, 0, 0);
            
            // If "latest time" is earlier than "earliest time" within the same day,
            // we assume the user means to not schedule after this time on any day
            if (todayLatest < searchStart && todayLatest.getDate() === searchStart.getDate()) {
                searchEnd.setHours(hours, minutes, 0, 0);
            } else {
                // Otherwise, apply the latest time to all days
                searchEnd.setHours(hours, minutes, 0, 0);
            }
        }
        
        // Convert duration to milliseconds
        const durationMs = durationMinutes * 60 * 1000;
        
        // Business hours (9AM to 5PM)
        const businessStartHour = 9;
        const businessEndHour = 17;
        
        // Check each potential slot
        let current = new Date(searchStart);
        
        while (current < searchEnd) {
            // Skip non-business hours
            if (current.getHours() < businessStartHour) {
                current.setHours(businessStartHour, 0, 0, 0);
            } else if (current.getHours() >= businessEndHour) {
                // Move to next day, 9AM
                current.setDate(current.getDate() + 1);
                current.setHours(businessStartHour, 0, 0, 0);
                continue;
            }
            
            // Potential end time
            const potentialEnd = new Date(current.getTime() + durationMs);
            
            // Check if end time is still within business hours
            if (potentialEnd.getHours() >= businessEndHour || 
                (potentialEnd.getHours() === businessEndHour && potentialEnd.getMinutes() > 0)) {
                // Move to next day, 9AM
                current.setDate(current.getDate() + 1);
                current.setHours(businessStartHour, 0, 0, 0);
                continue;
            }
            
            // Check if slot overlaps with any existing event
            let isOverlapping = false;
            for (const range of busyRanges) {
                if (current < range.end && potentialEnd > range.start) {
                    isOverlapping = true;
                    // Move current time to the end of this event
                    current = new Date(range.end);
                    break;
                }
            }
            
            if (!isOverlapping) {
                // Found a slot!
                return {
                    start: current.toISOString(),
                    end: potentialEnd.toISOString()
                };
            }
        }
        
        // No suitable time slot found
        return null;
    }

    // Create a calendar event
    async function createCalendarEvent(summary, startTime, endTime) {
        try {
            const token = await authenticate();
            
            const event = {
                summary,
                start: {
                    dateTime: startTime
                },
                end: {
                    dateTime: endTime
                }
            };
            
            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error creating calendar event:', error);
            throw error;
        }
    }
});