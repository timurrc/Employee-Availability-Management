import { addDays } from "date-fns";
import { toISODate } from "@/core/calendar";
import type { IAbsence, IDelegation } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import type { IDocument } from "@/types/document.types";
import type { IDepartment, IEmployee, Role } from "@/types/employee.types";

/**
 * Мок-данные. Отдаются MSW-хендлерами (src/mocks/handlers.ts) через in-memory базу (src/mocks/db.ts).
 * Даты отсутствий и документов считаются от сегодняшнего дня, чтобы демо всегда было «живым».
 * Тесты на логику дат используют фиксированные даты, а не эти данные.
 */
const fromToday = (days: number): ISODate => toISODate(addDays(new Date(), days));

export const MOCK_TOKEN = "mock-access-token";

export const MOCK_DEPARTMENTS: IDepartment[] = [
  { id: "d-dir", name: "Дирекция", headId: "e01", coverageThreshold: 50 },
  { id: "d-legal", name: "Юридический отдел", headId: "e04", coverageThreshold: 60 },
  { id: "d-acc", name: "Бухгалтерия", headId: "e09", coverageThreshold: 60 },
  { id: "d-hr", name: "Отдел кадров", headId: "e15", coverageThreshold: 50 },
  { id: "d-it", name: "ИТ-отдел", headId: "e19", coverageThreshold: 60 },
  { id: "d-sales", name: "Отдел продаж", headId: "e27", coverageThreshold: 50 },
];

type EmployeeRow = [
  id: string,
  fullName: string,
  position: string,
  departmentId: string,
  deputyId: string | null,
  role: Role,
];

// Руководитель сотрудника — глава его подразделения; главы подчиняются генеральному директору
const EMPLOYEE_ROWS: EmployeeRow[] = [
  ["e01", "Соколов Андрей Викторович", "Генеральный директор", "d-dir", "e02", "manager"],
  [
    "e02",
    "Белова Ирина Сергеевна",
    "Заместитель генерального директора",
    "d-dir",
    "e01",
    "manager",
  ],
  ["e03", "Ковалёва Дарья Андреевна", "Помощник руководителя", "d-dir", null, "employee"],
  ["e04", "Громов Павел Олегович", "Начальник юридического отдела", "d-legal", "e05", "manager"],
  ["e05", "Никитина Ольга Игоревна", "Ведущий юрисконсульт", "d-legal", "e06", "employee"],
  ["e06", "Фёдоров Максим Ильич", "Юрисконсульт", "d-legal", "e07", "employee"],
  ["e07", "Зайцева Анна Павловна", "Юрисконсульт", "d-legal", "e06", "employee"],
  ["e08", "Орлов Кирилл Денисович", "Помощник юриста", "d-legal", null, "employee"],
  ["e09", "Морозова Елена Николаевна", "Главный бухгалтер", "d-acc", "e10", "manager"],
  [
    "e10",
    "Лебедева Татьяна Юрьевна",
    "Заместитель главного бухгалтера",
    "d-acc",
    "e09",
    "employee",
  ],
  ["e11", "Васильев Игорь Петрович", "Бухгалтер", "d-acc", "e12", "employee"],
  ["e12", "Егорова Светлана Михайловна", "Бухгалтер", "d-acc", "e11", "employee"],
  [
    "e13",
    "Козлова Наталья Викторовна",
    "Бухгалтер по расчёту зарплаты",
    "d-acc",
    "e11",
    "employee",
  ],
  ["e14", "Тарасов Денис Алексеевич", "Экономист", "d-acc", null, "employee"],
  ["e15", "Смирнова Марина Владимировна", "Начальник отдела кадров", "d-hr", "e16", "hr"],
  ["e16", "Попова Екатерина Олеговна", "Специалист по кадрам", "d-hr", "e17", "hr"],
  ["e17", "Волков Артём Сергеевич", "Специалист по кадрам", "d-hr", "e16", "hr"],
  ["e18", "Алексеева Юлия Андреевна", "Рекрутер", "d-hr", null, "employee"],
  ["e19", "Кузнецов Дмитрий Александрович", "Руководитель ИТ-отдела", "d-it", "e20", "manager"],
  ["e20", "Новиков Сергей Владимирович", "Ведущий разработчик", "d-it", "e22", "employee"],
  ["e21", "Абрамов Тимофей Романович", "Frontend-разработчик", "d-it", "e22", "employee"],
  ["e22", "Мельников Роман Игоревич", "Backend-разработчик", "d-it", "e20", "employee"],
  ["e23", "Григорьева Валерия Дмитриевна", "Системный аналитик", "d-it", "e24", "employee"],
  ["e24", "Павлов Никита Евгеньевич", "Инженер по тестированию", "d-it", "e23", "employee"],
  ["e25", "Семёнов Алексей Николаевич", "Системный администратор", "d-it", "e20", "admin"],
  ["e26", "Романова Полина Сергеевна", "Дизайнер интерфейсов", "d-it", null, "employee"],
  ["e27", "Захаров Виктор Геннадьевич", "Руководитель отдела продаж", "d-sales", "e28", "manager"],
  [
    "e28",
    "Фролова Алина Константиновна",
    "Старший менеджер по продажам",
    "d-sales",
    "e29",
    "employee",
  ],
  ["e29", "Кириллов Глеб Андреевич", "Менеджер по продажам", "d-sales", "e30", "employee"],
  ["e30", "Степанова Ксения Ильинична", "Менеджер по продажам", "d-sales", "e29", "employee"],
];

