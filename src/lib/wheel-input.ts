export type WheelOption = { value: string; label: string };

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/** Accept Thai numerals the way older users type them on a Thai keyboard. */
export function normalizeThaiDigits(raw: string): string {
  return raw.replace(/[๐-๙]/g, (ch) => {
    const i = THAI_DIGITS.indexOf(ch);
    return i >= 0 ? String(i) : ch;
  });
}

/**
 * Map a typed fragment onto a wheel option.
 * `null` = keep typing (ambiguous / incomplete). `""` = cleared.
 */
export function matchWheelInput(
  raw: string,
  options: WheelOption[],
): string | null {
  const typed = normalizeThaiDigits(raw).trim();
  if (!typed) return "";

  const exactValue = options.find((o) => o.value === typed);
  if (exactValue) return exactValue.value;

  const exactLabel = options.find((o) => o.label === typed);
  if (exactLabel) return exactLabel.value;

  const ci = typed.toLowerCase();
  const exactInsensitive = options.find(
    (o) => o.value.toLowerCase() === ci || o.label.toLowerCase() === ci,
  );
  if (exactInsensitive) return exactInsensitive.value;

  const n = Number(typed);
  if (Number.isFinite(n) && /^-?\d+$/.test(typed)) {
    const byNumber = options.find(
      (o) => o.value !== "" && /^\d+$/.test(o.value) && Number(o.value) === n,
    );
    if (byNumber) return byNumber.value;

    const named = options.filter((o) => o.value !== "" && !/^\d+$/.test(o.value));
    if (named.length === 12 && n >= 1 && n <= 12) {
      return named[n - 1]?.value ?? null;
    }
  }

  const prefixes = options.filter(
    (o) =>
      o.value !== "" &&
      (o.value.startsWith(typed) ||
        o.label.startsWith(typed) ||
        o.value.toLowerCase().startsWith(ci) ||
        o.label.toLowerCase().startsWith(ci)),
  );
  if (prefixes.length === 1) return prefixes[0]?.value ?? null;
  return null;
}

export function wheelInputDisplay(value: string, options: WheelOption[]): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}
