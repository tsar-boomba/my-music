import {
	createContext,
	ReactNode,
	RefObject,
	useContext,
	useState,
} from 'react';
import { Song } from '../../types/Song';
import { Playback } from './Playback';
import useSWR from 'swr';
import { apiFetcher } from '../../api';

export type PlayingManagerContext = {
	setPlaying: (song: Song | null) => void;
	playing: Song | null;
};

const playbackContext = createContext<{
	playing: () => Song | null;
	setPlaying: (song: Song | null) => void;
}>({
	playing: () => null,
	setPlaying: (_) => console.log('default setPlaying unreachable'),
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
				setPlaying: (song: Song | null) => ref.current.setPlaying(song),
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
	const { data: songs } = useSWR<Song[]>('/songs', apiFetcher);
	const [song, setSong] = useState<Song | null>(null);
	ref.current.setPlaying = setSong;
	ref.current.playing = song;

	if (!songs || !songs.length || !song) {
		return null;
	}

	return (
		<div>
			<Playback
				song={song}
				nextSong={(state) => {
					if (!ref.current.playing) return;
					if (state.shuffle !== 'shuffle') {
						const songIdx = songs.findIndex(
							(s) => s.id === ref.current.playing!.id,
						);
						const nextSong =
							songs[songIdx + 1 >= songs.length ? 0 : songIdx + 1];
						setSong(nextSong);
						return;
					}

					setSong(songs[Math.floor(Math.random() * songs.length)]);
				}}
				prevSong={(state) => {
					if (!ref.current.playing) return;
					if (state.shuffle !== 'shuffle') {
						const songIdx = songs.findIndex(
							(s) => s.id === ref.current.playing!.id,
						);
						const prevSong =
							songs[songIdx - 1 < 0 ? songs.length - 1 : songIdx - 1];
						setSong(prevSong);
						return;
					}

					setSong(songs[Math.floor(Math.random() * songs.length)]);
				}}
				peekNext={() => {
					if (!ref.current.playing) return null;
					const songIdx = songs.findIndex(
						(s) => s.id === ref.current.playing!.id,
					);
					return songs[songIdx + 1 >= songs.length ? 0 : songIdx + 1]!;
				}}
				peekPrev={() => {
					if (!ref.current.playing) return null;
					const songIdx = songs.findIndex(
						(s) => s.id === ref.current.playing!.id,
					);
					return songs[songIdx - 1 < 0 ? songs.length - 1 : songIdx - 1];
				}}
			/>
		</div>
	);
};
