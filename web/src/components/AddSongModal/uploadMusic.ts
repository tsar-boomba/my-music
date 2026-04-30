import { FileWithPath } from '@mantine/dropzone';
import { Dispatch, RefObject, SetStateAction } from 'react';
import WebsocketAsPromised from 'websocket-as-promised';
import { HOST } from '../../api';

const scheme = location.protocol === 'http:' ? 'ws://' : 'wss://';

export type ParsedMetadata = {
	title: string | null;
	album: string | null;
	artists: string[];
};

export type FinalMetadata = {
	title: string;
	album: string;
	artists: string[];
};

type YtInitSongInfo = {
	url: string;
};

type UploadedInitSongInfo = {
	name: string;
	size: number;
	type: string;
};

type AddSongRes = {
	createdAlbum: boolean | null;
	addedAlbum: boolean | null;
	createdArtists: boolean | null;
	addedArtists: boolean | null;
};

const isStringArray = (arr: any[]): arr is string[] => {
	return typeof arr[0] === 'string';
}

const cleanYouTubeUrl = (urlString: string): string => {
	try {
		const url = new URL(urlString);
		const videoId = url.searchParams.get('v');

		url.search = ''; // Clear all query parameters

		if (videoId) {
			url.searchParams.set('v', videoId); // Re-add only the 'v' parameter
		}

		return url.toString();
	} catch (error) {
		console.error('yt url parse error:', error);
		return '';
	}
}

export const handleUpload = async (
	files: FileWithPath[] | string[],
	setUploading: Dispatch<SetStateAction<number>>,
	setMetadata: Dispatch<SetStateAction<ParsedMetadata | null>>,
	setError: Dispatch<SetStateAction<string>>,
	finalMetaRef: RefObject<{
		resolve?: (meta: FinalMetadata) => void;
		promise: Promise<FinalMetadata>;
	}>,
): Promise<boolean> => {
	if (files.length === 0) return false;

	// Open WS
	const ws = new WebsocketAsPromised(`${scheme}${HOST}/api/add-songs`, {});
	await ws.open();

	if (isStringArray(files)) {
		// Send the URL for yt-dlp to get
		const infos = files.map((url) => ({ yt: { url: cleanYouTubeUrl(url) } satisfies YtInitSongInfo })).filter((info) => info.yt.url);

		if (infos.length === 0) return false; // invalid url

		ws.send(
			JSON.stringify(infos)
		);
	} else {
		// Tell the server some info about the songs we'll upload
		ws.send(
			JSON.stringify(files.map(({ name, size, type }) => ({ uploaded: { name, size, type } satisfies UploadedInitSongInfo }))),
		);


	}
	// Upload each song
	for (let i = 0; i < files.length; i++) {
		setUploading(i);
		if (!isStringArray(files)) {
			ws.send(await files[i].arrayBuffer());
		}
		const meta: ParsedMetadata | { error: string } = JSON.parse(
			await waitForResponse(ws),
		);
		if ('error' in meta) {
			setError(meta.error);
			throw meta.error;
		}

		console.log(meta);

		setMetadata(meta);
		while (true) {
			finalMetaRef.current.promise = new Promise((resolve) => {
				finalMetaRef.current.resolve = resolve;
			});
			const finalMeta = await finalMetaRef.current.promise;
			console.log('sent final meta', finalMeta);
			ws.send(JSON.stringify(finalMeta));

			const finalRes: AddSongRes | { error: string } = JSON.parse(
				await waitForResponse(ws),
			);

			// Something wrong with out final meta
			if ('error' in finalRes) {
				setError(finalRes.error);
				setMetadata(meta);
				continue;
			}

			// TODO: add notifications when there's some error here
			console.log(finalRes);

			break;
		}
	}


	await ws.close();
	return true;
};

const waitForResponse = (ws: WebsocketAsPromised): Promise<any> =>
	Promise.any([
		new Promise((resolve) =>
			ws.onClose.addOnceListener(() => resolve({})),
		),
		new Promise((resolve) =>
			ws.onMessage.addOnceListener((message) => resolve(message)),
		),
	]).then((messageOrCloseEvent) => {
		ws.onClose.removeAllListeners();
		ws.onMessage.removeAllListeners();

		if (typeof messageOrCloseEvent === 'object') {
			// Closed D:
			return JSON.stringify({ error: 'WS closed unexpectedly' });
		}

		return messageOrCloseEvent;
	});
