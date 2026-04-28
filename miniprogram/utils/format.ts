export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${formatDate(dateString)} ${hour}:${minute}`;
}
