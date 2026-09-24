import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Cpu } from "lucide-react";
import { toast } from "sonner";
import type { Robot } from "./types";
import { ROBOT_COLORS } from "./mock-data";

export function ConnectDeviceDialog({
  onAdd,
  robots,
}: {
  onAdd: (r: Robot) => void;
  robots: Robot[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !model.trim() || !serial.trim()) return;
    if (robots.some((r) => r.serial.toLowerCase() === serial.trim().toLowerCase())) {
      toast.error("Аппарат с таким серийным номером уже добавлен");
      return;
    }
    onAdd({
      id: `r${Date.now()}`,
      name: name.trim(),
      model: model.trim(),
      serial: serial.trim(),
      status: "online",
      battery: 100,
      signal: 88,
      position: { x: 24, y: 60 },
      heading: 0,
      speed: 0,
      color: ROBOT_COLORS.cyan,
      samplesPerTrip: 10,
      waypoints: [
        { x: 30, y: 58 },
        { x: 45, y: 50 },
        { x: 60, y: 45 },
      ],
      waypointIdx: 1,
      trail: [],
      batteryHistory: Array.from({ length: 20 }, () => 100),
    });
    toast.success("Аппарат добавлен в демофлот", {
      description: `${name.trim()} сохранён в этом браузере`,
    });
    setOpen(false);
    setName("");
    setModel("");
    setSerial("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary font-semibold"
        >
          <Plus className="size-4" /> <span className="hidden sm:inline">Добавить аппарат</span>
          <span className="sm:hidden">Аппарат</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Cpu className="size-5 text-primary" /> Добавить аппарат
          </DialogTitle>
          <DialogDescription>
            Зарегистрируйте аппарат в демонстрационном флоте. Реальное подключение к оборудованию не
            выполняется.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Имя робота</Label>
            <Input
              id="name"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SuBulaq-04"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Модель</Label>
            <Input
              id="model"
              required
              maxLength={60}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="AB-X300"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serial">Серийный номер</Label>
            <Input
              id="serial"
              required
              maxLength={80}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="SN-0004-XX"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !model.trim() || !serial.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Добавить в демофлот
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
