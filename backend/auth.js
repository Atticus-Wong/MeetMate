window.authenticate = async function() {
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
};

window.getCalendarEvents = async function() {
  try {
    const token = await window.authenticate();
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
};