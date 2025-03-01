document.addEventListener('DOMContentLoaded', () => {
    const authButton = document.getElementById('auth-button');
    const viewCalendarButton = document.getElementById('view-calendar');
    const authStatus = document.getElementById('auth-status');
    const eventsContainer = document.getElementById('events-container');
    const loadingIndicator = document.getElementById('loading');
    
    // Check if already authenticated
    chrome.identity.getAuthToken({ interactive: false }, function(token) {
        if (token) {
            updateUI(true);
        }
    });
    
    // Handle auth button click
    authButton.addEventListener('click', async () => {
        authStatus.textContent = 'Signing in...';
        
        try {
            const token = await authenticate();
            if (token) {
                updateUI(true);
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            authStatus.textContent = 'Sign-in failed. Please try again.';
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
});