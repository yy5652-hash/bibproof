import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Real index responses recorded once for the eight sample entries (trimmed); the one OpenAlex search that hit the daily
// keyless budget while recording is set to the empty result list it returned on an earlier run. Nothing here touches the network.
const recorded: Record<string, { status: number; body: unknown }> = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/sample-responses.json', import.meta.url)), 'utf8'));
export const INDEX_HOSTS = ['api.crossref.org', 'api.datacite.org', 'api.openalex.org', 'www.ebi.ac.uk', 'openlibrary.org'];

/** Answers every request to a scholarly index from the recorded fixtures and returns the list of hosts and URLs contacted. */
export async function installMock(page: Page): Promise<{ hosts: string[]; urls: string[]; bodies: string[] }> {
  const seen = { hosts: [] as string[], urls: [] as string[], bodies: [] as string[] };
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), async route => {
    const request = route.request(); const url = request.url();
    seen.hosts.push(new URL(url).host); seen.urls.push(url); seen.bodies.push(request.postData() ?? '');
    const hit = recorded[url];
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-headers': '*' } });
    if (hit) return route.fulfill({ status: hit.status, headers, body: JSON.stringify(hit.body ?? {}) });
    // Anything unrecorded behaves like a healthy index with nothing to say.
    const u = new URL(url);
    const body = u.host === 'api.crossref.org' ? (u.pathname.startsWith('/works/') ? null : { message: { items: [] } }) : u.host === 'api.openalex.org' ? (u.pathname.startsWith('/works/') ? null : { results: [] }) : u.host === 'www.ebi.ac.uk' ? { resultList: { result: [] } } : u.host === 'api.datacite.org' ? null : { docs: [] };
    return route.fulfill(body ? { status: 200, headers, body: JSON.stringify(body) } : { status: 404, headers, body: '{}' });
  });
  return seen;
}
