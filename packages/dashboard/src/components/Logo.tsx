import logoSmall from "../assets/icon-192.png";

const SIZES = {
  sm: 20,
  md: 32,
  lg: 48,
} as const;

export type LogoSize = keyof typeof SIZES;

export function Logo({ size = "sm", className }: { size?: LogoSize; className?: string }) {
  const px = SIZES[size];
  return (
    <img
      src={logoSmall}
      alt=""
      aria-hidden="true"
      width={px}
      height={px}
      className={["shrink-0 rounded-basalt-sm", className].filter(Boolean).join(" ")}
    />
  );
}
