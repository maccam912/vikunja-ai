export const cleanVikunjaBaseUrl = (url: string) => {
  if (!url) return "";
  let cleaned = url.trim();
  cleaned = cleaned.replace(/\/+$/, "");
  if (cleaned.endsWith("/api/v1")) {
    cleaned = cleaned.slice(0, -7);
  }
  return cleaned.replace(/\/+$/, "");
};

export const buildTaskLink = (
  baseUrl: string,
  projectId: number,
  taskId: number,
) => {
  const cleanedBase = cleanVikunjaBaseUrl(baseUrl);
  if (!cleanedBase || !projectId || !taskId) return "";

  return `${cleanedBase}/projects/${projectId}/tasks/${taskId}`;
};
