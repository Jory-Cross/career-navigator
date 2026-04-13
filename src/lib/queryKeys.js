export const queryKeys = {
  client: (clientId) => ['client', clientId],

  clientPortal: (clientId) => ['clientPortal', clientId],

  applications: (clientId) => ['clientPortal', 'applications', clientId],
  tasks: (clientId) => ['clientPortal', 'tasks', clientId],
  documents: (clientId) => ['clientPortal', 'documents', clientId],

  activities: (clientId) => ['clientPortal', 'activities', clientId],
  timeEntries: (clientId) => ['clientPortal', 'timeEntries', clientId],
};
