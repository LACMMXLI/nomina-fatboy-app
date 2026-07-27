export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  fieldErrors?: Record<string, string[]>;
  error?: string;
  conflict?: boolean;
}

export function actionError<T = unknown>(error: unknown): ActionResult<T> {
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Ocurrió un error inesperado." };
}
