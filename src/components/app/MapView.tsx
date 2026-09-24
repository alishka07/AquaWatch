import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Bot, ZoomIn, ZoomOut, Layers, Compass, Anchor, Building2, Waves, Pencil, RotateCcw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Robot, Sample } from "./types";
import { MAP_LANDMARKS, RESERVOIR } from "./mock-data";
import { BASE_POSITION } from "./simulation";

type Point = { x: number; y: number };
type Props = {
  robots: Robot[];
  samples: Sample[];
  onSelectRobot: (r: Robot) => void;
  onSelectSample: (s: Sample) => void;
  selectedRobotId?: string;
  editMode?: boolean;
  editingRobotId?: string;
  draftWaypoints?: Point[];
  onMapClick?: (x: number, y: number) => void;
  highlightedSampleId?: string;
};

// Illustrative reservoir shape: these coordinates are not navigational data.
const RESERVOIR_PATH = `M 9,62 C 10,57 20,57 29,54 C 39,50 48,47 58,44
  C 67,41 76,36 84,33 C 90,30 95,31 94,35 C 94,40 88,43 80,46
  C 71,50 64,54 55,57 C 46,61 35,64 26,66 C 17,69 10,67 9,62 Z`;
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

export function MapView({ robots, samples, onSelectRobot, onSelectSample, selectedRobotId, editMode, draftWaypoints, onMapClick, highlightedSampleId }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [showTrails, setShowTrails] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mapHint, setMapHint] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const waterRef = useRef<SVGPathElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const clampPan = useCallback((point: Point, scale: number) => {
    const max = Math.max(0, (scale - 1) * 50);
    return { x: Math.max(-max, Math.min(max, point.x)), y: Math.max(-max, Math.min(max, point.y)) };
  }, []);
  const changeZoom = (scale: number) => {
    const next = Math.max(1, Math.min(6, scale));
    setZoom(next);
    setPan((point) => clampPan(point, next));
  };

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cx = ((event.clientX - rect.left) / rect.width) * 100;
      const cy = ((event.clientY - rect.top) / rect.height) * 100;
      const next = Math.max(1, Math.min(6, zoom * (1 - event.deltaY * 0.002)));
      const ratio = next / zoom;
      setZoom(next);
      setPan(clampPan({ x: (pan.x + 50 - cx) * ratio - (50 - cx), y: (pan.y + 50 - cy) * ratio - (50 - cy) }, next));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoom, pan, clampPan]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editMode || event.button !== 0 || (event.target instanceof Element && event.target.closest("button, [data-map-ui]"))) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
    setDragging(true);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setPan(clampPan({ x: dragRef.current.px + ((event.clientX - dragRef.current.x) / rect.width) * 100, y: dragRef.current.py + ((event.clientY - dragRef.current.y) / rect.height) * 100 }, zoom));
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  };
  const onLayerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || !onMapClick || !wrapRef.current || (event.target instanceof Element && event.target.closest("button, [data-map-ui]"))) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (((event.clientX - rect.left) / rect.width) * 100 - 50 - pan.x) / zoom + 50;
    const y = (((event.clientY - rect.top) / rect.height) * 100 - 50 - pan.y) / zoom + 50;
    if (!waterRef.current?.isPointInFill(new DOMPoint(x, y))) {
      setMapHint("Выберите точку внутри водоёма.");
      return;
    }
    setMapHint("");
    onMapClick(+x.toFixed(2), +y.toFixed(2));
  };

  const clusters = useMemo(() => {
    const grouped = new Map<string, Sample[]>();
    const cellSize = zoom < 1.6 ? 12 : 7;
    samples.forEach((sample) => {
      const key = zoom >= 2.5 || sample.id === highlightedSampleId ? sample.id : `${Math.floor(sample.position.x / cellSize)}_${Math.floor(sample.position.y / cellSize)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), sample]);
    });
    return Array.from(grouped.values()).map((group) => ({ samples: group, x: group.reduce((sum, sample) => sum + sample.position.x, 0) / group.length, y: group.reduce((sum, sample) => sum + sample.position.y, 0) / group.length }));
  }, [samples, zoom, highlightedSampleId]);

  const markerStyle = (point: Point): React.CSSProperties => ({ left: `${point.x}%`, top: `${point.y}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})` });
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <TooltipProvider delayDuration={150}>
      <div ref={wrapRef} role="region" aria-label="Интерактивная схема водохранилища. Стрелки перемещают карту, кнопки меняют масштаб." tabIndex={0}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={onLayerClick}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          setPan((point) => clampPan({ x: point.x + (event.key === "ArrowLeft" ? 5 : event.key === "ArrowRight" ? -5 : 0), y: point.y + (event.key === "ArrowUp" ? 5 : event.key === "ArrowDown" ? -5 : 0) }, zoom));
        }}
        className={`relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden select-none outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary ${editMode ? "cursor-crosshair" : dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ background: "#c7d3c0", color: "#242a23", touchAction: "pan-y", border: "1px solid #bdc8b6" }}>
        <div className="absolute inset-0" style={{ transform: `translate(${pan.x}%, ${pan.y}%) scale(${zoom})`, transformOrigin: "50% 50%" }}>
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <pattern id="map-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#335e57" strokeWidth="0.12" opacity="0.22" /></pattern>
              <clipPath id="water-clip"><path d={RESERVOIR_PATH} /></clipPath>
            </defs>
            <g fill="none" stroke="#acbba5" strokeWidth="0.22" opacity="0.7">
              <path d="M -5,37 C 12,20 30,44 52,26 S 80,18 106,9" /><path d="M -5,33 C 12,15 30,39 52,21 S 80,13 106,4" />
              <path d="M -5,29 C 12,10 30,34 52,16 S 80,8 106,-1" /><path d="M -5,25 C 12,5 30,29 52,11 S 80,3 106,-6" />
              <path d="M -8,89 C 18,72 35,83 51,72 S 81,69 108,55" /><path d="M -8,94 C 18,77 35,88 51,77 S 81,74 108,60" />
              <path d="M -8,99 C 18,82 35,93 51,82 S 81,79 108,65" /><path d="M -8,104 C 18,87 35,98 51,87 S 81,84 108,70" />
            </g>
            <path ref={waterRef} d={RESERVOIR_PATH} fill="#e2ecee" stroke="#b3c9c8" strokeWidth="0.5" />
            <path d="M 91,34 C 96,29 93,26 102,19" fill="none" stroke="#e2ecee" strokeWidth="2" />
            <path d="M 63,54 C 65,58 68,62 67,67" fill="none" stroke="#e2ecee" strokeWidth="0.8" />
            <g fill="none" stroke="#b4cccd" strokeWidth="0.16" clipPath="url(#water-clip)" opacity="0.7">
              <path d="M 12,62 C 30,60 52,49 89,36" /><path d="M 15,64 C 35,62 55,52 89,39" /><path d="M 12,59 C 33,56 57,44 89,33" />
            </g>
            {showGrid && <rect width="100" height="100" fill="url(#map-grid)" />}
            {showTrails && robots.map((robot) => robot.trail.length > 1 && <polyline key={`trail-${robot.id}`} points={robot.trail.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={robot.color} strokeOpacity="0.45" strokeWidth={0.35 / zoom} strokeLinecap="round" />)}
            {robots.filter((robot) => robot.status === "mission" || robot.status === "rtl").map((robot) => {
              const remaining = robot.status === "rtl" ? [BASE_POSITION] : robot.waypoints.slice(robot.waypointIdx);
              return <polyline key={`route-${robot.id}`} points={[robot.position, ...remaining].map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#335e57" strokeWidth={0.35 / zoom} strokeDasharray="0.8 0.7" />;
            })}
            {!!draftWaypoints?.length && <polyline points={draftWaypoints.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#335e57" strokeWidth={0.4 / zoom} strokeDasharray="0.5 0.5" />}
          </svg>
          {MAP_LANDMARKS.map((landmark) => <div key={landmark.id} style={markerStyle(landmark)} className="absolute pointer-events-none z-[1]">
            <span className="flex items-center gap-1.5 text-[10px] whitespace-nowrap rounded-full px-2 py-1 bg-[#f4f5ef]/80 text-[#4f604c]">
              {landmark.kind === "base" ? <Anchor className="size-3" /> : landmark.kind === "infra" ? <Building2 className="size-3" /> : null}{landmark.label}
            </span>
          </div>)}
          {clusters.map((cluster) => {
            const sample = cluster.samples[0];
            const multiple = cluster.samples.length > 1;
            return <Tooltip key={sample.id}><TooltipTrigger asChild>
              <button type="button" onPointerDown={stop} onClick={(event) => {
                event.stopPropagation();
                if (!multiple) { onSelectSample(sample); return; }
                const next = Math.max(2.6, Math.min(6, zoom + 1.2));
                setZoom(next);
                setPan(clampPan({ x: (50 - cluster.x) * next, y: (50 - cluster.y) * next }, next));
              }} style={markerStyle(cluster)} aria-label={multiple ? `Приблизить группу из ${cluster.samples.length} проб` : `Открыть пробу ${sample.id.toUpperCase()}`}
                className={`absolute z-[2] flex items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#335e57] ${multiple ? "size-8 bg-[#f7faf6] text-[#335e57] border-[#9cb5ae] text-xs font-semibold" : "size-7 border-transparent"}`}>
                {multiple ? cluster.samples.length : <span className={`rounded-full bg-[#335e57] border-2 border-[#f7faf6] ${highlightedSampleId === sample.id ? "size-4 ring-2 ring-[#335e57] ring-offset-2" : "size-3"}`} />}
              </button>
            </TooltipTrigger><TooltipContent className="max-w-60 text-xs">
              {multiple ? <p>{cluster.samples.length} проб. Нажмите, чтобы приблизить.</p> : <div className="space-y-1"><p className="font-semibold">Проба {sample.id.toUpperCase()}</p><p>pH {sample.ph} · O₂ {sample.oxygen} мг/л</p><p>{sample.temperature} °C · {sample.turbidity} NTU</p><p className="opacity-70">Нажмите, чтобы открыть результаты</p></div>}
            </TooltipContent></Tooltip>;
          })}
          {robots.map((robot) => <Tooltip key={robot.id}><TooltipTrigger asChild>
            <button type="button" style={markerStyle(robot.position)} onPointerDown={stop} onClick={(event) => { event.stopPropagation(); onSelectRobot(robot); }} aria-label={`Управлять ${robot.name}`} aria-pressed={selectedRobotId === robot.id}
              className={`absolute z-10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#335e57] rounded-full ${selectedRobotId === robot.id ? "ring-2 ring-[#335e57] ring-offset-3 ring-offset-[#e2ecee]" : ""}`}>
              <span className="relative size-10 rounded-full border-2 bg-[#fbfcf8] flex items-center justify-center" style={{ borderColor: robot.status === "offline" ? "#8b9384" : robot.color }}>
                <Bot className="size-5" style={{ color: robot.status === "offline" ? "#7c8577" : robot.color }} />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#fbfcf8]" style={{ background: robot.status === "offline" ? "#8b9384" : robot.color }} />
              </span>
              <span className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium bg-[#fafbf7]/95 px-2 py-1 rounded-full text-[#242a23]">{robot.name}</span>
            </button>
          </TooltipTrigger><TooltipContent className="text-xs"><p className="font-semibold">{robot.name}</p><p>{robot.status === "offline" ? "Не в сети" : robot.status === "mission" ? "На маршруте" : robot.status === "rtl" ? "Возвращается на базу" : "Готов к работе"} · {robot.battery.toFixed(0)}%</p></TooltipContent></Tooltip>)}
          {draftWaypoints?.map((point, index) => <div key={index} style={markerStyle(point)} className="absolute z-[5] pointer-events-none"><span className="size-6 rounded-full bg-[#335e57] text-white border-2 border-[#f7faf6] flex items-center justify-center text-[10px] font-semibold">{index + 1}</span></div>)}
        </div>
        <div data-map-ui className="absolute top-4 left-4 right-4 pointer-events-none">
          <p className="text-xs text-[#4f604c]">Схема водоёма · демоданные</p>
          <h2 className="mt-1 text-sm sm:text-base font-medium">{RESERVOIR.name}</h2>
        </div>
        <div data-map-ui className="absolute top-24 left-3 flex flex-col gap-0.5 rounded-xl p-1 bg-[#fbfcf8]/95 border border-[#b6c4ae]" onPointerDown={stop} onClick={stop}>
          <ToolBtn label="Приблизить карту" onClick={() => changeZoom(zoom + 0.6)}><ZoomIn className="size-4" /></ToolBtn>
          <ToolBtn label="Отдалить карту" onClick={() => changeZoom(zoom - 0.6)}><ZoomOut className="size-4" /></ToolBtn>
          <ToolBtn label="Сбросить вид" onClick={resetView}><RotateCcw className="size-4" /></ToolBtn>
          <ToolBtn label="Показать весь водоём" onClick={resetView}><Maximize2 className="size-4" /></ToolBtn>
          <div className="h-px bg-[#d8dfd1] my-1" />
          <ToolBtn label="Показать следы движения" active={showTrails} onClick={() => setShowTrails((value) => !value)}><Waves className="size-4" /></ToolBtn>
          <ToolBtn label="Показать координатную сетку" active={showGrid} onClick={() => setShowGrid((value) => !value)}><Layers className="size-4" /></ToolBtn>
        </div>
        {editMode && <div data-map-ui className="absolute top-24 left-16 right-3 sm:right-auto max-w-80 flex gap-2 bg-[#fafbf7]/95 border border-[#b6c4ae] rounded-xl p-3 text-xs text-[#335e57] pointer-events-none" role="status"><Pencil className="size-3.5 shrink-0 mt-0.5" /><span>{mapHint || "Нажмите на воду, чтобы добавить точку маршрута."}</span></div>}
        <div data-map-ui className="absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] rounded-full px-3 py-2 bg-[#fbfcf8]/90 border border-[#b6c4ae] pointer-events-none">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#335e57]" />Проба воды</span>
          <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-[#335e57]" />Маршрут</span>
          <span className="hidden sm:flex items-center gap-1.5"><Anchor className="size-3" />База</span>
        </div>
        <div data-map-ui className="absolute bottom-4 right-4 flex items-center gap-1.5 text-xs bg-[#fbfcf8]/90 rounded-full px-2.5 py-2 pointer-events-none"><Compass className="size-4 text-[#335e57]" /><span>{zoom.toFixed(1)}×</span></div>
      </div>
    </TooltipProvider>
  );
}

function ToolBtn({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return <Tooltip><TooltipTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label={label} aria-pressed={active} onClick={onClick} className={`size-8 rounded-lg hover:bg-[#e5ebde] hover:text-[#335e57] ${active ? "bg-[#e5ebde] text-[#335e57]" : "text-[#4f604c]"}`}>{children}</Button></TooltipTrigger><TooltipContent side="right" className="text-xs">{label}</TooltipContent></Tooltip>;
}
