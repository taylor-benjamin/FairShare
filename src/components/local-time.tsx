"use client";

import { useEffect, useState } from "react";

function format(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone });
}

/** A date and time in the reader's own time zone. The server renders UTC; the browser swaps in local time. */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => format(iso, "UTC"));
  useEffect(() => setText(format(iso)), [iso]);
  return <time dateTime={iso}>{text}</time>;
}
