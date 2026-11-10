/** Light haptic feedback. No-ops where the Vibration API is missing (iOS Safari) or blocked. */
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignored: haptics are never essential */
  }
}

export const haptics = {
  tap: () => vibrate(10),
  select: () => vibrate(15),
  success: () => vibrate([12, 40, 18]),
  warn: () => vibrate([20, 60, 20]),
};
