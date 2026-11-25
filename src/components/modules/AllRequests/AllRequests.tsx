import { SearchX } from "lucide-react";
import { useState } from "react";
import AbsenceTag from "@/components/modules/AbsenceTag/AbsenceTag";
import PersonChip from "@/components/modules/PersonChip/PersonChip";
import Badge from "@/components/ui/Badge/Badge";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import Select from "@/components/ui/Select/Select";
import Table, { type TableColumn } from "@/components/ui/Table/Table";
import { eachISODate } from "@/core/calendar";
import { ABSENCE_META, ABSENCE_STATUS_META } from "@/constants/absence";
import type { AbsenceStatus, AbsenceType, IAbsence } from "@/types/absence.types";
import type { ISODate } from "@/types/common.types";
import type { IDepartment, IEmployee } from "@/types/employee.types";
import { shortName } from "@/utils/availability";
import { formatDay, formatPeriod } from "@/utils/date";

interface AllRequestsProps {
  requests: IAbsence[];
  departments: IDepartment[];
  /** Руководитель видит только свой отдел — фильтр по отделу не нужен */
  showDepartmentFilter: boolean;
  today: ISODate;
  employeeById: (id: string) => IEmployee | undefined;
}

const ALL = "";
const STATUSES: AbsenceStatus[] = ["pending", "approved", "rejected", "cancelled"];
const TYPES: AbsenceType[] = ["vacation", "unpaid", "study", "dayoff"];

/** «Все заявки»: таблица с фильтрами, только чтение (HR не согласует отпуска) */
const AllRequests = ({
  requests,
  departments,
  showDepartmentFilter,
  today,
  employeeById,
}: AllRequestsProps) => {
  const [dept, setDept] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);

  const rows = requests.filter((a) => {
    const person = employeeById(a.employeeId);
    return (
      (!dept || person?.departmentId === dept) &&
      (!status || a.status === status) &&
      (!type || a.type === type)
    );
  });

  const columns: TableColumn<IAbsence>[] = [
    {
      key: "employee",
      header: "Сотрудник",
      cell: (a) => {
        const person = employeeById(a.employeeId);
        return person ? <PersonChip person={person} variant="inline" date={today} /> : "—";
      },
      sortValue: (a) => employeeById(a.employeeId)?.fullName ?? "",
    },
    { key: "type", header: "Тип", cell: (a) => <AbsenceTag type={a.type} /> },
    {
      key: "period",
      header: "Период",
      cell: (a) => formatPeriod(a.period, today),
      sortValue: (a) => a.period.start,
    },
    {
      key: "days",
      header: "Дни",
      align: "right",
      cell: (a) => (a.period.end ? eachISODate(a.period.start, a.period.end).length : "—"),
    },
    {
      key: "status",
      header: "Статус",
      cell: (a) => (
        <Badge tone={ABSENCE_STATUS_META[a.status].tone}>
          {ABSENCE_STATUS_META[a.status].label}
        </Badge>
      ),
      sortValue: (a) => a.status,
    },
    {
      key: "deputy",
      header: "Заместитель",
      cell: (a) => {
        const id = a.deputyId ?? employeeById(a.employeeId)?.deputyId;
        const person = id ? employeeById(id) : undefined;
        return person ? shortName(person.fullName) : "—";
      },
    },
    {
      key: "created",
      header: "Создана",
      cell: (a) => formatDay(a.createdAt, today),
      sortValue: (a) => a.createdAt,
    },
  ];

  const reset = () => {
    setDept(ALL);
    setStatus(ALL);
    setType(ALL);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-3">
        {showDepartmentFilter && (
          <Select label="Подразделение" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value={ALL}>Все</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={ALL}>Все</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ABSENCE_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <Select label="Тип" value={type} onChange={(e) => setType(e.target.value)}>
          <option value={ALL}>Все</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {ABSENCE_META[t].label}
            </option>
          ))}
        </Select>
      </div>
      <Table
        caption="Все заявки"
        columns={columns}
        rows={rows}
        getRowId={(a) => a.id}
        initialSort={{ key: "period", direction: "desc" }}
        empty={
          <EmptyState
            icon={SearchX}
            title="Ничего не найдено"
            description="По этим фильтрам заявок нет."
            action={
              <Button variant="secondary" onClick={reset}>
                Сбросить фильтры
              </Button>
            }
          />
        }
        renderCard={(a) => {
          const person = employeeById(a.employeeId);
          return (
            <div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
              {person && <PersonChip person={person} variant="inline" date={today} />}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <AbsenceTag type={a.type} />
                <span>{formatPeriod(a.period, today)}</span>
                <Badge tone={ABSENCE_STATUS_META[a.status].tone}>
                  {ABSENCE_STATUS_META[a.status].label}
                </Badge>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

export default AllRequests;
