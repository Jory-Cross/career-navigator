/**
 * Returns the payroll period to display:
 * - Show the PREVIOUS period if it ended within the last 3 days
 *   (e.g. show 1–15 through the 18th; show 16–end through the 3rd of next month)
 * - Otherwise show the CURRENT period
 */
export function getDisplayPayrollPeriod() {
  const now = new Date();
  const day = now.getDate();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based

  // Last day of current month
  const lastDay = new Date(y, m + 1, 0).getDate();
  // Last day of previous month
  const prevMonthLastDay = new Date(y, m, 0).getDate();

  // Within 3 days after the 15th → show previous period (1–15)
  if (day >= 16 && day <= 18) {
    return { start: new Date(y, m, 1), end: new Date(y, m, 15), label: `${now.toLocaleString('default', { month: 'short' })} 1–15` };
  }

  // Within 3 days into new month → show previous period (16–end of last month)
  if (day >= 1 && day <= 3) {
    return {
      start: new Date(y, m - 1, 16),
      end: new Date(y, m - 1, prevMonthLastDay),
      label: `${new Date(y, m - 1).toLocaleString('default', { month: 'short' })} 16–${prevMonthLastDay}`
    };
  }

  // Current period: 1st–15th
  if (day <= 15) {
    return { start: new Date(y, m, 1), end: new Date(y, m, 15), label: `${now.toLocaleString('default', { month: 'short' })} 1–15` };
  }

  // Current period: 16th–end
  return { start: new Date(y, m, 16), end: new Date(y, m, lastDay), label: `${now.toLocaleString('default', { month: 'short' })} 16–${lastDay}` };
}

export function parseDateOnly(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}