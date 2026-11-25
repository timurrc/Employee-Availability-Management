import { delay, http, HttpResponse } from "msw";
import { ENV } from "@/constants/env";
import { MOCK_TOKEN } from "@/constants/mock";
import { buildCalendarYear } from "@/core/calendar";
import { isPlannedAbsence } from "@/core/absence";
import { periodsOverlap } from "@/core/period";
import type {
  IAbsence,
  IAbsenceStatusDto,
  ICreateAbsenceDto,
  IUpdateAbsenceDto,
} from "@/types/absence.types";
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

const nextAbsenceId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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
    db.update((draft) => {
      draft.absences = draft.absences.map((item) => (item.id === updated.id ? updated : item));
    });
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
    db.update((draft) => {
      draft.absences = draft.absences.map((item) => (item.id === updated.id ? updated : item));
    });
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

  http.get(url("/documents"), async () => {
    await delay();
    return HttpResponse.json(db.get().documents);
  }),

  http.get(url("/documents/:id"), async ({ params }) => {
    await delay();
    const document = db.get().documents.find((item) => item.id === params.id);
    return document ? HttpResponse.json(document) : notFound("Документ не найден");
  }),
];
