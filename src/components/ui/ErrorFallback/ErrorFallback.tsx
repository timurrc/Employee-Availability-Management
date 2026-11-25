import type { FallbackProps } from "react-error-boundary";
import ErrorState from "@/components/ui/ErrorState/ErrorState";

/** Экран ошибки для react-error-boundary вместо белой страницы */
const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const reason = error instanceof Error ? error.message : undefined;
  return <ErrorState what="страницу" reason={reason} onRetry={resetErrorBoundary} />;
};

export default ErrorFallback;
