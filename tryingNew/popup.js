// popup.js
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('addEvent').addEventListener('click', function() {
    const eventName = document.getElementById('eventName').value;
    const duration = parseInt(document.getElementById('duration').value);
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    
    if (!eventName || !duration) {
      document.getElementById('status').textContent = 'Please fill in all required fields.';
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'scheduleEvent',
      eventDetails: {
        name: eventName,
        duration: duration,
        startTime: startTime || null,
        endTime: endTime || null
      }
    }, function(response) {
      document.getElementById('status').textContent = response.message;
    });
  });
});
