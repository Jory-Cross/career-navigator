function generateQuarterHourOptions() {
  const options = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      const displayHour = hour % 12 || 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const displayMinute = String(minute).padStart(2, "0");

      options.push({
        value,
        label: `${displayHour}:${displayMinute} ${ampm}`,
      });
    }
  }

  return options;
}
