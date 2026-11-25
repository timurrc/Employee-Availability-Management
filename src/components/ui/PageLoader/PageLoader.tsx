import Skeleton, { Delayed } from "@/components/ui/Skeleton/Skeleton";

/** Fallback для Suspense: каркас остаётся, в контенте — скелетон заголовка и трёх строк */
const PageLoader = () => {
  return (
    <div role="status" aria-label="Загрузка" className="flex flex-col gap-6">
      <Delayed>
        <Skeleton className="h-8 w-64" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </Delayed>
    </div>
  );
};

export default PageLoader;
