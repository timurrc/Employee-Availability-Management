import { Link } from "react-router-dom";
import CoverageMeter from "@/components/ui/CoverageMeter/CoverageMeter";
import { ROUTES, withQuery } from "@/constants/routes";
import type { ICoverageRow } from "@/utils/today";

interface DepartmentCoverageProps {
  rows: ICoverageRow[];
}

/** Покрытие по подразделениям на дату; клик — календарь команды этого отдела */
const DepartmentCoverage = ({ rows }: DepartmentCoverageProps) => {
  return (
    <ul className="flex flex-col gap-1">
      {rows.map(({ department, coverage }) => (
        <li key={department.id}>
          <Link
            to={withQuery(ROUTES.TEAM, { dept: department.id })}
            className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
          >
            <span className="truncate text-sm">{department.name}</span>
            <CoverageMeter
              available={coverage.available}
              total={coverage.total}
              threshold={coverage.threshold}
              label={`Покрытие: ${department.name}`}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default DepartmentCoverage;
