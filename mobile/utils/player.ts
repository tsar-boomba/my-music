import { useFetcher } from '@/hooks/fetcher';
import { SongWTags } from '@/hooks/maps';
import { useServer } from '@/hooks/storage';
import { Album } from '@/types/Album';
import { Source } from '@/types/Source';
import CookieManager from '@react-native-cookies/cookies';
import TrackPlayer, {
	AddTrack,
	AppKilledPlaybackBehavior,
	Capability,
	Event,
	IOSCategory,
	IOSCategoryMode,
	IOSCategoryOptions,
	RepeatMode,
	TrackType,
} from 'react-native-track-player';
import useSWR from 'swr';

const serviceHandler = async () => {
	TrackPlayer.addEventListener(Event.RemotePause, () => {
		console.log('Event.RemotePause');
		TrackPlayer.pause();
	});

	TrackPlayer.addEventListener(Event.RemotePlay, () => {
		console.log('Event.RemotePlay');
		TrackPlayer.play();
	});

	TrackPlayer.addEventListener(Event.RemoteStop, () => {
		console.log('Event.RemoteStop');
		TrackPlayer.stop();
	});

	TrackPlayer.addEventListener(Event.RemoteNext, () => {
		console.log('Event.RemoteNext');
		TrackPlayer.skipToNext();
	});

	TrackPlayer.addEventListener(Event.RemotePrevious, () => {
		console.log('Event.RemotePrevious');
		TrackPlayer.skipToPrevious();
	});

	TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
		console.log('Event.RemoteJumpForward', event);
		TrackPlayer.seekBy(event.interval);
	});

	TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
		console.log('Event.RemoteJumpBackward', event);
		TrackPlayer.seekBy(-event.interval);
	});

	TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
		console.log('Event.RemoteSeek', event);
		TrackPlayer.seekTo(event.position);
	});

	TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
		console.log('Event.PlaybackActiveTrackChanged', event);
		if (event.track) TrackPlayer.updateNowPlayingMetadata({ artwork: event.track.artwork });
	});
};

export const registerPlayerService = () => {
	console.log('registered service factory');
	TrackPlayer.registerPlaybackService(() => serviceHandler);
};

const _setupPlayer = async (
	options: Parameters<typeof TrackPlayer.setupPlayer>[0],
) => {
	const setup = async () => {
		try {
			await TrackPlayer.setupPlayer(options);
		} catch (error) {
			return (error as Error & { code?: string }).code;
		}
	};
	while ((await setup()) === 'android_cannot_setup_player_in_background') {
		// A timeout will mostly only execute when the app is in the foreground,
		// and even if we were in the background still, it will reject the promise
		// and we'll try again:
		await new Promise<void>((resolve) => setTimeout(resolve, 1));
	}
};

export const setupPlayer = async (): Promise<void> => {
	await _setupPlayer({
		iosCategory: IOSCategory.Playback,
		iosCategoryMode: IOSCategoryMode.Default,
		iosCategoryOptions: [
			IOSCategoryOptions.DuckOthers,
			IOSCategoryOptions.DefaultToSpeaker,
			IOSCategoryOptions.AllowAirPlay,
		],
		autoHandleInterruptions: true,
	});
	await TrackPlayer.updateOptions({
		android: {
			appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
		},
		capabilities: [
			Capability.Play,
			Capability.Pause,
			Capability.SkipToNext,
			Capability.SkipToPrevious,
			Capability.SeekTo,
		],
		notificationCapabilities: [
			Capability.Play,
			Capability.Pause,
			Capability.SkipToNext,
			Capability.SkipToPrevious,
			Capability.SeekTo,
		],
		compactCapabilities: [Capability.Play, Capability.Pause],
		progressUpdateEventInterval: 1,
	});
	await TrackPlayer.setRepeatMode(RepeatMode.Queue);
};

const uriForSource = (
	baseUrl: string,
	cookiesHeader: string,
	source: { request: { uri: string } },
): { uri: string; headers: Record<string, string> } => {
	let uri = source.request.uri;
	const headers: Record<string, string> = {};
	if (uri.startsWith('/')) {
		uri = `${baseUrl}${uri}`;
		headers['cookie'] = cookiesHeader;
	}
	return { uri, headers };
};

export const useStartSession = ():
	| ((songs: SongWTags[], first: number) => Promise<void>)
	| undefined => {
	const fetcher = useFetcher();
	const [baseUrl] = useServer();
	const { data: allSources } = useSWR<
		(Source & {
			songId: number;
			request: { uri: string };
		})[]
	>('/api/songs/sources', fetcher);
	const { data: allAlbums } = useSWR<
		(Album & {
			songId: number;
			request: { uri: string };
		})[]
	>('/api/albums/sources', fetcher);

	if (!allSources || !allAlbums || !baseUrl) return undefined;

	return async (songs, first) => {
		const cookies = await CookieManager.get(baseUrl);
		const cookiesHeader = Object.values(cookies)
			.map((c) => `${c.name}=${c.value}`)
			.join(';');
		const tracks = songs
			.map((s) => {
				const source = allSources.find((src) => src.songId === s.id);
				if (!source) return undefined;
				const album = allAlbums.find((a) => s.tags.includes(a.title));
				const { uri, headers } = uriForSource(baseUrl, cookiesHeader, source);
				const albumUri = album
					? uriForSource(baseUrl, cookiesHeader, album)
					: undefined;

				return {
					url: uri,
					title: s.title,
					headers,
					artwork: albumUri?.uri,
					artist: 'My Music',
					type: TrackType.HLS,
				} satisfies AddTrack;
			})
			.filter((t) => t !== undefined);
		await TrackPlayer.setQueue(tracks);
		await TrackPlayer.skip(first);
		TrackPlayer.play();
		tracks.forEach((t, i) =>
			TrackPlayer.updateMetadataForTrack(i, { title: t.title }).then(
				() => console.log('updated meta for', t.title),
				() => console.error('Failed to update meta for', t.title),
			),
		);
	};
};
