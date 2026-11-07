import { flagForCountry } from "../../lib/visual";

export function Flag({
  countryCode,
  className,
}: {
  countryCode: string | null | undefined;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={className ? `leading-none ${className}` : "leading-none"}>
      {flagForCountry(countryCode)}
    </span>
  );
}
