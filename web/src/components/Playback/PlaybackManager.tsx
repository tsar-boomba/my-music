import {
	createContext,
	ReactNode,
	RefObject,
	useContext,
	useMemo,
	useRef,
} from 'react';
import { Song } from '../../types/Song';
import { AlbumSource, Playback, PlayerState, SongSource } from './Playback';
import { useInterval, useLocalStorage } from '@mantine/hooks';
import useSWR from 'swr';
import { apiFetcher } from '../../api';
import { useSongs } from '../../utils/maps';

export type SessionInit = {
	songs: Song[];
	start: number;
};

export type PlayingManagerContext = {
	startSession: (session: SessionInit) => void;
	playing: Song | null;
};

const shuffleArray = <T extends unknown>(array: T[]): T[] => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]]; // Swap elements
	}
	return array;
};

const playbackContext = createContext<{
	playing: () => Song | null;
	startSession: (session: SessionInit) => void;
}>({
	playing: () => null,
	startSession: (_) => console.log('default setPlaying unreachable'),
});

export const usePlayback = () => useContext(playbackContext);

export const PlaybackManagerProvider = ({
	children,
	ref,
}: {
	children: ReactNode;
	ref: RefObject<PlayingManagerContext>;
}) => {
	return (
		<playbackContext.Provider
			value={{
				playing: () => ref.current.playing,
				startSession: (session: SessionInit) =>
					ref.current.startSession(session),
			}}
		>
			{children}
		</playbackContext.Provider>
	);
};

export const PlaybackManager = ({
	ref,
}: {
	ref: RefObject<PlayingManagerContext>;
}) => {
	const [songs, setSongs] = useLocalStorage<Song[]>({
		key: 'session.songs',
		defaultValue: [],
		serialize: JSON.stringify,
		deserialize: (v) => JSON.parse(v ?? '[]'),
	});
	const [playing, setPlaying] = useLocalStorage({
		key: 'session.playing',
		defaultValue: 0,
	});
	const song: Song | null = songs[playing] ?? null;
	const { songs: allSongs } = useSongs();
	const { data: allSources } = useSWR<SongSource[]>(
		'/songs/sources',
		apiFetcher,
	);
	const { data: allAlbums } = useSWR<AlbumSource[]>(
		'/albums/sources',
		apiFetcher,
	);
	const playerStateRef = useRef<PlayerState>({
		playState: 'none',
		loopState: 'loop',
		muted: false,
		shuffle: 'none',
		volume: 1,
		secondsPlayed: Number(localStorage.getItem('player.secondsPlayed')),
	});
	const isRestored = useRef(true);

	ref.current.startSession = (session) => {
		setSongs(session.songs);
		setPlaying(Math.max(Math.min(session.songs.length - 1, session.start), 0));
		isRestored.current = false;
	};
	ref.current.playing = song;

	useInterval(
		() => {
			localStorage.setItem(
				'player.secondsPlayed',
				playerStateRef.current.secondsPlayed.toString(),
			);
		},
		1000,
		{ autoInvoke: true },
	);
	const normalIndices = useMemo(() => Array.from(songs.keys()), [songs]);
	const shuffledIndices = useMemo(
		() => shuffleArray(Array.from(songs.keys())),
		[songs],
	);

	if (!songs.length || !song || !allSongs || !allSources || !allAlbums) {
		return null;
	}

	const tags = allSongs.get(song.id)?.tags;

	if (!tags) {
		return null;
	}

	const playerState = playerStateRef.current;
	const nextIndex = (shuffle: boolean) => {
		const source = shuffle ? shuffledIndices : normalIndices;
		return source[(playing + 1) % source.length];
	};

	const prevIndex = (shuffle: boolean) => {
		const source = shuffle ? shuffledIndices : normalIndices;
		return source[playing - 1 < 0 ? source.length - 1 : playing - 1];
	};

	return (
		<div>
			<Playback
				song={song}
				isRestored={isRestored.current}
				albums={allAlbums.filter((a) => tags.includes(a.title))}
				sources={allSources.filter((s) => s.songId === song.id)}
				playerStateRef={playerStateRef}
				playNext={() => {
					isRestored.current = false;
					setPlaying(nextIndex(playerState.shuffle === 'shuffle'));
				}}
				playPrev={() => {
					isRestored.current = false;
					setPlaying(prevIndex(playerState.shuffle === 'shuffle'));
				}}
				peekNext={() => {
					return songs[nextIndex(playerState.shuffle === 'shuffle')];
				}}
				peekPrev={() => {
					return songs[prevIndex(playerState.shuffle === 'shuffle')];
				}}
			/>
		</div>
	);
};
