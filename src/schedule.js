/** @typedef {'hearing' | 'meeting' | 'task'} ScheduleKind */

export function toYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function parseYmd(ymd) {
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function isYmdInMonth(ymd, monthStart) {
  const d = parseYmd(ymd);
  return (
    d.getFullYear() === monthStart.getFullYear() &&
    d.getMonth() === monthStart.getMonth()
  );
}

export function createSampleClients() {
  return [
    {
      id: "c1",
      name: "R. Mehta",
      phone: "+91 98765 41020",
      caseName: "Mehta v. Kapoor",
      matter: "Civil - property dispute",
      lawyerSchedule: "Wednesdays, 11:00",
      address: "24 MG Road, Bengaluru, Karnataka",
      updated: "2d ago",
    },
    {
      id: "c2",
      name: "Studio North LLP",
      phone: "+91 99880 22441",
      caseName: "Studio North contract review",
      matter: "Contract review",
      lawyerSchedule: "Fridays, 15:30",
      address: "7 Residency Lane, Mumbai, Maharashtra",
      updated: "1w ago",
    },
    {
      id: "c3",
      name: "A. Khan",
      phone: "+91 91234 77880",
      caseName: "Khan family mediation",
      matter: "Family - mediation",
      lawyerSchedule: "Today, 16:00",
      address: "18 Civil Lines, Delhi",
      updated: "Today",
    },
  ];
}

export function createSampleSchedule(clients = createSampleClients()) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n) => String(n).padStart(2, "0");
  const localYmd = (day) => `${y}-${pad(m + 1)}-${pad(day)}`;
  const today = now.getDate();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const clampDay = (d) => Math.min(Math.max(d, 1), lastDay);
  const byId = Object.fromEntries(clients.map((client) => [client.id, client]));

  const withClient = (event, clientId) => {
    const client = byId[clientId];
    return {
      ...event,
      clientId,
      clientName: client?.name || "",
      clientPhone: client?.phone || "",
      caseName: client?.caseName || "",
    };
  };

  return [
    withClient(
      {
        id: 1,
        date: localYmd(today),
        time: "10:30",
        title: "Client hearing",
        note: "High Court - Case 124",
        kind: "hearing",
        important: true,
        completed: false,
      },
      "c1"
    ),
    withClient(
      {
        id: 2,
        date: localYmd(today),
        time: "14:00",
        title: "Draft agreement",
        note: "",
        kind: "task",
        important: false,
        completed: false,
      },
      "c2"
    ),
    withClient(
      {
        id: 3,
        date: localYmd(clampDay(today + 2)),
        time: "09:15",
        title: "Case status conference",
        note: "Courtroom 3",
        kind: "meeting",
        important: false,
        completed: false,
      },
      "c3"
    ),
    withClient(
      {
        id: 4,
        date: localYmd(clampDay(5)),
        time: "11:00",
        title: "Motion hearing",
        note: "District Court",
        kind: "hearing",
        important: true,
        completed: false,
      },
      "c1"
    ),
    withClient(
      {
        id: 5,
        date: localYmd(clampDay(12)),
        time: "15:30",
        title: "Client intake",
        note: "Video call",
        kind: "meeting",
        important: false,
        completed: false,
      },
      "c2"
    ),
    withClient(
      {
        id: 6,
        date: localYmd(clampDay(18)),
        time: "10:00",
        title: "Final arguments",
        note: "District Court",
        kind: "hearing",
        important: true,
        completed: false,
      },
      "c3"
    ),
    withClient(
      {
        id: 7,
        date: localYmd(clampDay(25)),
        time: "13:00",
        title: "ADR / mediation",
        note: "",
        kind: "meeting",
        important: false,
        completed: false,
      },
      "c3"
    ),
  ];
}
