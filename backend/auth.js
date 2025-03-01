async function authenticate() {
  console.log('Starting authentication process...');
  
  try {
    const token = await chrome.identity.getAuthToken({ interactive: true });
    console.log('Authentication successful');
    return token;
  } catch (error) {
    console.error('Chrome identity error:', JSON.stringify(error));
    throw error;
  }
}

async function getCalendarEvents() {
  try {
    const token = await authenticate();
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}