/**
 * Dev-server API for template files. Only called when NODE_ENV is development.
 */

export function devApiRoot(baseUrl: string): string {
  const b = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${b}/api/dev`;
}

export async function fetchTemplateList(baseUrl: string): Promise<{templates: import('./types').TemplateListEntry[]}> {
  const res = await fetch(`${devApiRoot(baseUrl)}/templates`);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function readTemplateFile(
  baseUrl: string,
  templateId: string,
  relPath: string
): Promise<string> {
  const q = new URLSearchParams({path: relPath});
  const res = await fetch(
    `${devApiRoot(baseUrl)}/templates/${encodeURIComponent(templateId)}/file?${q}`
  );
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);
  return res.text();
}

export async function writeTemplateFile(
  baseUrl: string,
  templateId: string,
  relPath: string,
  body: string
): Promise<{ok: boolean; catalog?: {ok: boolean; error?: string}}> {
  const q = new URLSearchParams({path: relPath});
  const res = await fetch(
    `${devApiRoot(baseUrl)}/templates/${encodeURIComponent(templateId)}/file?${q}`,
    {method: 'POST', body, headers: {'Content-Type': 'text/plain; charset=utf-8'}}
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function mkdirTemplate(
  baseUrl: string,
  templateId: string,
  relPath: string
): Promise<void> {
  const q = new URLSearchParams({path: relPath});
  const res = await fetch(
    `${devApiRoot(baseUrl)}/templates/${encodeURIComponent(templateId)}/mkdir?${q}`,
    {method: 'POST'}
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteTemplatePath(
  baseUrl: string,
  templateId: string,
  relPath: string
): Promise<void> {
  const q = new URLSearchParams({path: relPath});
  const res = await fetch(
    `${devApiRoot(baseUrl)}/templates/${encodeURIComponent(templateId)}/file?${q}`,
    {method: 'DELETE'}
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function mvTemplatePath(
  baseUrl: string,
  templateId: string,
  from: string,
  to: string
): Promise<void> {
  const res = await fetch(
    `${devApiRoot(baseUrl)}/templates/${encodeURIComponent(templateId)}/mv`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({from, to}),
    }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function createTemplate(
  baseUrl: string,
  payload: object
): Promise<{ok: boolean; id: string}> {
  const res = await fetch(`${devApiRoot(baseUrl)}/templates/create`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteTemplate(baseUrl: string, templateId: string): Promise<void> {
  const res = await fetch(
    `${devApiRoot(baseUrl)}/templates/${encodeURIComponent(templateId)}`,
    {method: 'DELETE'}
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function rebuildCatalog(baseUrl: string): Promise<unknown> {
  const res = await fetch(`${devApiRoot(baseUrl)}/templates/rebuild-catalog`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
