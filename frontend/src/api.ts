export type Connection = { url: string; key: string };
const defaultConnection: Connection = {
  url: (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, ""),
  key: "",
};
export const readConnection = (): Connection => {
  try {
    const saved = JSON.parse(sessionStorage.getItem("modelforge-connection") || "null");
    return {
      url: typeof saved?.url === "string" && saved.url.trim() ? saved.url.trim() : defaultConnection.url,
      key: typeof saved?.key === "string" ? saved.key : "",
    };
  } catch {
    return { ...defaultConnection };
  }
};
export async function request<T>(
  path: string,
  body?: unknown,
  connection = readConnection(),
): Promise<T> {
  const response = await fetch(
    connection.url.replace(/\/$/, "") + "/api" + path,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(connection.key ? { "X-API-Key": connection.key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Request failed (${response.status}). Check your settings and input.`,
    );
  }
  return response.json();
}
export async function download(path: string, name: string) {
  const connection = readConnection();
  const response = await fetch(
    connection.url.replace(/\/$/, "") + "/api" + path,
    { headers: connection.key ? { "X-API-Key": connection.key } : {} },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Download failed.");
  }
  saveBlob(await response.blob(), name);
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function saveJSON(value: unknown, name: string) {
  saveBlob(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    name,
  );
}
