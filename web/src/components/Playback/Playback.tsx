import { useRef, useState } from 'react';
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
	TbDeviceSpeaker,
	TbDeviceSpeakerOff,
	TbPlayerPause,
	TbPlayerPlay,
	TbPlayerSkipBackFilled,
	TbPlayerSkipForwardFilled,
	TbRepeat,
	TbRepeatOnce,
} from 'react-icons/tb';
import { useInterval, useShallowEffect } from '@mantine/hooks';

export type PlayerState = {
	loopState: 'loop' | 'loop-song';
	playState: 'none' | 'playing' | 'paused';
	shuffle: 'none' | 'shuffle';
	volume: number;
	muted: boolean;
};

const LOADED_INTERVAL_MS = 250;

const formatSeconds = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60);
	return `${minutes.toFixed(0)}:${(seconds % 60).toFixed(0).padStart(2, '0')}`;
};

const clamp = (n: number, min: number, max: number): number =>
	Math.min(Math.max(n, min), max);

export const Playback = ({
	song,
	nextSong,
	prevSong,
}: {
	song: Song;
	prevSong: (state: PlayerState) => void;
	nextSong: (state: PlayerState) => void;
	peekNext: (state: PlayerState) => Song;
	peekPrev: (state: PlayerState) => Song;
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
	const [volume, setVolume] = useState<PlayerState['volume']>(1);
	const [muted, setMuted] = useState<PlayerState['muted']>(false);
	const theme = useMantineTheme();

	const playerState = (): PlayerState => ({
		loopState,
		playState,
		shuffle,
		volume,
		muted,
	});

	const { start: startInterval, stop: stopInterval } = useInterval(() => {
		const audio = audioRef.current;

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
	}, LOADED_INTERVAL_MS);

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

	// Recreate audio on source changes
	useShallowEffect(() => {
		if (!sources || !sources.length) return;

		audioRef.current = new Audio();
		const audio = audioRef.current;
		for (const source of sources) {
			audio.src = `${location.protocol}//${HOST}/api/sources/${source.id}/data`;
		}

		const onLoaded = () => {
			setDuration(audio.duration);
		};
		const onPlay = () => {
			startInterval();
			setPlayState('playing');
		};
		const onPause = () => {
			stopInterval();
			setPlayState('paused');
		};
		const onEnd = () => {
			if (!audioRef.current.loop) {
				nextSong(playerState());
			}
		};
		const onVolumeChange = () => {
			setVolume(audio.volume);
			setMuted(audio.muted);
		};

		audio.addEventListener('loadeddata', onLoaded);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('ended', onEnd);
		audio.addEventListener('volumechange', onVolumeChange);

		audio.loop = loopState === 'loop-song';

		audio.currentTime = 0;
		audio.volume = volume;
		audio.muted = muted;
		audio.play();

		return () => {
			audio.removeEventListener('loadeddata', onLoaded);
			audio.removeEventListener('play', onPlay);
			audio.removeEventListener('pause', onPause);
			audio.removeEventListener('ended', onEnd);
			audio.removeEventListener('volumechange', onVolumeChange);
			audio.pause();
			audio.src = '';
		};
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
						<Progress.Root
							style={{ cursor: duration ? 'pointer' : undefined }}
							onClick={(e) => {
								if (!duration) return;
								const { x: barX, width: barWidth } =
									e.currentTarget.getBoundingClientRect();
								const posInBar = e.clientX - barX;
								const percentOfBar = clamp(posInBar / barWidth, 0, 1);
								audioRef.current.currentTime = duration * percentOfBar;
							}}
							transitionDuration={LOADED_INTERVAL_MS}
						>
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
				<Group justify='flex-end' px='md' gap='xs'>
					<ActionIcon
						variant='subtle'
						onClick={() => (audioRef.current.muted = !audioRef.current.muted)}
					>
						{!muted ? (
							<TbDeviceSpeaker size={20} />
						) : (
							<TbDeviceSpeakerOff size={20} />
						)}
					</ActionIcon>
					<Progress
						value={muted ? 0 : volume * 100}
						w='60%'
						maw={200}
						h={10}
						radius='xl'
						c={muted ? 'gray' : undefined}
						style={{ cursor: !muted ? 'pointer' : undefined }}
						onClick={(e) => {
							if (muted) return;
							const { x: barX, width: barWidth } =
								e.currentTarget.getBoundingClientRect();
							const posInBar = e.clientX - barX;
							const percentOfBar = clamp(posInBar / barWidth, 0, 1);
							audioRef.current.volume = percentOfBar >= 0.97 ? 1 : percentOfBar;
						}}
					/>
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
