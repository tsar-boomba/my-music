import {
	downloadAsync,
	documentDirectory,
	deleteAsync,
	getInfoAsync,
	cacheDirectory,
} from 'expo-file-system';
import { useMMKVStorage } from 'react-native-mmkv-storage';
import { storage } from './storage';

export type SourceEntry = { id: number; uri: string; mimeType: string | null };
export type DownloadedSources = Record<number, SourceEntry>;

const downloadSource = async (source: {
	id: number;
	mimeType: string;
	request: { uri: string };
}) => {
	console.log(`downloading ${source.request.uri}`);
	let ext = source.mimeType.split('/')[1];
	if (ext === 'mpeg') ext = 'mp3';

	const res = await downloadAsync(
		source.request.uri,
		documentDirectory + `${source.id}${ext ? `.${ext}` : ''}`,
		{ cache: true },
	);

	return res;
};

export const downloadSources = async (
	sources: { id: number; mimeType: string; request: { uri: string } }[],
) => {
	const NUM_WORKERS = 8;
	const downloadedSources =
		(await storage.getMapAsync<DownloadedSources>(DOWNLOADED_SOURCES_KEY)) ??
		{};

	const queue = { head: 0 };
	const files: SourceEntry[] = [];
	const workers = [...Array(NUM_WORKERS).keys()].map(async () => {
		while (true) {
			const i = queue.head++;

			if (i >= sources.length) break;
			const source = sources[i];
			try {
				const res = await downloadSource(source);
				files.push({ id: source.id, uri: res.uri, mimeType: res.mimeType });
				console.log('downloaded', i);
			} catch (e) {
				console.error('error downloading source', e);
			}
		}
	});

	await Promise.all(workers);

	for (const file of files) {
		downloadedSources[file.id] = file;
	}
	await storage.setMapAsync(DOWNLOADED_SOURCES_KEY, downloadedSources);
	console.log('downloads done');

	return files;
};

export const removeDownloads = async () => {
	const NUM_WORKERS = 5;
	const downloadedSources =
		(await storage.getMapAsync<DownloadedSources>(DOWNLOADED_SOURCES_KEY)) ??
		{};

	const queue = { head: 0 };
	const downloads = Object.entries(downloadedSources);
	const workers = [...Array(NUM_WORKERS).keys()].map(async () => {
		while (true) {
			const i = queue.head++;

			if (i >= downloads.length) break;
			const [id, { uri }] = downloads[i];
			try {
				await deleteAsync(uri, { idempotent: true });
				console.log('removed', uri);
			} catch (e) {
				console.error('error removing source', e);
			} finally {
				delete downloadedSources[Number(id)];
			}
		}
	});

	await Promise.all(workers);
	await storage.setMapAsync(DOWNLOADED_SOURCES_KEY, downloadedSources);
};

export const downloadsInfo = () => {
	return getInfoAsync(documentDirectory!, { size: true });
};

const DOWNLOADED_SOURCES_KEY = 'downloadedSources';

export const useDownloadedSources = (): DownloadedSources => {
	const [downloaded, _setDownloaded] = useMMKVStorage<DownloadedSources>(
		DOWNLOADED_SOURCES_KEY,
		storage,
		{},
	);
	return downloaded;
};
