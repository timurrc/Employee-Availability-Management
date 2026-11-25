import { delay, http, HttpResponse } from "msw";
import { ENV } from "@/constants/env";
import { MOCK_TOKEN } from "@/constants/mock";
import { buildCalendarYear } from "@/core/calendar";
import type { IAuthResponse, ILoginDto } from "@/types/auth.types";
import { db } from "./db";

/** Полный URL эндпоинта — тот же, что собирает axios из baseURL */
const url = (path: string) => `${ENV.API_URL}${path}`;

const notFound = (message = "Не найдено") => HttpResponse.json({ message }, { status: 404 });

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
