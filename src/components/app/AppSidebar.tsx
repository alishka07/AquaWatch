import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Cpu,
  Gamepad2,
  LayoutDashboard,
  Map as MapIcon,
  Radio,
  Route,
  Sliders,
  UserRound,
  Waves,
  Wrench,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

export type AppView =
  | "overview"
  | "map"
  | "devices"
  | "missions"
  | "analytics"
  | "manual"
  | "journal"
  | "service"
  | "settings"
  | "profile";

type Props = {
  view: AppView;
  onChange: (view: AppView) => void;
  onlineCount: number;
  totalCount: number;
  rtlCount: number;
  sampleCount: number;
  clock: string;
};

type NavItem = {
  id: AppView;
  title: string;
  icon: typeof MapIcon;
  badge?: (props: Props) => number;
};
const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Рабочее пространство",
    items: [
      { id: "overview", title: "Обзор", icon: LayoutDashboard },
      { id: "map", title: "Карта миссии", icon: MapIcon, badge: (props) => props.sampleCount },
      { id: "devices", title: "Флот", icon: Cpu, badge: (props) => props.totalCount },
      { id: "missions", title: "Миссии", icon: Route },
      { id: "analytics", title: "Измерения и отчёты", icon: BarChart3 },
    ],
  },
  {
    title: "Управление",
    items: [
      { id: "manual", title: "Ручное управление", icon: Gamepad2 },
      { id: "journal", title: "Журнал событий", icon: BookOpen },
      { id: "service", title: "Обслуживание", icon: Wrench },
      { id: "settings", title: "Настройки", icon: Sliders },
      { id: "profile", title: "Профиль", icon: UserRound },
    ],
  },
];

export function AppSidebar(props: Props) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const navigate = (view: AppView) => {
    props.onChange(view);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="app-sidebar">
      <SidebarHeader className="app-sidebar-header">
        <button
          className="app-brand"
          onClick={() => navigate("overview")}
          aria-label="SuBulaq — обзор"
        >
          {collapsed ? (
            <Waves className="size-5" />
          ) : (
            <>
              <span className="app-wordmark">SUBULAQ</span>
              <span className="app-brand-caption">
                Мониторинг воды <span>Платформа оператора</span>
              </span>
            </>
          )}
        </button>
        {!collapsed && (
          <div className="sidebar-location">
            <span className="sidebar-location-dot" />
            Капшагайское водохранилище
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="app-sidebar-content">
        <nav aria-label="Основная навигация" className="app-navigation">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed && <div className="app-nav-group-label">{group.title}</div>}
              <SidebarMenu className="app-nav-menu">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = props.view === item.id;
                  return (
                    <SidebarMenuItem
                      key={item.id}
                      className={`app-nav-block app-nav-block--${item.id}`}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="app-nav-item"
                      >
                        <button
                          type="button"
                          onClick={() => navigate(item.id)}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className="app-nav-icon" strokeWidth={1.5} />
                          {!collapsed && (
                            <>
                              <span className="app-nav-copy">{item.title}</span>
                              {item.badge ? (
                                <span className="app-nav-count">{item.badge(props)}</span>
                              ) : (
                                <ArrowUpRight className="app-nav-arrow" strokeWidth={1.4} />
                              )}
                            </>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="app-sidebar-footer">
        {collapsed ? (
          <div
            className="sidebar-compact-status"
            title={`${props.onlineCount} из ${props.totalCount} аппаратов в симуляции`}
          >
            <Radio className="size-4" />
            <span>{props.onlineCount}</span>
          </div>
        ) : (
          <>
            <div className="sidebar-status-heading">
              <span>
                <Radio className="size-3.5" />
                Демонстрационный режим
              </span>
              <span className="sidebar-status-dot" />
            </div>
            <div className="sidebar-status-row">
              <span>Аппараты в сети</span>
              <strong>
                {props.onlineCount}
                <span> / {props.totalCount}</span>
              </strong>
            </div>
            {props.rtlCount > 0 && (
              <div className="sidebar-status-row">
                <span>Возвращаются на базу</span>
                <strong>{props.rtlCount}</strong>
              </div>
            )}
            <div className="sidebar-status-time">
              <span>Местное время</span>
              <time suppressHydrationWarning>{props.clock}</time>
            </div>
            <p className="sidebar-demo-note">
              Учебные данные. Связь с реальными аппаратами не подключена.
            </p>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
