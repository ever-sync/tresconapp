export function uploadFormDataWithProgress<T = unknown>(
  url: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
  method = "POST"
) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))));
    };

    xhr.onload = () => {
      const text = xhr.responseText || "";
      let payload: unknown = null;

      if (text) {
        try {
          payload = JSON.parse(text) as T;
        } catch {
          payload = text;
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as T);
        return;
      }

      const errorMessage =
        typeof payload === "object" && payload !== null && "error" in payload
          ? String((payload as { error?: unknown }).error ?? "Falha ao enviar")
          : `Falha ao enviar (${xhr.status})`;
      reject(new Error(errorMessage));
    };

    xhr.onerror = () => reject(new Error("Falha ao enviar o arquivo"));
    xhr.onabort = () => reject(new Error("Envio cancelado"));
    xhr.send(formData);
  });
}
