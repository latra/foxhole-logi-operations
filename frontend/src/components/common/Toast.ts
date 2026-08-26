/* ── Toast helper wrapping Materialize M.toast ───────────────────── */

import M from "materialize-css";

export function toastSuccess(message: string) {
  M.toast({
    html: message,
    displayLength: 4000,
    classes: "foxhole-toast toast-success",
  });
}

export function toastError(message: string) {
  M.toast({
    html: message,
    displayLength: 4000,
    classes: "foxhole-toast toast-error",
  });
}
