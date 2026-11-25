import { delay, http, HttpResponse } from "msw";
import { ENV } from "@/constants/env";
import { MOCK_TOKEN } from "@/constants/mock";
import { buildCalendarYear, setCalendarDay, shiftISODate } from "@/core/calendar";
import { isPlannedAbsence } from "@/core/absence";
import { deputyCycle } from "@/core/availability";
import { periodsOverlap } from "@/core/period";
import { calendarSourceSchema } from "@/schemas/calendar.schema";
import type {
  IAbsence,
  IAbsenceStatusDto,
  ICloseSickLeaveDto,
  ICreateAbsenceDto,
  ICreateDelegationDto,
  IDelegation,
  IExtendSickLeaveDto,
  IExtendVacationDto,
  IOpenSickLeaveDto,
  IUpdateAbsenceDto,
} from "@/types/absence.types";
import type { ICalendarYearSource, ISetCalendarDayDto } from "@/types/calendar.types";
import type {
  ICreateDocumentDto,
  IDecisionDto,
  IDocument,
  IRouteDto,
  IStepPatchDto,
} from "@/types/document.types";
import type { IAuthResponse, ILoginDto } from "@/types/auth.types";
import { todayISO } from "@/utils/date";
import { db } from "./db";

/** Полный URL эндпоинта — тот же, что собирает axios из baseURL */
const url = (path: string) => `${ENV.API_URL}${path}`;

const notFound = (message = "Не найдено") => HttpResponse.json({ message }, { status: 404 });

const unprocessable = (message: string, errors?: Record<string, string[]>) =>
  HttpResponse.json({ message, errors }, { status: 422 });

/** Допустимые переходы статуса заявки. approved → pending — «Отменить» в тосте после согласования */
const TRANSITIONS: Record<string, IAbsenceStatusDto["status"][]> = {
  draft: ["pending", "cancelled"],
  pending: ["approved", "rejected", "cancelled"],
  approved: ["pending", "cancelled"],
  rejected: ["pending"],
};

/** Проверка периода заявки, как на сервере: порядок дат и пересечение со своими отсутствиями */
const periodError = (employeeId: string, period: { start: string; end: string }, id?: string) => {
  if (period.end < period.start) return "Дата окончания раньше даты начала";
  const clash = db
    .get()
    .absences.find(
      (a) =>
        a.employeeId === employeeId &&
        a.id !== id &&
        isPlannedAbsence(a) &&
        periodsOverlap(a.period, period),
    );
  return clash ? "Пересекается с другим вашим отсутствием" : null;
};

const nextId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nextAbsenceId = () => nextId("a");

const ELN = /^\d{12}$/;

const saveAbsence = (updated: IAbsence) =>
  db.update((draft) => {
    draft.absences = draft.absences.map((item) => (item.id === updated.id ? updated : item));
  });

const findSick = (id: unknown) =>
  db.get().absences.find((item) => item.id === id && item.type === "sick");

const nameOf = (id: string) => db.get().employees.find((e) => e.id === id)?.fullName ?? id;

const formatRu = (date: string) => date.split("-").reverse().join(".");

const DOCUMENT_PREFIX: Record<IDocument["type"], string> = {
  contract: "Д",
  order: "П",
  memo: "СЗ",
  invoice: "С",
};

const findDocument = (id: unknown) => db.get().documents.find((d) => d.id === id);

const saveDocument = (updated: IDocument) =>
  db.update((draft) => {
    draft.documents = draft.documents.map((d) => (d.id === updated.id ? updated : d));
  });

const isClosedStep = (status: string) => status === "approved" || status === "rejected";

/** Периоды пересекаются, если начало одного не позже конца другого (end = null — бессрочно) */
const overlaps = (start: string, end: string | null, from: string | null, to: string | null) =>
  (!to || start <= to) && (!from || end === null || end >= from);

/**
 * Мок-API. Одни и те же хендлеры работают в браузере (VITE_USE_MOCK=true)
 * и в Vitest (src/mocks/server.ts). Новый эндпоинт в services → хендлер здесь.
 */
