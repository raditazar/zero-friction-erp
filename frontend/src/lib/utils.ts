type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

export function cn(...classes: ClassValue[]) {
  return classes
    .flatMap((value): string[] => {
      if (!value) return [];
      if (typeof value === "string" || typeof value === "number") return [String(value)];
      if (Array.isArray(value)) return [cn(...value)];
      if (typeof value === "object") {
        return Object.entries(value)
          .filter(([, enabled]) => enabled)
          .map(([className]) => className);
      }
      return [];
    })
    .filter(Boolean)
    .join(" ");
}
