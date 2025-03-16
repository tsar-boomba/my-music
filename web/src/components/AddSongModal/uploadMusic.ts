import { FileWithPath } from '@mantine/dropzone';
import { Dispatch, RefObject, SetStateAction } from 'react';
import WebsocketAsPromised from 'websocket-as-promised';
import { HOST } from '../../api';

const scheme = import.meta.env.DEV ? 'ws://' : 'wss://';

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

type AddSongRes = {
	createdAlbum: boolean | null;
	addedAlbum: boolean | null;
	createdArtists: boolean | null;
	addedArtists: boolean | null;
};

export const handleUpload = async (
	files: FileWithPath[],
	setUploading: Dispatch<SetStateAction<number>>,
	setMetadata: Dispatch<SetStateAction<ParsedMetadata | null>>,
	setError: Dispatch<SetStateAction<string>>,
	finalMetaRef: RefObject<{
		resolve?: (meta: FinalMetadata) => void;
		promise: Promise<FinalMetadata>;
	}>,
): Promise<boolean> => {
	// Open WS
	const ws = new WebsocketAsPromised(`${scheme}${HOST}/api/add-songs`, {});
	await ws.open();

	// Tell the server some info about the songs we'll upload
	ws.send(
		JSON.stringify(files.map(({ name, size, type }) => ({ name, size, type }))),
	);

	// Upload each song
	for (let i = 0; i < files.length; i++) {
		setUploading(i);
		ws.send(await files[i].arrayBuffer());
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
	new Promise((resolve) =>
		ws.onMessage.addOnceListener((message) => resolve(message)),
	);
