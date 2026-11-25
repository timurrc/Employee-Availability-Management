import {
  ArrowRight,
  FileText,
  HeartPulse,
  Palmtree,
  TriangleAlert,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import { buildPath, ROUTES, withQuery } from "@/constants/routes";
import { TONE_CLASSES, type Tone } from "@/constants/tones";
import { cn } from "@/utils/cn";
import type { IPendingAction, PendingActionKind } from "@/utils/today";

const LIMIT = 5;

const KIND_META: Record<PendingActionKind, { icon: LucideIcon; tone: Tone }> = {
  vacation_queue: { icon: Palmtree, tone: "abs-vacation" },
  coverage_risk: { icon: TriangleAlert, tone: "danger" },
  stuck_document: { icon: FileText, tone: "warning" },
  sick_overlap: { icon: HeartPulse, tone: "abs-sick" },
  sick_no_deputy: { icon: UserRoundX, tone: "danger" },
};

const hrefOf = ({ target }: IPendingAction) => {
  switch (target.page) {
    case "vacations":
      return ROUTES.VACATIONS;
    case "sick-leaves":
      return ROUTES.SICK_LEAVES;
    case "team":
      return withQuery(ROUTES.TEAM, { dept: target.departmentId });
    case "document":
      return buildPath(ROUTES.DOCUMENT, { id: target.id });
  }
};

interface TodayActionsProps {
  actions: IPendingAction[];
  /** Выполнить действие на месте (передать этап заместителю) */
  onDelegate?: (action: IPendingAction) => void;
  delegatingId?: string | null;
}

/** «Ждут вашего действия»: строка = одно действие. Нечего делать — блока нет. */
const TodayActions = ({ actions, onDelegate, delegatingId }: TodayActionsProps) => {
  const [expanded, setExpanded] = useState(false);
  if (actions.length === 0) return null;

  const visible = expanded ? actions : actions.slice(0, LIMIT);
  const hidden = actions.length - visible.length;

  return (
    <Card title="Ждут вашего действия" aria-label="Ждут вашего действия" flush>
      <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
        {visible.map((action) => {
          const { icon: Icon, tone } = KIND_META[action.kind];
          return (
            <li key={action.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <Icon
                className={cn("size-4 shrink-0", TONE_CLASSES[tone].fg)}
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="min-w-0 flex-1">{action.text}</p>
              {action.delegate && onDelegate ? (
                <span className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    isLoading={delegatingId === action.id}
                    onClick={() => onDelegate(action)}
                  >
                    {action.actionLabel}
                  </Button>
                  <Link
                    to={hrefOf(action)}
                    className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:underline"
                  >
                    Открыть
                  </Link>
                </span>
              ) : (
                <Link
                  to={hrefOf(action)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  {action.actionLabel}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full cursor-pointer border-t border-[var(--color-border)] px-4 py-2 text-left text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Ещё {hidden}
        </button>
      )}
    </Card>
  );
};

export default TodayActions;
