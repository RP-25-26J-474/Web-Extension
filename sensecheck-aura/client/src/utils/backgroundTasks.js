export function runBackgroundTasks(taskGroupName, taskEntries) {
  const entries = taskEntries.filter(Boolean);
  if (entries.length === 0) return;

  void Promise.allSettled(
    entries.map((entry) => Promise.resolve().then(() => entry.run()))
  ).then((results) => {
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const label = entries[index]?.label || `task ${index + 1}`;
        console.error(`Failed background task (${taskGroupName}: ${label}):`, result.reason);
      }
    });
  });
}
