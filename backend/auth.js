async function authenticate() {
  console.log('Starting authentication process...');
  
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('Chrome identity error:', chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError);
        return;
      }
      console.log('Authentication successful');
      resolve(token);
    });
  });
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