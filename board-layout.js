document.querySelectorAll('.view .panel').forEach((panel) => {
  const track = document.createElement('div');
  track.className = 'panel-track';
  track.tabIndex = 0;
  track.setAttribute('role', 'region');
  track.setAttribute('aria-label', `${panel.querySelector('h3')?.textContent || 'Board'} — scroll horizontally`);
  [...panel.children].filter((child) => !child.classList.contains('panel-heading')).forEach((child) => track.append(child));
  panel.append(track);
});
document.querySelectorAll('.view, .task-list, .suggestion-list, .schedule-list, .position-list, .note-list, .workflow-list, .message-list, .roster-list, .photo-grid, .reminder-list, .time-log, .schedule-pdf-list, .standards-list, .assistant-plan, .time-summary, .schedule-stats').forEach((lane) => {
  lane.tabIndex = 0;
  lane.addEventListener('keydown', (event) => {
    if (event.target !== lane || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    lane.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * lane.clientWidth * 0.9, behavior: 'smooth' });
  });
});