/**
 * Дата приёма и остаток отпуска прошлых лет. Дата приёма фиксирована (не «от сегодня»):
 * рабочий год и начисление считаются от неё. Кого нет в списке — принят 01.02.2021, остатка нет.
 */
const HIRING: Record<string, [hireDate: ISODate, carryover: number]> = {
  e01: ["2015-04-01", 0],
  e04: ["2018-09-03", 6],
  e19: ["2019-06-17", 4],
  e20: ["2020-02-10", 3],
  e21: ["2023-03-13", 20],
  e22: ["2022-08-01", 0],
  e23: ["2024-01-15", 2],
  e24: ["2021-10-04", 7],
  e26: ["2025-09-01", 0],
};

export const MOCK_EMPLOYEES: IEmployee[] = EMPLOYEE_ROWS.map(
  ([id, fullName, position, departmentId, deputyId, role]) => {
    const [hireDate, vacationCarryover] = HIRING[id] ?? ["2021-02-01", 0];
    const headId = MOCK_DEPARTMENTS.find((d) => d.id === departmentId)!.headId;
    return {
      id,
      fullName,
      position,
      departmentId,
      managerId: id === "e01" ? null : headId === id ? "e01" : headId,
      deputyId,
      role,
      hoursPerDay: 8,
      email: `${id}@company.example`,
      hireDate,
      vacationCarryover,
    };
  },
);

/** Учётные записи для демо-входа — по одной на роль */
export const DEMO_ACCOUNTS: { employeeId: string; role: Role; label: string; hint: string }[] = [
  {
    employeeId: "e21",
    role: "employee",
    label: "Сотрудник",
    hint: "Свои отпуска, статус коллег, документы на согласовании",
  },
  {
    employeeId: "e19",
    role: "manager",
    label: "Руководитель",
    hint: "Календарь отдела, согласование отпусков, покрытие",
  },
  {
    employeeId: "e16",
    role: "hr",
    label: "Кадровик",
    hint: "Больничные, отпуска всей организации, замещения",
  },
  {
    employeeId: "e25",
    role: "admin",
    label: "Администратор",
    hint: "Производственный календарь и справочники",
  },
];

const absence = (
  id: string,
  employeeId: string,
  type: IAbsence["type"],
  start: number,
  end: number | null,
  status: IAbsence["status"],
  extra: Partial<IAbsence> = {},
): IAbsence => ({
  id,
  employeeId,
  type,
  period: { start: fromToday(start), end: end === null ? null : fromToday(end) },
  status,
  deputyId: null,
  createdAt: fromToday(Math.min(start, 0) - 14),
  ...extra,
});

