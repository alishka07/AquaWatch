import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Pause, Play, MapPin } from "lucide-react";
import { toast } from "sonner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar, type AppView } from "@/components/app/AppSidebar";
import { ConnectDeviceDialog } from "@/components/app/ConnectDeviceDialog";
import { MapView } from "@/components/app/MapView";
import { RobotPanel } from "@/components/app/RobotPanel";
import { SampleDialog } from "@/components/app/SampleDialog";
import { FleetView, EventLog } from "@/components/app/FleetView";
import { OverviewView } from "@/components/app/OverviewView";
import {
  MissionsView,
  ServiceView,
  ProfileView,
  ParticleDialog,
  useServiceState,
} from "@/components/app/WorkspaceViews";
import { ManualView } from "@/components/app/ManualView";
import { AnalyticsView } from "@/components/app/AnalyticsView";
import { SettingsView } from "@/components/app/SettingsView";
import { initialRobots, initialSamples, RESERVOIR } from "@/components/app/mock-data";
import { useRealtimeSimulation } from "@/components/app/useRealtimeSimulation";
import { useEventLog } from "@/components/app/useEventLog";
import { useThresholds } from "@/components/app/thresholds";
import { usePersistentState } from "@/components/app/usePersistentState";
import { validRobots, validSamples } from "@/components/app/persisted-data";
import type { Robot, Sample } from "@/components/app/types";

