import { useEffect, useRef, useState } from 'react';
import { apiFetcher, HOST } from '../../api';
import { Song } from '../../types/Song';
import { Source } from '../../types/Source';
import useSWR from 'swr';
import {
	ActionIcon,
	Group,
	Paper,
	Progress,
	Stack,
	Text,
	useMantineTheme,
} from '@mantine/core';
import {
	TbArrowsShuffle,
	TbArrowsShuffle2,
	TbPlayerPause,
	TbPlayerPlay,
	TbPlayerSkipBackFilled,
	TbPlayerSkipForwardFilled,
	TbRepeat,
	TbRepeatOnce,
} from 'react-icons/tb';
import { useShallowEffect } from '@mantine/hooks';

export type PlayerState = {
	loopState: 'loop' | 'loop-song';
	playState: 'none' | 'playing' | 'paused';
	shuffle: 'none' | 'shuffle';
};

const formatSeconds = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60);
	return `${minutes.toFixed(0)}:${(seconds % 60).toFixed(0).padStart(2, '0')}`;
};

export const Playback = ({
	song,
	nextSong,
	prevSong,
}: {
	song: Song;
	prevSong: (state: PlayerState) => void;
	nextSong: (state: PlayerState) => void;
}) => {
	const { data: sources, error } = useSWR<Source[]>(
		`/songs/${song.id}/sources`,
		apiFetcher,
	);
	const audioRef = useRef<HTMLAudioElement>(new Audio());
	const [duration, setDuration] = useState<number | null>(null);
	const [played, setPlayed] = useState<{ percent: number; seconds: number }>({
		percent: 0,
		seconds: 0,
	});
	const [buffered, setBuffered] = useState(0);
	const [playState, setPlayState] = useState<PlayerState['playState']>('none');
	const [loopState, setLoopState] =
		useState<PlayerState['loopState']>('loop-song');
	const [shuffle, setShuffle] = useState<PlayerState['shuffle']>('none');
	const theme = useMantineTheme();

	const playerState = (): PlayerState => ({ loopState, playState, shuffle });

	const togglePlayState = () => {
		switch (playState) {
			case 'none':
				audioRef.current?.play();
				break;
			case 'playing':
				audioRef.current?.pause();
				break;
			case 'paused':
				audioRef.current?.play();
		}
	};

	const changeLoopState = () => {
		setLoopState((prev) => {
			switch (prev) {
				case 'loop':
					audioRef.current!.loop = true;
					return 'loop-song';
				case 'loop-song':
					audioRef.current!.loop = false;
					return 'loop';
			}
		});
	};

	const changeShuffle = () => {
		setShuffle((prev) => {
			switch (prev) {
				case 'shuffle':
					return 'none';
				case 'none':
					return 'shuffle';
			}
		});
	};

	useEffect(() => {
		const audio = audioRef.current;
		const onLoaded = () => {
			setDuration(audio.duration);
		};

		const onPlay = () => {
			setPlayState('playing');
		};

		const onPause = () => {
			setPlayState('paused');
		};

		const onTimeUpdate = () => {
			if (!duration || playState === 'none') {
				setPlayed({ percent: 0, seconds: 0 });
				setBuffered(0);
				return;
			}

			const amountPlayed = audio.currentTime;
			const percentPlayed = (amountPlayed / duration) * 100;
			const amountBuffered = audio.buffered.end(0) - audio.buffered.start(0);
			const percentBuffered = (amountBuffered / duration) * 100;

			setPlayed({ percent: percentPlayed, seconds: amountPlayed });
			setBuffered(percentBuffered - percentPlayed);
		};
		const onEnd = () => {
			if (loopState !== 'loop-song') {
				nextSong(playerState());
				audio.play();
			}
		};

		audio.addEventListener('loadeddata', onLoaded);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('ended', onEnd);
		audio.addEventListener('timeupdate', onTimeUpdate);

		if (playState === 'playing') {
			audio.play();
		}

		if (loopState === 'loop-song') {
			audio.loop = true;
		}

		return () => {
			audio.removeEventListener('loadeddata', onLoaded);
			audio.removeEventListener('play', onPlay);
			audio.removeEventListener('pause', onPause);
			audio.removeEventListener('ended', onEnd);
			audio.removeEventListener('timeupdate', onTimeUpdate);
			audio.pause();
			audio.src = '';
		};
	}, []);

	useShallowEffect(() => {
		if (!sources || !sources.length) return;

		console.log('sources update:', sources);
		for (const source of sources) {
			audioRef.current.src = `${location.protocol}//${HOST}/api/sources/${source.id}/data`;
		}

		audioRef.current.currentTime = 0;
		audioRef.current.play();
	}, [sources]);

	if (error) {
		console.error(error);
	}

	if (sources && !sources.length) {
		return <Text>No sources to play from</Text>;
	}

	return (
		<Paper>
			<Stack gap='xs' align='stretch'>
				<Text ta='left' px='xs' style={{ whiteSpace: 'nowrap' }}>
					{song.title}
				</Text>
				<Group align='center' justify='center' gap='xs'>
					<Text w={48} ta='right' c='dimmed' size='sm'>
						{formatSeconds(played.seconds)}
					</Text>
					<div style={{ flexGrow: 1 }}>
						<Progress.Root>
							<Progress.Section value={played.percent} />
							<Progress.Section
								value={buffered}
								color={theme.colors[theme.primaryColor][2]}
							/>
						</Progress.Root>
					</div>
					<Text w={48} ta='left' c='dimmed' size='sm'>
						{duration ? formatSeconds(duration) : '--:--'}
					</Text>
				</Group>
				<Group justify='center'>
					<ActionIcon size='xl' radius='xl' onClick={changeShuffle}>
						{shuffle === 'shuffle' ? <TbArrowsShuffle2 /> : <TbArrowsShuffle />}
					</ActionIcon>
					<ActionIcon
						size='xl'
						radius='xl'
						onClick={() => {
							audioRef.current.currentTime = 0;
						}}
						onDoubleClick={() => prevSong(playerState())}
					>
						<TbPlayerSkipBackFilled />
					</ActionIcon>
					<ActionIcon size={54} radius='xl' onClick={togglePlayState}>
						{playState === 'none' ? (
							<TbPlayerPlay size={28} />
						) : playState === 'playing' ? (
							<TbPlayerPause size={28} />
						) : (
							<TbPlayerPlay size={28} />
						)}
					</ActionIcon>
					<ActionIcon
						size='xl'
						radius='xl'
						onClick={() => nextSong(playerState())}
					>
						<TbPlayerSkipForwardFilled />
					</ActionIcon>
					<ActionIcon size='xl' radius='xl' onClick={changeLoopState}>
						{loopState === 'loop' ? <TbRepeat /> : <TbRepeatOnce />}
					</ActionIcon>
				</Group>
			</Stack>
		</Paper>
	);
};