export const MOCK_ABSENCES: IAbsence[] = [
  // Сейчас нет на месте
  absence("a01", "e04", "vacation", 0, 13, "approved", { deputyId: "e05" }),
  absence("a02", "e06", "vacation", -3, 10, "approved"),
  absence("a03", "e12", "sick", -2, null, "open", {
    elnNumber: "910123456789",
    elnHistory: [{ number: "910123456789", start: fromToday(-2), end: null }],
  }),
  absence("a04", "e22", "trip", -1, 2, "approved", { comment: "Конференция, Казань" }),
  absence("a05", "e20", "dayoff", 0, 0, "approved"),
  absence("a06", "e30", "sick", -6, 1, "extended", {
    elnNumber: "910987654322",
    elnHistory: [
      { number: "910987654321", start: fromToday(-6), end: fromToday(-2) },
      { number: "910987654322", start: fromToday(-1), end: fromToday(1) },
    ],
  }),
  // Больничный пришёлся на согласованный отпуск — HR решает по ст. 124
  absence("a21", "e30", "vacation", -1, 12, "approved", {
    decision: { byId: "e27", at: fromToday(-30) },
  }),
  // Открытый больничный без постоянного заместителя — «Нет замещающего»
  absence("a22", "e18", "sick", -1, null, "open", {
    elnNumber: "910246813579",
    elnHistory: [{ number: "910246813579", start: fromToday(-1), end: null }],
  }),
  // Скоро
  absence("a07", "e19", "vacation", 5, 18, "approved", { deputyId: "e20" }),
  absence("a08", "e10", "study", 2, 4, "approved"),
  absence("a09", "e09", "trip", 7, 9, "approved", { comment: "Аудит филиала" }),
  // Заявки на согласовании — в ИТ пересекаются (конфликт покрытия)
  absence("a10", "e21", "vacation", 20, 33, "pending"),
  absence("a11", "e23", "vacation", 21, 30, "pending"),
  absence("a12", "e24", "vacation", 30, 43, "pending"),
  // Согласован раньше — вместе с заявками выше роняет покрытие ИТ ниже порога
  absence("a20", "e26", "vacation", 28, 35, "approved", {
    decision: { byId: "e19", at: fromToday(-10) },
  }),
  absence("a13", "e16", "vacation", 45, 58, "draft"),
  absence("a14", "e28", "vacation", 10, 16, "rejected", {
    decision: { byId: "e27", at: fromToday(-2), reason: "Пересекается с закрытием квартала" },
  }),
  // История сотрудника e21 (демо-аккаунт «Сотрудник»): согласованный в прошлом и отклонённый
  absence("a18", "e21", "vacation", -120, -107, "approved", {
    decision: { byId: "e19", at: fromToday(-150) },
  }),
  absence("a19", "e21", "vacation", 60, 66, "rejected", {
    comment: "Поездка с семьёй",
    decision: { byId: "e19", at: fromToday(-5), reason: "Сдача проекта" },
  }),
  // Прошедшие
  absence("a15", "e11", "vacation", -40, -27, "approved"),
  absence("a16", "e29", "sick", -15, -8, "closed", { elnNumber: "910555444333" }),
  absence("a17", "e26", "unpaid", -20, -18, "approved"),
];

/** Замещения на период, назначенные вручную (руководитель/HR) */
export const MOCK_DELEGATIONS: IDelegation[] = [
  {
    id: "g01",
    fromId: "e01",
    toId: "e02",
    period: { start: fromToday(10), end: fromToday(12) },
    reason: "manual",
    documentTypes: [],
    createdById: "e01",
  },
];

export const MOCK_DOCUMENTS: IDocument[] = [
  {
    id: "doc4",
    number: "С-2026/512",
    title: "Счёт на продление лицензий IDE",
    type: "invoice",
    authorId: "e21",
    createdAt: fromToday(-9),
    routeStartedAt: fromToday(-8),
    steps: [
      {
        id: "s1",
        approverId: "e19",
        durationDays: 2,
        status: "approved",
        decidedAt: fromToday(-7),
      },
      {
        id: "s2",
        approverId: "e09",
        durationDays: 2,
        status: "approved",
        decidedAt: fromToday(-6),
      },
    ],
  },
  {
    id: "doc1",
    number: "Д-2026/114",
    title: "Договор поставки серверного оборудования",
    type: "contract",
    // Автор — демо-«Сотрудник»: на «Сегодня» видно «Передать заместителю» (юрист в отпуске)
    authorId: "e21",
    createdAt: fromToday(-1),
    routeStartedAt: fromToday(0),
    steps: [
      { id: "s1", approverId: "e04", durationDays: 2, status: "in_progress" },
      { id: "s2", approverId: "e09", durationDays: 2, status: "waiting" },
      { id: "s3", approverId: "e01", durationDays: 1, status: "waiting" },
    ],
  },
  {
    id: "doc2",
    number: "П-2026/087",
    title: "Приказ о премировании по итогам квартала",
    type: "order",
    authorId: "e15",
    createdAt: fromToday(-3),
    routeStartedAt: fromToday(-2),
    steps: [
      {
        id: "s1",
        approverId: "e09",
        durationDays: 2,
        status: "approved",
        decidedAt: fromToday(-1),
      },
      { id: "s2", approverId: "e01", durationDays: 1, status: "in_progress" },
    ],
  },
  {
    id: "doc3",
    number: "СЗ-2026/233",
    title: "Служебная записка о закупке ноутбуков для ИТ-отдела",
    type: "memo",
    authorId: "e21",
    createdAt: fromToday(0),
    routeStartedAt: null,
    steps: [
      { id: "s1", approverId: "e19", durationDays: 3, status: "waiting" },
      { id: "s2", approverId: "e25", durationDays: 2, status: "waiting" },
      { id: "s3", approverId: "e09", durationDays: 2, status: "waiting" },
    ],
  },
];
