// background.js
let token;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'scheduleEvent') {
    getAuthToken()
      .then(authToken => {
        token = authToken;
        return findNextAvailableSlot(request.eventDetails);
      })
      .then(timeSlot => {
        return createCalendarEvent(request.eventDetails.name, timeSlot, request.eventDetails.duration);
      })
      .then(eventLink => {
        sendResponse({
          success: true,
          message: 'Event scheduled successfully!',
          eventLink: eventLink
        });
      })
      .catch(error => {
        console.error('Error:', error);
        sendResponse({
          success: false,
          message: 'Error: ' + error.message
        });
      });
    return true;  // Indicates async response
  }
});

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (!token) {
        reject(new Error('Authentication failed.'));
        return;
      }
      
      resolve(token);
    });
  });
}

function findNextAvailableSlot(eventDetails) {
  return new Promise((resolve, reject) => {
    // Calculate today at midnight
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    
    // Calculate one week from now at midnight
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    
    // Convert to RFC3339 timestamp format
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();
    
    // Get busy slots from primary calendar
    fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/freeBusy`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timeMin: timeMin,
        timeMax: timeMax,
        items: [{ id: 'primary' }]
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch calendar data');
      }
      return response.json();
    })
    .then(data => {
      const busySlots = data.calendars.primary.busy;
      
      // Convert user preferences for start/end times
      let startTimeValue = null;
      let endTimeValue = null;
      
      if (eventDetails.startTime) {
        const [startHours, startMinutes] = eventDetails.startTime.split(':').map(Number);
        startTimeValue = { hours: startHours, minutes: startMinutes };
      }
      
      if (eventDetails.endTime) {
        const [endHours, endMinutes] = eventDetails.endTime.split(':').map(Number);
        endTimeValue = { hours: endHours, minutes: endMinutes };
      }
      
      // Find the next available slot
      const durationMs = eventDetails.duration * 60 * 1000;
      let potentialStartTime = new Date(now);
      
      // Round up to the nearest 15 minute interval
      potentialStartTime.setMinutes(Math.ceil(potentialStartTime.getMinutes() / 15) * 15, 0, 0);
      
      // If start time preference is set and it's later than now, use that time today
      if (startTimeValue) {
        if (potentialStartTime.getHours() < startTimeValue.hours || 
            (potentialStartTime.getHours() === startTimeValue.hours && 
             potentialStartTime.getMinutes() < startTimeValue.minutes)) {
          potentialStartTime.setHours(startTimeValue.hours, startTimeValue.minutes, 0, 0);
        }
      }
      
      // Try to find a slot over the next 7 days
      const maxSearchTime = new Date(endDate);
      
      while (potentialStartTime < maxSearchTime) {
        // Check if current time is within acceptable hours
        const currentHours = potentialStartTime.getHours();
        const currentMinutes = potentialStartTime.getMinutes();
        
        // Skip times outside of preferred hours (9 AM - 5 PM by default)
        const defaultStartHour = 9;
        const defaultEndHour = 17;
        
        if ((startTimeValue && (currentHours < startTimeValue.hours || 
            (currentHours === startTimeValue.hours && currentMinutes < startTimeValue.minutes))) ||
            (endTimeValue && (currentHours > endTimeValue.hours || 
            (currentHours === endTimeValue.hours && currentMinutes > endTimeValue.minutes))) ||
            (!startTimeValue && currentHours < defaultStartHour) ||
            (!endTimeValue && currentHours >= defaultEndHour)) {
          
          // Move to the next day at start time or default start time
          potentialStartTime.setDate(potentialStartTime.getDate() + 1);
          potentialStartTime.setHours(
            startTimeValue ? startTimeValue.hours : defaultStartHour,
            startTimeValue ? startTimeValue.minutes : 0,
            0, 0
          );
          continue;
        }
        
        // Skip weekends (0 = Sunday, 6 = Saturday)
        const day = potentialStartTime.getDay();
        if (day === 0 || day === 6) {
          potentialStartTime.setDate(potentialStartTime.getDate() + (day === 0 ? 1 : 2));
          potentialStartTime.setHours(
            startTimeValue ? startTimeValue.hours : defaultStartHour,
            startTimeValue ? startTimeValue.minutes : 0,
            0, 0
          );
          continue;
        }
        
        const potentialEndTime = new Date(potentialStartTime.getTime() + durationMs);
        
        // Check if this slot conflicts with any busy time
        let isConflict = false;
        for (const busy of busySlots) {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          
          // Check if potential slot overlaps with busy time
          if ((potentialStartTime >= busyStart && potentialStartTime < busyEnd) || 
              (potentialEndTime > busyStart && potentialEndTime <= busyEnd) ||
              (potentialStartTime <= busyStart && potentialEndTime >= busyEnd)) {
            isConflict = true;
            // Move the start time to the end of this busy slot
            potentialStartTime = new Date(busyEnd);
            // Round up to nearest 15 minutes
            potentialStartTime.setMinutes(Math.ceil(potentialStartTime.getMinutes() / 15) * 15, 0, 0);
            break;
          }
        }
        
        if (!isConflict) {
          // Found an available slot
          resolve({
            start: potentialStartTime.toISOString(),
            end: potentialEndTime.toISOString()
          });
          return;
        }
      }
      
      reject(new Error('No available slots found in the next 7 days.'));
    })
    .catch(error => {
      reject(error);
    });
  });
}

function createCalendarEvent(eventName, timeSlot, durationMinutes) {
  return new Promise((resolve, reject) => {
    const eventDetails = {
      summary: eventName,
      start: {
        dateTime: timeSlot.start
      },
      end: {
        dateTime: timeSlot.end
      }
    };
    
    fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventDetails)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to create calendar event');
      }
      return response.json();
    })
    .then(data => {
      resolve(data.htmlLink);
    })
    .catch(error => {
      reject(error);
    });
  });
}