export const Route = createFileRoute("/")({
  ssr: false,
  component: App,
  head: () => ({
    meta: [
      { title: "AquaWatch · SuBulaq — наблюдение за водой" },
      {
        name: "description",
        content: "Карта, флот USV, миссии, измерения и отчёты в рабочем пространстве SuBulaq.",
      },
    ],
  }),
});
const pages: Record<AppView, { title: string; subtitle: string }> = {
  overview: { title: "Наблюдение за водой", subtitle: "Единое пространство для вашего водоёма." },
  map: { title: "Карта миссии", subtitle: "Планируйте маршрут и исследуйте точки измерений." },
  devices: { title: "Ваш флот", subtitle: "Готовность аппаратов, телеметрия и управление." },
  missions: { title: "Миссии", subtitle: "От первой точки до возвращения на базу." },
  analytics: {
    title: "Измерения и отчёты",
    subtitle: "От отдельных показателей к полной картине.",
  },
  manual: {
    title: "Ручное управление",
    subtitle: "Проверьте сценарии управления в симуляторе FPV.",
  },
  journal: {
    title: "Журнал событий",
    subtitle: "История команд, уведомления и изменения состояния.",
  },
  service: { title: "Обслуживание", subtitle: "Учёт проб, замена мембран и калибровка датчиков." },
  settings: {
    title: "Настройки показателей",
    subtitle: "Задайте границы для оценки демонстрационных измерений.",
  },
  profile: { title: "Профиль", subtitle: "Ваши данные в рабочем пространстве SuBulaq." },
};
function App() {
  const [robots, setRobots, robotsReady] = usePersistentState<Robot[]>(
    "aquawatch.fleet.v2",
    initialRobots,
    validRobots,
  );
  const [samples, setSamples, samplesReady] = usePersistentState<Sample[]>(
    "aquawatch.samples.v2",
    initialSamples,
    validSamples,
  );
  const [view, setView] = useState<AppView>("overview");
  const [selectedId, setSelectedId] = useState(initialRobots[0].id);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [clock, setClock] = useState("");
  const [running, setRunning] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draftWaypoints, setDraftWaypoints] = useState<{ x: number; y: number }[]>([]);
  const [mapPeriod, setMapPeriod] = useState("all");
  const [mapDevice, setMapDevice] = useState("all");
  const [historyRobot, setHistoryRobot] = useState("all");
  const [particlesOpen, setParticlesOpen] = useState(false);
  const [readAt, setReadAt] = usePersistentState(
    "aquawatch.read-at.v1",
    0,
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const [storageFailed, setStorageFailed] = useState(false);
  const [service, setService] = useServiceState();
  const { thresholds, setThresholds, resetThresholds } = useThresholds();
  const { log, push: pushEvent } = useEventLog(robots, robotsReady);
  useRealtimeSimulation(setRobots, robotsReady && running && view !== "manual");
  const selected = robots.find((r) => r.id === selectedId) ?? robots[0];
  const onlineCount = robots.filter((r) => r.status !== "offline").length;
  const unread = log.filter((e) => e.ts > readAt).length;
  useEffect(() => {
    const sync = () => {
      const hash = location.hash.slice(1);
      if (hash in pages) setView(hash as AppView);
    };
    sync();
    window.addEventListener("hashchange", sync);
    const fail = () => setStorageFailed(true);
    window.addEventListener("aquawatch-storage-error", fail);
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("ru-RU", {
          timeZone: "Asia/Almaty",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 10000);
    return () => {
      clearInterval(id);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("aquawatch-storage-error", fail);
    };
  }, []);
  const navigate = (next: AppView) => {
    setView(next);
    location.hash = next;
    setEditMode(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const selectRobot = (robot: Robot) => {
    setDraftWaypoints([]);
    setMapDevice("all");
    setSelectedId(robot.id);
    setPanelOpen(true);
    setEditMode(false);
    navigate("map");
  };
  const updateRobot = (robot: Robot) =>
    setRobots((prev) => prev.map((r) => (r.id === robot.id ? robot : r)));
  const addSample = (robot: Robot) => {
    const membrane = service.membranes[robot.id] ?? { used: 0, replaced: "" };
    if (membrane.used >= 50) {
      toast.warning("Ресурс мембраны исчерпан", {
        description: "Отметьте замену в разделе обслуживания.",
      });
      return;
    }
    const source = samples.find((s) => s.robotId === robot.id) ?? initialSamples[0];
    const sample: Sample = {
      ...source,
      id: crypto.randomUUID(),
      robotId: robot.id,
      position: { ...robot.position },
      date: new Date().toISOString(),
    };
    setSamples((prev) => [sample, ...prev].slice(0, 1000));
    setService({
      ...service,
      membranes: { ...service.membranes, [robot.id]: { ...membrane, used: membrane.used + 1 } },
    });
    pushEvent(robot, "sample");
    toast.success("Демопроба добавлена", {
      description: "Она доступна на карте и в отчётах. Показатели скопированы из учебного набора.",
    });
  };
  const mapSamples = samples.filter((s) => {
    if (mapDevice !== "all" && s.robotId !== mapDevice) return false;
    if (mapPeriod === "all") return true;
    const since = new Date();
    if (mapPeriod === "today") since.setHours(0, 0, 0, 0);
    else since.setTime(Date.now() - 7 * 86400000);
    return new Date(s.date) >= since;
  });
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar
          view={view}
          onChange={navigate}
          onlineCount={onlineCount}
          totalCount={robots.length}
          rtlCount={robots.filter((r) => r.status === "rtl").length}
          sampleCount={samples.length}
          clock={clock}
        />
        <SidebarInset className="bg-transparent min-w-0">
          <header className="app-header">
            <div className="flex items-center gap-3">
              <SidebarTrigger aria-label="Открыть навигацию" />
              <span className="text-sm hidden sm:inline">
                AquaWatch <span className="text-muted-foreground mx-2">/</span> {pages[view].title}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-3.5" />
                {RESERVOIR.name}
              </span>
              <Button
                aria-label={"Уведомления: " + unread}
                variant="ghost"
                size="icon"
                onClick={() => {
                  setHistoryRobot("all");
                  navigate("journal");
                }}
                className="relative"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="notification-count">{unread > 99 ? "99+" : unread}</span>
                )}
              </Button>
              <ConnectDeviceDialog
                robots={robots}
                onAdd={(r) => setRobots((prev) => [...prev, r])}
              />
            </div>
          </header>
          <main className="app-content" id="main-content">
            <div className="page-intro">
              <div>
                <h1 className="app-page-title">{pages[view].title}</h1>
                <p className="app-subtitle">{pages[view].subtitle}</p>
              </div>
              <span className="page-date">{clock} · UTC+5</span>
            </div>
            <div className="app-demo-bar">
              <span>
                <span className="demo-dot" />
                Деморежим · учебные измерения и команды
              </span>
              <Button variant="ghost" size="sm" onClick={() => setRunning(!running)}>
                {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {running ? "Пауза симуляции" : "Продолжить симуляцию"}
              </Button>
            </div>
            {storageFailed && (
              <p role="alert" className="text-sm text-destructive mb-4">
                Браузер запретил сохранение. Изменения доступны до перезагрузки страницы.
              </p>
            )}
            {!robotsReady || !samplesReady ? (
              <div className="empty-state">Загружаем рабочее пространство…</div>
            ) : (
              <>
                {view === "overview" && (
                  <OverviewView
                    robots={robots}
                    samples={samples}
                    log={log}
                    onNavigate={navigate}
                    onSelect={selectRobot}
                    onInspectParticles={() => setParticlesOpen(true)}
                  />
                )}
                {view === "map" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 items-center">
                      <select
                        className="app-select"
                        aria-label="Период на карте"
                        value={mapPeriod}
                        onChange={(e) => setMapPeriod(e.target.value)}
                      >
                        <option value="all">Все измерения</option>
                        <option value="today">Сегодня</option>
                        <option value="week">За неделю</option>
                      </select>
                      <select
                        className="app-select"
                        aria-label="Аппарат на карте"
                        value={mapDevice}
                        onChange={(e) => {
                          setMapDevice(e.target.value);
                          setPanelOpen(false);
                          setEditMode(false);
                          setDraftWaypoints([]);
                          if (e.target.value !== "all") setSelectedId(e.target.value);
                        }}
                      >
                        <option value="all">Весь флот</option>
                        {robots.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">
                        {mapSamples.length} измерений · координаты условные
                      </span>
                      {!panelOpen && (
                        <Button variant="outline" onClick={() => setPanelOpen(true)}>
                          Планировать маршрут
                        </Button>
                      )}
                    </div>
                    <div className={"map-workspace " + (panelOpen && selected ? "has-panel" : "")}>
                      <div className="map-canvas">
                        <MapView
                          robots={
                            mapDevice === "all" ? robots : robots.filter((r) => r.id === mapDevice)
                          }
                          samples={mapSamples}
                          onSelectRobot={(r) => {
                            setSelectedId(r.id);
                            setPanelOpen(true);
                            setDraftWaypoints([]);
                            setEditMode(false);
                          }}
                          onSelectSample={setSelectedSample}
                          selectedRobotId={panelOpen ? selected?.id : undefined}
                          editMode={editMode && panelOpen}
                          editingRobotId={selected?.id}
                          draftWaypoints={draftWaypoints}
                          onMapClick={(x, y) => setDraftWaypoints((w) => [...w, { x, y }])}
                          highlightedSampleId={selectedSample?.id}
                        />
                      </div>
                      {panelOpen && selected && (
                        <RobotPanel
                          key={selected.id}
                          robot={selected}
                          onClose={() => {
                            setPanelOpen(false);
                            setEditMode(false);
                          }}
                          onUpdate={updateRobot}
                          editMode={editMode}
                          setEditMode={setEditMode}
                          draftWaypoints={draftWaypoints}
                          setDraftWaypoints={setDraftWaypoints}
                          logEvent={pushEvent}
                        />
                      )}
                    </div>
                    {panelOpen && selected && (
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" onClick={() => navigate("missions")}>
                          Миссия и точки маршрута
                        </Button>
                        <Button variant="outline" onClick={() => navigate("manual")}>
                          Ручное управление FPV
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setHistoryRobot(selected.id);
                            navigate("journal");
                          }}
                        >
                          История аппарата
                        </Button>
                        <Button
                          variant="outline"
                          disabled={selected.status === "offline"}
                          onClick={() => addSample(selected)}
                        >
                          Добавить демопробу
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {view === "devices" && (
                  <FleetView
                    robots={robots}
                    onSelect={selectRobot}
                    onHistory={(r) => {
                      setSelectedId(r.id);
                      setHistoryRobot(r.id);
                      navigate("journal");
                    }}
                    onManual={(r) => {
                      setSelectedId(r.id);
                      navigate("manual");
                    }}
                  />
                )}
                {view === "missions" && (
                  <MissionsView
                    robots={robots}
                    log={log}
                    selectedId={selectedId}
                    onPick={(id) => {
                      setSelectedId(id);
                      setDraftWaypoints([]);
                      setEditMode(false);
                    }}
                    onUpdate={updateRobot}
                    onMap={(r) => {
                      selectRobot(r);
                      setDraftWaypoints(r.waypoints.map((p) => ({ ...p })));
                      setEditMode(true);
                    }}
                  />
                )}
                {view === "analytics" && (
                  <AnalyticsView
                    robots={robots}
                    samples={samples}
                    thresholds={thresholds}
                    onSelectSample={setSelectedSample}
                    onInspectParticles={() => setParticlesOpen(true)}
                  />
                )}
                {view === "manual" && (
                  <ManualView
                    enabled={running}
                    robots={robots}
                    selectedId={selectedId}
                    onPick={(id) => {
                      setSelectedId(id);
                      setDraftWaypoints([]);
                      setEditMode(false);
                    }}
                    onUpdate={updateRobot}
                    onSample={addSample}
                    onEnter={(r) => pushEvent(r, "manual_start")}
                    onAuto={(r) => {
                      updateRobot({
                        ...r,
                        status: "mission",
                        waypointIdx: r.waypointIdx >= r.waypoints.length ? 0 : r.waypointIdx,
                      });
                      navigate("missions");
                    }}
                  />
                )}
                {view === "journal" && (
                  <EventLog
                    key={historyRobot}
                    robots={robots}
                    log={log}
                    initialRobot={historyRobot}
                    readAt={readAt}
                    onRead={() => setReadAt(Date.now())}
                  />
                )}
                {view === "service" && (
                  <ServiceView
                    robots={robots}
                    selectedId={selectedId}
                    onPick={(id) => {
                      setSelectedId(id);
                      setDraftWaypoints([]);
                      setEditMode(false);
                    }}
                    state={service}
                    onChange={setService}
                    onLog={(r, n) => pushEvent(r, "maintenance", n)}
                  />
                )}
                {view === "settings" && (
                  <SettingsView
                    thresholds={thresholds}
                    onChange={setThresholds}
                    onReset={resetThresholds}
                    samples={samples}
                  />
                )}
                {view === "profile" && <ProfileView />}
              </>
            )}
            <footer className="app-footer">
              <span>SuBulaq / Bulaq Robotics</span>
              <span>Наблюдать. Измерять. Понимать.</span>
            </footer>
          </main>
        </SidebarInset>
        <SampleDialog
          sample={selectedSample}
          onClose={() => setSelectedSample(null)}
          thresholds={thresholds}
        />
        <ParticleDialog open={particlesOpen} onClose={() => setParticlesOpen(false)} />
      </div>
    </SidebarProvider>
  );
}
