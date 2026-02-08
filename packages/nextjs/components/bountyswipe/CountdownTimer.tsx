"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  deadline: bigint;
}

/**
 * Minimal inline countdown: "2d 14h 32m" in font-mono.
 * Turns orange when < 1 hour remains. Shows "Ended" when expired.
 */
export const CountdownTimer = ({ deadline }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const deadlineNum = Number(deadline);
      const diff = deadlineNum - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
      }

      return {
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
        expired: false,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (timeLeft.expired) {
    return <span className="font-mono text-sm text-[#DDD7FE]/40">Ended</span>;
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours === 0;

  const parts: string[] = [];
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
  parts.push(`${String(timeLeft.hours).padStart(2, "0")}h`);
  parts.push(`${String(timeLeft.minutes).padStart(2, "0")}m`);

  return (
    <span
      className={`font-mono text-sm ${
        isUrgent ? "text-[#FFAE45]" : "text-[#DDD7FE]/60"
      }`}
    >
      {parts.join(" ")}
    </span>
  );
};
