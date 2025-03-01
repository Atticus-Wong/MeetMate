// Handle form submission
document.getElementById('task-form').addEventListener('submit', function(e) {
  e.preventDefault();

  // Get input values from the form
  const taskName = document.getElementById('task-name').value;
  const taskDuration = parseInt(document.getElementById('task-duration').value);

  if (!taskName || isNaN(taskDuration)) {
    alert("Please enter both task name and duration.");
    return;
  }

  // Call the function to find available time
  findAvailableTimeSlot(taskName, taskDuration);
});

// Placeholder function to simulate getting the next available time slot from Google Calendar
function findAvailableTimeSlot(taskName, taskDuration) {
  // In a real-world scenario, you'd call the Google Calendar API here.
  // For now, we'll simulate the available time slot by adding 'taskDuration' minutes to the current time.

  const nextAvailableTime = new Date();
  nextAvailableTime.setMinutes(nextAvailableTime.getMinutes() + taskDuration);  // Add task duration to current time

  // Format the available time in a human-readable format
  const formattedTime = nextAvailableTime.toLocaleString();

  // Update the UI to show the available time slot
  const timeSlotElement = document.getElementById('time-slot');
  timeSlotElement.innerText = `The task "${taskName}" can be scheduled at: ${formattedTime}`;

  // Make the available time slot section visible
  document.getElementById('available-time').style.display = 'block';
}

