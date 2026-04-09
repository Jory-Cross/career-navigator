/**
 * ⚠️ DEPRECATED — Do not use for new code.
 *
 * This file is no longer on the active save path.
 *
 * Active save pipeline:
 *   DynamicEntryForm
 *     → handleDynamicEntrySave   (builds payload once, validates, logs)
 *       → persistTimeEntry        (thin DB writer: create/update only)
 *
 * This file built its own payload via buildTimeEntryPayload AND ran its own
 * validateBeforeSave, causing double-validation and double-build when called
 * from DynamicEntryForm. It has been superseded by persistTimeEntry.
 *
 * Safe to delete once all legacy callsites (if any remain outside the active path)
 * have been removed or confirmed unreachable.
 */

export async function saveTimeEntry() {
  throw new Error(
    "saveTimeEntry() is deprecated. Use handleDynamicEntrySave → persistTimeEntry instead."
  );
}