export const handlers = [
  http.post(url("/auth/login"), async ({ request }) => {
    await delay();
    const { employeeId } = (await request.json()) as ILoginDto;
    const employee = db.get().employees.find((item) => item.id === employeeId);

    if (!employee) {
      return HttpResponse.json(
        { message: "Учётная запись не найдена", errors: { employeeId: ["Выберите сотрудника"] } },
        { status: 422 },
      );
    }

    return HttpResponse.json<IAuthResponse>({
      accessToken: MOCK_TOKEN,
      user: {
        id: employee.id,
        name: employee.fullName,
        position: employee.position,
        role: employee.role,
      },
    });
  }),

  http.post(url("/auth/refresh"), () => HttpResponse.json({ accessToken: MOCK_TOKEN })),

  http.post(url("/demo/reset"), async () => {
    await delay();
    db.reset();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url("/departments"), async () => {
    await delay();
    return HttpResponse.json(db.get().departments);
  }),

  http.get(url("/employees"), async () => {
    await delay();
    return HttpResponse.json(db.get().employees);
  }),

  http.get(url("/employees/:id"), async ({ params }) => {
    await delay();
    const employee = db.get().employees.find((item) => item.id === params.id);
    return employee ? HttpResponse.json(employee) : notFound("Сотрудник не найден");
  }),

  http.patch(url("/employees/:id/deputy"), async ({ params, request }) => {
    await delay();
    const { deputyId } = (await request.json()) as { deputyId: string | null };
    const { employees } = db.get();
    const employee = employees.find((item) => item.id === params.id);
    if (!employee) return notFound("Сотрудник не найден");
    if (deputyId) {
      if (!employees.some((item) => item.id === deputyId)) {
        return unprocessable("Заместитель не найден", { deputyId: ["Выберите сотрудника"] });
      }
      const cycle = deputyCycle(employees, employee.id, deputyId);
      if (cycle) {
        const message = `Создаст цикл: ${cycle.map(nameOf).join(" → ")}`;
        return unprocessable(message, { deputyId: [message] });
      }
    }
    const updated = { ...employee, deputyId };
    db.update((draft) => {
      draft.employees = draft.employees.map((item) => (item.id === updated.id ? updated : item));
    });
    return HttpResponse.json(updated);
  }),

  http.get(url("/delegations"), async () => {
    await delay();
    return HttpResponse.json(db.get().delegations);
  }),

  http.post(url("/delegations"), async ({ request }) => {
    await delay();
    const dto = (await request.json()) as ICreateDelegationDto;
    if (dto.fromId === dto.toId) {
      return unprocessable("Нельзя замещать самого себя", { toId: ["Выберите другого"] });
    }
    if (dto.period.end < dto.period.start) {
      return unprocessable("Дата окончания раньше даты начала", { period: ["Проверьте даты"] });
    }
    const clash = db
      .get()
      .delegations.find((d) => d.fromId === dto.fromId && periodsOverlap(d.period, dto.period));
    if (clash) {
      const message = `На эти даты уже назначено замещение (${formatRu(clash.period.start)} – ${formatRu(clash.period.end ?? clash.period.start)})`;
      return unprocessable(message, { period: [message] });
    }
    const delegation: IDelegation = { ...dto, id: nextId("g"), reason: "manual" };
    db.update((draft) => {
      draft.delegations.push(delegation);
    });
    return HttpResponse.json(delegation, { status: 201 });
  }),

  http.delete(url("/delegations/:id"), async ({ params }) => {
    await delay();
    if (!db.get().delegations.some((d) => d.id === params.id)) {
      return notFound("Замещение не найдено");
    }
    db.update((draft) => {
      draft.delegations = draft.delegations.filter((d) => d.id !== params.id);
    });
    return new HttpResponse(null, { status: 204 });
  }),

  // Больничный регистрирует HR — без согласования
  http.post(url("/sick-leaves"), async ({ request }) => {
    await delay();
    const dto = (await request.json()) as IOpenSickLeaveDto;
    if (!ELN.test(dto.elnNumber)) {
      return unprocessable("Номер ЭЛН — 12 цифр", { elnNumber: ["Номер ЭЛН — 12 цифр"] });
    }
    if (dto.end !== null && dto.end < dto.start) {
      return unprocessable("Окончание раньше начала", { end: ["Окончание раньше начала"] });
    }
    const period = { start: dto.start, end: dto.end };
    const clash = db
      .get()
      .absences.find(
        (a) =>
          a.employeeId === dto.employeeId &&
          a.type === "sick" &&
          a.status !== "closed" &&
          periodsOverlap(a.period, period),
      );
    if (clash) {
      const message = `Уже открыт больничный с ${formatRu(clash.period.start)} — продлите его`;
      return unprocessable(message, { start: [message] });
    }
    const absence: IAbsence = {
      id: nextAbsenceId(),
      employeeId: dto.employeeId,
      type: "sick",
      period,
      status: "open",
      deputyId: null,
      elnNumber: dto.elnNumber,
      elnHistory: [{ number: dto.elnNumber, start: dto.start, end: dto.end }],
      createdAt: todayISO(),
    };
    db.update((draft) => {
      draft.absences.push(absence);
    });
    return HttpResponse.json(absence, { status: 201 });
  }),

  // Продление: новая ожидаемая дата (или «неизвестна») и, если выдан, новый ЭЛН
  http.patch(url("/sick-leaves/:id/extend"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as IExtendSickLeaveDto;
    const current = findSick(params.id);
    if (!current) return notFound("Больничный не найден");
    if (current.status === "closed") return unprocessable("Больничный уже закрыт");
    if (dto.end !== null && dto.end < current.period.start) {
      return unprocessable("Окончание раньше начала", { end: ["Окончание раньше начала"] });
    }
    if (dto.elnNumber && !ELN.test(dto.elnNumber)) {
      return unprocessable("Номер ЭЛН — 12 цифр", { elnNumber: ["Номер ЭЛН — 12 цифр"] });
    }

    const history = [...(current.elnHistory ?? [])];
    if (dto.elnNumber && dto.elnNumber !== current.elnNumber) {
      // Новый лист начинается на следующий день после прежней даты (или сегодня, если её не было)
      const start = current.period.end ? shiftISODate(current.period.end, 1) : todayISO();
      const last = history.at(-1);
      if (last) history[history.length - 1] = { ...last, end: last.end ?? shiftISODate(start, -1) };
      history.push({ number: dto.elnNumber, start, end: dto.end });
    } else if (history.length > 0) {
      history[history.length - 1] = { ...history.at(-1)!, end: dto.end };
    }

    const updated: IAbsence = {
      ...current,
      status: "extended",
      period: { ...current.period, end: dto.end },
      elnNumber: dto.elnNumber || current.elnNumber,
      elnHistory: history,
    };
    saveAbsence(updated);
    return HttpResponse.json(updated);
  }),

  http.patch(url("/sick-leaves/:id/close"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as ICloseSickLeaveDto;
    const current = findSick(params.id);
    if (!current) return notFound("Больничный не найден");
    if (current.status === "closed") return unprocessable("Больничный уже закрыт");
    if (dto.end < current.period.start) {
      return unprocessable("Дата окончания раньше начала", { end: ["Не раньше начала"] });
    }
    const history = [...(current.elnHistory ?? [])];
    if (history.length > 0) history[history.length - 1] = { ...history.at(-1)!, end: dto.end };
    const updated: IAbsence = {
      ...current,
      status: "closed",
      period: { ...current.period, end: dto.end },
      elnHistory: history,
    };
    saveAbsence(updated);
    return HttpResponse.json(updated);
  }),

  // Продлить отпуск на дни больничного (ст. 124) или вернуть прежнюю дату (sickLeaveId: null)
  http.patch(url("/absences/:id/extend"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as IExtendVacationDto;
    const current = db.get().absences.find((item) => item.id === params.id);
    if (!current) return notFound("Отпуск не найден");
    if (current.type !== "vacation" || current.status !== "approved" || !current.period.end) {
      return unprocessable("Продлить можно только согласованный отпуск");
    }
    if (dto.end < current.period.start) return unprocessable("Окончание раньше начала");
    const updated: IAbsence = {
      ...current,
      period: { ...current.period, end: dto.end },
      extension: dto.sickLeaveId
        ? {
            sickLeaveId: dto.sickLeaveId,
            previousEnd: current.extension?.previousEnd ?? current.period.end,
            days: dto.days,
          }
        : undefined,
    };
    saveAbsence(updated);
    return HttpResponse.json(updated);
  }),

  // ?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=e01 — все параметры необязательны
  http.get(url("/absences"), async ({ request }) => {
    await delay();
    const params = new URL(request.url).searchParams;
    const from = params.get("from");
    const to = params.get("to");
    const employeeId = params.get("employeeId");

    const items = db
      .get()
      .absences.filter(
        (item) =>
          (!employeeId || item.employeeId === employeeId) &&
          overlaps(item.period.start, item.period.end, from, to),
      );
    return HttpResponse.json(items);
  }),

  http.post(url("/absences"), async ({ request }) => {
    await delay();
    const dto = (await request.json()) as ICreateAbsenceDto;
    const error = periodError(dto.employeeId, dto.period);
    if (error) return unprocessable(error, { period: [error] });

    const absence: IAbsence = {
      id: nextAbsenceId(),
      employeeId: dto.employeeId,
      type: dto.type,
      period: dto.period,
      status: dto.status,
      deputyId: dto.deputyId,
      comment: dto.comment || undefined,
      createdAt: todayISO(),
    };
    db.update((draft) => {
      draft.absences.push(absence);
    });
    return HttpResponse.json(absence, { status: 201 });
  }),

  // Изменить можно только черновик (или отправить его — status: "pending")
  http.patch(url("/absences/:id"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as IUpdateAbsenceDto;
    const current = db.get().absences.find((item) => item.id === params.id);
    if (!current) return notFound("Заявка не найдена");
    if (current.status !== "draft") return unprocessable("Изменить можно только черновик");
    const error = periodError(current.employeeId, dto.period, current.id);
    if (error) return unprocessable(error, { period: [error] });

    const updated: IAbsence = {
      ...current,
      type: dto.type,
      period: dto.period,
      status: dto.status,
      deputyId: dto.deputyId,
      comment: dto.comment || undefined,
    };
    saveAbsence(updated);
    return HttpResponse.json(updated);
  }),

  http.patch(url("/absences/:id/status"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as IAbsenceStatusDto;
    const current = db.get().absences.find((item) => item.id === params.id);
    if (!current) return notFound("Заявка не найдена");
    if (!TRANSITIONS[current.status]?.includes(dto.status)) {
      return unprocessable("Заявка уже в другом статусе — обновите страницу");
    }
    if (dto.status === "rejected" && !dto.reason?.trim()) {
      return unprocessable("Укажите причину отказа", { reason: ["Укажите причину"] });
    }

    const isDecision = dto.status === "approved" || dto.status === "rejected";
    const updated: IAbsence = {
      ...current,
      status: dto.status,
      decision: isDecision
        ? { byId: dto.byId, at: todayISO(), reason: dto.reason?.trim() || undefined }
        : undefined,
    };
    saveAbsence(updated);
    return HttpResponse.json(updated);
  }),

  http.delete(url("/absences/:id"), async ({ params }) => {
    await delay();
    const current = db.get().absences.find((item) => item.id === params.id);
    if (!current) return notFound("Заявка не найдена");
    if (current.status !== "draft") return unprocessable("Удалить можно только черновик");
    db.update((draft) => {
      draft.absences = draft.absences.filter((item) => item.id !== current.id);
    });
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url("/calendar/:year"), async ({ params }) => {
    await delay();
    const source = db.get().calendars.find((item) => item.year === Number(params.year));
    return source
      ? HttpResponse.json(buildCalendarYear(source))
      : notFound(`Производственный календарь на ${String(params.year)} год не загружен`);
  }),

  // Правка дня администратором: возвращает пересобранный год
  http.put(url("/calendar/:year/days/:date"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as ISetCalendarDayDto;
    const year = Number(params.year);
    const date = String(params.date);
    const source = db.get().calendars.find((item) => item.year === year);
    if (!source) return notFound(`Производственный календарь на ${year} год не загружен`);
    if (!date.startsWith(`${year}-`)) return unprocessable(`Дата ${date} не из ${year} года`);
    const updated = setCalendarDay(source, date, dto);
    db.update((draft) => {
      draft.calendars = draft.calendars.map((item) => (item.year === year ? updated : item));
    });
    return HttpResponse.json(buildCalendarYear(updated));
  }),

  // Импорт года целиком (новый или замена)
  http.put(url("/calendar/:year"), async ({ params, request }) => {
    await delay();
    const parsed = calendarSourceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return unprocessable(parsed.error.issues[0]?.message ?? "Файл не похож на календарь");
    }
    const source: ICalendarYearSource = parsed.data;
    if (source.year !== Number(params.year)) return unprocessable("Год в файле не совпадает");
    db.update((draft) => {
      draft.calendars = [...draft.calendars.filter((c) => c.year !== source.year), source].sort(
        (a, b) => a.year - b.year,
      );
    });
    return HttpResponse.json(buildCalendarYear(source));
  }),

  http.get(url("/documents"), async () => {
    await delay();
    return HttpResponse.json(db.get().documents);
  }),

  http.post(url("/documents"), async ({ request }) => {
    await delay();
    const dto = (await request.json()) as ICreateDocumentDto;
    if (!dto.title?.trim())
      return unprocessable("Укажите название", { title: ["Укажите название"] });
    const today = todayISO();
    const sameType = db.get().documents.filter((d) => d.type === dto.type).length;
    const document: IDocument = {
      id: nextId("doc"),
      number: `${DOCUMENT_PREFIX[dto.type]}-${today.slice(0, 4)}/${String(300 + sameType).padStart(3, "0")}`,
      title: dto.title.trim(),
      type: dto.type,
      authorId: dto.authorId,
      createdAt: today,
      routeStartedAt: null,
      steps: [],
    };
    db.update((draft) => {
      draft.documents.unshift(document);
    });
    return HttpResponse.json(document, { status: 201 });
  }),

  // Маршрут меняется только у черновика
  http.put(url("/documents/:id/route"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as IRouteDto;
    const current = findDocument(params.id);
    if (!current) return notFound("Документ не найден");
    if (current.routeStartedAt) return unprocessable("Маршрут уже запущен — изменить нельзя");
    if (dto.steps.some((s) => !Number.isInteger(s.durationDays) || s.durationDays < 1)) {
      return unprocessable("Срок этапа — целое число рабочих дней от 1");
    }
    const updated: IDocument = {
      ...current,
      steps: dto.steps.map((step) => ({
        id: step.id ?? nextId("s"),
        approverId: step.approverId,
        durationDays: step.durationDays,
        status: "waiting",
        delegatedToId: step.delegatedToId || undefined,
        waitForReturn: step.waitForReturn || undefined,
      })),
    };
    saveDocument(updated);
    return HttpResponse.json(updated);
  }),

  http.post(url("/documents/:id/send"), async ({ params, request }) => {
    await delay();
    const { start } = (await request.json()) as { start: string };
    const current = findDocument(params.id);
    if (!current) return notFound("Документ не найден");
    if (current.routeStartedAt) return unprocessable("Документ уже отправлен");
    if (current.steps.length === 0) return unprocessable("Добавьте согласующих");
    const updated: IDocument = {
      ...current,
      routeStartedAt: start,
      steps: current.steps.map((s, i) => ({ ...s, status: i === 0 ? "in_progress" : "waiting" })),
    };
    saveDocument(updated);
    return HttpResponse.json(updated);
  }),

  // Передать заместителю / вернуть / «Оставить и ждать выхода»
  http.patch(url("/documents/:id/steps/:stepId"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as IStepPatchDto;
    const current = findDocument(params.id);
    const step = current?.steps.find((s) => s.id === params.stepId);
    if (!current || !step) return notFound("Этап не найден");
    if (isClosedStep(step.status)) return unprocessable("Этап уже завершён");
    if (dto.delegatedToId && dto.delegatedToId === step.approverId) {
      return unprocessable("Этап и так на этом согласующем");
    }
    const delegated = "delegatedToId" in dto;
    const updated: IDocument = {
      ...current,
      steps: current.steps.map((s) =>
        s.id === step.id
          ? {
              ...s,
              delegatedToId: delegated ? (dto.delegatedToId ?? undefined) : s.delegatedToId,
              // Передали заместителю — ждать уже некого
              waitForReturn:
                delegated && dto.delegatedToId ? false : (dto.waitForReturn ?? s.waitForReturn),
            }
          : s,
      ),
    };
    saveDocument(updated);
    return HttpResponse.json(updated);
  }),

  http.post(url("/documents/:id/decision"), async ({ params, request }) => {
    await delay();
    const dto = (await request.json()) as IDecisionDto;
    const current = findDocument(params.id);
    if (!current) return notFound("Документ не найден");
    const index = current.steps.findIndex((s) => s.status === "in_progress");
    const step = current.steps[index];
    if (!step) return unprocessable("Документ не ждёт решения");
    if ((step.delegatedToId ?? step.approverId) !== dto.byId) {
      return HttpResponse.json({ message: "Сейчас решение не за вами" }, { status: 403 });
    }
    if (dto.decision === "rejected" && !dto.reason?.trim()) {
      return unprocessable("Укажите причину отказа", { reason: ["Укажите причину"] });
    }
    const today = todayISO();
    const updated: IDocument = {
      ...current,
      steps: current.steps.map((s, i) => {
        if (i === index) {
          return {
            ...s,
            status: dto.decision,
            decidedAt: today,
            comment: dto.decision === "rejected" ? dto.reason?.trim() : undefined,
          };
        }
        if (i === index + 1 && dto.decision === "approved") return { ...s, status: "in_progress" };
        return s;
      }),
    };
    saveDocument(updated);
    return HttpResponse.json(updated);
  }),

  http.get(url("/documents/:id"), async ({ params }) => {
    await delay();
    const document = db.get().documents.find((item) => item.id === params.id);
    return document ? HttpResponse.json(document) : notFound("Документ не найден");
  }),
];
