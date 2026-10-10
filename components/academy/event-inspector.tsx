import { Activity, Braces, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Locale } from "@/lib/types";

export interface AcademyEventLog {
  id: string;
  type: string;
  detail: string;
  at: number;
}

export function EventInspector({ locale, events, status }: { locale: Locale; events: AcademyEventLog[]; status: string }) {
  const active = status === "submitted" || status === "streaming";
  return (
    <section className="event-inspector" aria-labelledby="event-inspector-title">
      <div className="event-inspector-head">
        <div><Radio className={active ? "event-live" : ""} /><span><strong id="event-inspector-title">AG-UI</strong><small>{locale === "zh" ? "实时事件" : "live events"}</small></span></div>
        <Badge variant="outline">{active ? "LIVE" : "IDLE"}</Badge>
      </div>
      <div className="event-legend"><span><Activity /> lifecycle</span><span><Braces /> payload</span></div>
      <ScrollArea className="event-scroll">
        <ol>
          {events.length === 0 ? <li className="event-empty">{locale === "zh" ? "发送消息后，协议事件会在这里出现。" : "Protocol events appear here after you send a message."}</li> : events.map((event, index) => (
            <li key={event.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{event.type}</strong><code>{event.detail}</code></div>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </section>
  );
}
