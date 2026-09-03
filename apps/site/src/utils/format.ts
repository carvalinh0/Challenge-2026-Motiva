/** Formatadores puros de exibição. */

export function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR");
}

/** "2026-08-16" -> "16/08" */
export function formatDayLabel(isoDay: string): string {
  return `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}`;
}

export function toIsoDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Segundos -> "2h 15min" / "45min". */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`;
}

/** "07:00" + 135min -> "09:15". Passa de meia-noite dando a volta no dia. */
export function addMinutesToClock(clock: string, minutes: number): string {
  const [hours = "0", mins = "0"] = clock.split(":");
  const total = Number(hours) * 60 + Number(mins) + Math.round(minutes);
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
