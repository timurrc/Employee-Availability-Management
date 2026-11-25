export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  TEAM: "/team",
  VACATIONS: "/vacations",
  SICK_LEAVES: "/sick-leaves",
  CALENDAR: "/calendar",
  EMPLOYEE: "/employees/:id",
  DOCUMENTS: "/documents",
  DOCUMENT: "/documents/:id",
  DEADLINES: "/deadlines",
} as const;

/** Подставляет параметры в путь: buildPath(ROUTES.EMPLOYEE, { id: "e01" }) → "/employees/e01" */
export const buildPath = (path: string, params: Record<string, string | number>) =>
  Object.entries(params).reduce((acc, [key, value]) => acc.replace(`:${key}`, String(value)), path);

/** Путь с параметрами запроса, пустые пропускаются: withQuery(ROUTES.TEAM, { dept: "d-it" }) */
export const withQuery = (path: string, params: Record<string, string | undefined>) => {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  return search ? `${path}?${search}` : path;
};
