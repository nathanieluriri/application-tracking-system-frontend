import { Spinner } from "./Spinner";

export function PageLoader() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <Spinner size="lg" />
    </div>
  );
}
