// Common timezones for quick selection
export const COMMON_TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "America/New_York (EST/EDT)", value: "America/New_York" },
  { label: "America/Chicago (CST/CDT)", value: "America/Chicago" },
  { label: "America/Denver (MST/MDT)", value: "America/Denver" },
  { label: "America/Los_Angeles (PST/PDT)", value: "America/Los_Angeles" },
  { label: "America/Anchorage (AKST/AKDT)", value: "America/Anchorage" },
  { label: "Pacific/Honolulu (HST)", value: "Pacific/Honolulu" },
  { label: "Europe/London (GMT/BST)", value: "Europe/London" },
  { label: "Europe/Paris (CET/CEST)", value: "Europe/Paris" },
  { label: "Europe/Berlin (CET/CEST)", value: "Europe/Berlin" },
  { label: "Asia/Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Asia/Hong_Kong (HKT)", value: "Asia/Hong_Kong" },
  { label: "Asia/Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Australia/Sydney (AEDT/AEST)", value: "Australia/Sydney" },
];

// Format a date/time string to user's timezone
export function formatInTimezone(dateString, timezone) {
  if (!dateString || !timezone) return dateString;
  
  try {
    const date = new Date(dateString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: timezone,
      hour12: false,
    });
    
    const parts = formatter.formatToParts(date);
    const result = {};
    parts.forEach(({ type, value }) => {
      result[type] = value;
    });
    
    return `${result.year}-${result.month}-${result.day} ${result.hour}:${result.minute}`;
  } catch (e) {
    return dateString;
  }
}

// Format just the time portion
export function formatTimeInTimezone(dateString, timezone) {
  if (!dateString || !timezone) return dateString;
  
  try {
    const date = new Date(dateString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
      hour12: true,
    });
    
    return formatter.format(date);
  } catch (e) {
    return dateString;
  }
}

// Get timezone offset for display
export function getTimezoneOffset(timezone) {
  if (!timezone) return "";
  
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short',
      timeZone: timezone,
    });
    
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : timezone;
  } catch (e) {
    return timezone;
  }
}