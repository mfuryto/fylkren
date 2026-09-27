export async function responseErrorMessage(response: Response, fallback: string) {
  try {
    const problem = (await response.json()) as {
      error?: string;
      detail?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };
    const validationMessage = Object.values(problem.errors ?? {}).flat().find(Boolean);
    return problem.error || validationMessage || problem.detail || problem.title || fallback;
  } catch {
    return fallback;
  }
}

export function errorMessage(problem: unknown, fallback: string) {
  return problem instanceof Error && problem.message ? problem.message : fallback;
}
