import { MapPinOff } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import { ROUTES } from "@/constants/routes";

const NotFoundPage = () => {
  return (
    <EmptyState
      icon={MapPinOff}
      title="Страница не найдена"
      description="Возможно, ссылка устарела. Главное — на экране «Сегодня»."
      action={
        <Link to={ROUTES.HOME} className="font-medium text-[var(--color-primary)] hover:underline">
          Открыть «Сегодня»
        </Link>
      }
      className="py-20"
    />
  );
};

export default NotFoundPage;
