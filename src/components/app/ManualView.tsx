import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Camera,
  FlaskConical,
  Octagon,
  Radio,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RobotPicker } from "./WorkspaceViews";
import { downloadBlob } from "./report";
import type { Robot } from "./types";

type Direction = "forward" | "back" | "left" | "right";
export function ManualView({
  robots,
  selectedId,
  onPick,
  onUpdate,
  onSample,
  onEnter,
  onAuto,
  enabled,
}: {
  robots: Robot[];
  enabled: boolean;
  selectedId: string;
  onPick: (id: string) => void;
  onUpdate: (r: Robot) => void;
  onSample: (r: Robot) => void;
  onEnter: (r: Robot) => void;
  onAuto: (r: Robot) => void;
}) {
  const r = robots.find((r) => r.id === selectedId) ?? robots[0];
  const [armed, setArmed] = useState(false);
  const [direction, setDirection] = useState<Direction | null>(null);
  const [linkLost, setLinkLost] = useState(false);
  const [camera, setCamera] = useState<"nose" | "uv">("nose");
  const [maxSpeed, setMaxSpeed] = useState(2);
  const current = useRef(r);
  current.current = r;
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;
  const movingRef = useRef(false);
  const stop = useCallback(() => {
    setDirection(null);
    if (movingRef.current && current.current) {
      updateRef.current({ ...current.current, speed: 0 });
    }
    movingRef.current = false;
  }, []);
  useEffect(() => {
    const halt = () => {
      stop();
      setArmed(false);
    };
    const hidden = () => {
      if (document.hidden) halt();
    };
    window.addEventListener("blur", halt);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", halt);
      document.removeEventListener("visibilitychange", hidden);
      stop();
    };
  }, [stop]);
  useEffect(() => {
    if (!r || r.status === "offline" || r.battery <= 0 || linkLost || !enabled) {
      stop();
      setArmed(false);
    }
  }, [r?.status, r?.battery, linkLost, enabled, stop]);
  useEffect(() => {
    if (!enabled || !armed || !direction || linkLost) return;
    const id = setInterval(() => {
      const robot = current.current;
      if (!robot || robot.status === "offline" || robot.battery <= 0) return;
      movingRef.current = true;
      const turn = direction === "left" ? -5 : direction === "right" ? 5 : 0;
      const heading = (robot.heading + turn + 360) % 360;
      const throttle = direction === "forward" ? 1 : direction === "back" ? -0.5 : 0;
      const distance = throttle * maxSpeed * 0.075;
      updateRef.current({
        ...robot,
        status: "online",
        heading,
        speed: Math.abs(throttle) * maxSpeed,
        position: {
          x: Math.max(
            1,
            Math.min(99, robot.position.x + Math.cos((heading * Math.PI) / 180) * distance),
          ),
          y: Math.max(
            1,
            Math.min(99, robot.position.y + Math.sin((heading * Math.PI) / 180) * distance),
          ),
        },
        trail: [...robot.trail, robot.position].slice(-28),
      });
    }, 100);
    return () => clearInterval(id);
  }, [enabled, armed, direction, linkLost, maxSpeed]);
  const keyDirection: Record<string, Direction> = {
    ArrowUp: "forward",
    ArrowDown: "back",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "forward",
    s: "back",
    a: "left",
    d: "right",
  };
  const command = (d: Direction) => {
    if (enabled && armed && !linkLost && r?.status !== "offline") setDirection(d);
  };
  if (!r)
    return <div className="empty-state">Добавьте аппарат для демонстрации ручного управления.</div>;
  const changeRobot = (id: string) => {
    stop();
    setArmed(false);
    setLinkLost(false);
    onPick(id);
  };
  const snapshot = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="#e2ecee"/><path d="M0 300 Q200 260 400 300 T800 300 T1200 300" fill="none" stroke="#335e57" stroke-width="4"/><text x="70" y="90" font-family="sans-serif" font-size="30" fill="#242a23">AquaWatch / Demo snapshot</text><text x="70" y="145" font-family="sans-serif" font-size="20">${new Date().toISOString()} / Camera: ${camera} / Heading: ${r.heading.toFixed(0)}</text><text x="70" y="620" font-family="sans-serif" font-size="22">Synthetic scene. No live camera connected.</text></svg>`;
    downloadBlob(`aquawatch-demo-${Date.now()}.svg`, "image/svg+xml", svg);
    toast.success("Демонстрационный снимок сохранён");
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <RobotPicker robots={robots} value={r.id} onChange={changeRobot} />
        <span className="status-pill">Симулятор FPV</span>
      </div>
      <div className={`manual-scene ${camera === "uv" ? "is-uv" : ""}`}>
        <div className="manual-hud">
          <span>
            <Video className="size-4" />
            {camera === "nose" ? "Носовая камера" : "УФ-камера"} · визуализация
          </span>
          <span>
            <Radio className="size-4" />
            {linkLost ? "Потеря связи" : `${r.signal.toFixed(0)}% сигнала`}
          </span>
        </div>
        <div className="manual-status">
          {linkLost
            ? "Связь потеряна. Управление остановлено."
            : r.status === "offline"
              ? "Аппарат не в сети"
              : armed
                ? direction
                  ? "Демонстрационная команда выполняется"
                  : "Удерживайте направление для движения"
                : "Ручное управление выключено"}
        </div>
        <div className="manual-hud">
          <span>Курс {r.heading.toFixed(0)}°</span>
          <span>Скорость {r.speed.toFixed(1)} м/с</span>
          <span>Заряд {r.battery.toFixed(0)}%</span>
        </div>
      </div>
      <div className="manual-controls">
        <section className="workspace-section">
          <div className="section-heading">
            <h2>Управление движением</h2>
          </div>
          <p className="text-sm text-muted-foreground my-3">
            Удерживайте кнопку или стрелку клавиатуры. Отпускание останавливает движение.
          </p>
          <div
            className="control-pad"
            tabIndex={0}
            role="group"
            aria-label="Управление стрелками клавиатуры"
            onKeyDown={(e) => {
              const d = keyDirection[e.key];
              if (d) {
                e.preventDefault();
                command(d);
              }
              if (e.key === "Escape") {
                stop();
                setArmed(false);
              }
            }}
            onKeyUp={(e) => {
              if (keyDirection[e.key]) {
                e.preventDefault();
                stop();
              }
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) stop();
            }}
          >
            <div className="manual-directions">
              {(
                [
                  { d: "forward", label: "Вперёд", Icon: ArrowUp },
                  { d: "left", label: "Влево", Icon: ArrowLeft },
                  { d: "back", label: "Назад", Icon: ArrowDown },
                  { d: "right", label: "Вправо", Icon: ArrowRight },
                ] as const
              ).map(({ d, label, Icon }) => (
                <Button
                  key={d}
                  aria-label={label}
                  className={`direction-${d}`}
                  variant={direction === d ? "default" : "outline"}
                  disabled={!enabled || !armed || linkLost || r.status === "offline"}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    command(d);
                  }}
                  onPointerUp={stop}
                  onPointerCancel={stop}
                  onLostPointerCapture={stop}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      command(d);
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.key === " " || e.key === "Enter") stop();
                  }}
                >
                  <Icon className="size-5" />
                </Button>
              ))}
            </div>
          </div>
          <label className="grid gap-3 mt-4 text-sm">
            Ограничение скорости: {maxSpeed.toFixed(1)} м/с
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.5"
              value={maxSpeed}
              onChange={(e) => setMaxSpeed(+e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 mt-5">
            <Button
              disabled={!enabled || r.status === "offline" || r.battery <= 0 || linkLost}
              onClick={() => {
                stop();
                if (!armed) {
                  onUpdate({ ...r, status: "online", speed: 0 });
                  onEnter(r);
                }
                setArmed(!armed);
              }}
            >
              {armed ? "Выключить управление" : "Включить управление"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                stop();
                setArmed(false);
                if (r.status !== "offline") onUpdate({ ...r, status: "online", speed: 0 });
                toast.info("Движение в симуляторе остановлено");
              }}
            >
              <Octagon className="size-4" />
              Стоп
            </Button>
          </div>
        </section>
        <section className="workspace-section">
          <div className="section-heading">
            <h2>Камера и отбор проб</h2>
          </div>
          <div className="grid gap-3 mt-5">
            <div className="flex gap-2">
              <Button
                variant={camera === "nose" ? "default" : "outline"}
                onClick={() => setCamera("nose")}
              >
                Носовая
              </Button>
              <Button
                variant={camera === "uv" ? "default" : "outline"}
                onClick={() => setCamera("uv")}
              >
                УФ-камера
              </Button>
            </div>
            <Button variant="outline" onClick={snapshot}>
              <Camera className="size-4" />
              Сохранить демоснимок
            </Button>
            <Button
              variant="outline"
              disabled={r.status === "offline" || linkLost}
              onClick={() => onSample(r)}
            >
              <FlaskConical className="size-4" />
              Добавить демопробу
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                stop();
                setArmed(false);
                setLinkLost(!linkLost);
              }}
            >
              {linkLost ? "Восстановить демосвязь" : "Проверить потерю связи"}
            </Button>
            <Button
              variant="ghost"
              disabled={r.status === "offline" || linkLost || r.waypoints.length < 2}
              onClick={() => {
                stop();
                setArmed(false);
                onAuto({ ...r, speed: 0 });
              }}
            >
              Вернуться к автомиссии
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-6 mt-5">
            Изображение — концепция SuBulaq. Команды меняют только состояние демофлота в этом
            браузере; видеопоток с аппарата не подключён.
          </p>
        </section>
      </div>
    </div>
  );
}
