# Routing note\n\nThis repo uses src/pages.config.js to register routes.\nAdd the following entry to expose the Time Entries page:\n\n```js
// pages.config.js
import TimeEntriesRoute from './pages/time-entries.jsx';

export default [
  // ...other routes
  { path: '/time-entries', element: <TimeEntriesRoute /> },
];
```
