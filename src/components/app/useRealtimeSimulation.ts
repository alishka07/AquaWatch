import { useEffect } from "react";
import type { Robot } from "./types";
import { advanceRobotSimulation } from "./simulation";

/** Local demo only: no commands or telemetry are exchanged with a real robot. */
export function useRealtimeSimulation(
  setRobots: React.Dispatch<React.SetStateAction<Robot[]>>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setRobots((robots) => {
        const next = robots.map(advanceRobotSimulation);
        return next.every((robot, index) => robot === robots[index]) ? robots : next;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [enabled, setRobots]);
}
