export const HOST = import.meta.env.DEV ? 'localhost:8013' : location.host;
export const BASE_URL = import.meta.env.DEV ? `http://${HOST}` : ''; // TODO: get base path from cookie?

export const apiUrl = (path: string) => `${BASE_URL}/api${path}`;
export const staticUrl = (path: string) => `${BASE_URL}${path}`;

export const fetcher = <JSON = unknown>(url: string): Promise<JSON> =>
	fetch(url, { credentials: 'include' }).then((res) => {
		if (res.ok) {
			return res.json();
		} else {
			throw new Error(`Bad response ${res.status}`);
		}
	});

export const apiFetcher = <JSON = unknown>(path: string): Promise<JSON> =>
	fetcher<JSON>(apiUrl(path));
