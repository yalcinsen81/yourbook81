import { describe, it, expect, beforeEach } from "vitest";
import { snoozeAgendaEvent } from "./alarm";

const KEY = "superr_agenda_events_v4";

describe("snoozeAgendaEvent", () => {
  beforeEach(() => localStorage.clear());

  it("alarmı ileri alır ve tetiklenme bayrağını sıfırlar", () => {
    localStorage.setItem(KEY, JSON.stringify([
      { id: "e1", title: "a", hasAlarm: true, alarmTimestamp: 1, isAlarmTriggered: true },
      { id: "e2", title: "b", hasAlarm: true, alarmTimestamp: 2, isAlarmTriggered: true },
    ]));
    expect(snoozeAgendaEvent("e1", 5, 1_000_000)).toBe(true);
    const ev = JSON.parse(localStorage.getItem(KEY)!);
    expect(ev[0]).toMatchObject({ alarmTimestamp: 1_000_000 + 300_000, isAlarmTriggered: false });
    expect(ev[1].alarmTimestamp).toBe(2);
  });

  it("bilinmeyen id veya boş depoda false döner", () => {
    expect(snoozeAgendaEvent("x", 5)).toBe(false);
    localStorage.setItem(KEY, "[]");
    expect(snoozeAgendaEvent("x", 5)).toBe(false);
  });
});
