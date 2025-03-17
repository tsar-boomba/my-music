import { createContext, ReactNode, useContext, useState } from 'react';
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
} & { ref: PlayingManagerContext}) => {
	return (
		<playbackContext.Provider
			value={{
				playing: () => ref.playing,
				setPlaying: ref.setPlaying,
			}}
		>
			{children}
		</playbackContext.Provider>
	);
};

export const PlaybackManager = ({
	ref
}: {ref: PlayingManagerContext}) => {
	const { data: songs } = useSWR<Song[]>('/songs', apiFetcher);
	const [song, setSong] = useState<Song | null>(null);
	ref.setPlaying = setSong;
	ref.playing = song;
	console.log(song);

	if (!songs || !songs.length || !song) {
		return null;
	}

	const songIdx = songs.findIndex((s) => s.id === song.id);
	let nextSong = songs[songIdx + 1 >= songs.length ? 0 : songIdx + 1];
	let prevSong = songs[songIdx - 1 < 0 ? songs.length - 1 : songIdx - 1];

	return (
		<div>
			<Playback song={song} nextSong={(state) => {
				if (state.shuffle !== 'shuffle') {
					setSong(nextSong);
					return;
				}

				setSong(songs[Math.floor(Math.random() * songs.length)]);
			}} prevSong={(state) => {
				if (state.shuffle !== 'shuffle') {
					setSong(prevSong);
					return;
				}

				setSong(songs[Math.floor(Math.random() * songs.length)]);
			}} />
		</div>
	);
};
