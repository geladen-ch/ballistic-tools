// A date as YYYY-MM-DD, the same in every locale — for the Settings screens
// that show when something happened (last synced, a device's last backup, a
// conflict's two sides, a change-history entry). toLocaleString() renders
// "9/21/2026, 7:18:33 PM" here and "21.09.2026, 19:18:33" there, which is
// neither compact nor something two people on different devices can compare.
//
// The date in the viewer's own time zone, not UTC: "last synced today" has
// to say today, and a date taken from toISOString() would flip a day early
// or late around midnight for anyone not on UTC.
export function isoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
