import { useEffect, useRef, useState } from 'react';
import { apiFetcher, HOST } from '../../api';
import { Song } from '../../types/Song';
import { Source } from '../../types/Source';
import useSWR from 'swr';
import {
	ActionIcon,
	Badge,
	Box,
	Group,
	Progress,
	Stack,
	Text,
	useMantineTheme,
} from '@mantine/core';
import * as classes from './Playback.css';
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

const MEDIA_SESSION = 'mediaSession' in navigator;
const LOADED_INTERVAL_MS = 250;

const formatSeconds = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60);
	return `${minutes.toFixed(0)}:${(seconds % 60).toFixed(0).padStart(2, '0')}`;
};

const clamp = (n: number, min: number, max: number): number =>
	Math.min(Math.max(n, min), max);

const fileTypeFromMime = (mimeType: string): string => {
	const [_, fileType] = mimeType.split('/');
	if (fileType === 'mpeg') return 'mp3';
	return fileType;
};

export const Playback = ({
	song,
	nextSong,
	prevSong,
}: {
	song: Song;
	prevSong: (state: PlayerState) => void;
	nextSong: (state: PlayerState) => void;
	peekNext: (state: PlayerState) => Song | null;
	peekPrev: (state: PlayerState) => Song | null;
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
	const [selectedSource, setSelectedSource] = useState<Source | null>(null);
	// Allow things outside of react to have an accurate view of the player state
	const playerStateRef = useRef<PlayerState>({
		playState,
		loopState,
		muted,
		shuffle,
		volume,
	});
	const theme = useMantineTheme();

	const playerState = (): PlayerState => ({ ...playerStateRef.current });

	const updatePositionState = () => {
		if (MEDIA_SESSION) {
			navigator.mediaSession.setPositionState({
				duration: audioRef.current.duration,
				position: audioRef.current.currentTime,
				playbackRate: audioRef.current.playbackRate,
			});
		}
	};

	// update player state ref
	useEffect(() => {
		playerStateRef.current = {
			playState,
			loopState,
			muted,
			shuffle,
			volume,
		};
	}, [playState, loopState, shuffle, volume, muted]);

	const { start: startInterval, stop: stopInterval } = useInterval(() => {
		const audio = audioRef.current;
		updatePositionState();

		if (!duration || playState === 'none') {
			setPlayed({ percent: 0, seconds: 0 });
			setBuffered(0);
			return;
		}

		const amountPlayed = audio.currentTime;
		const percentPlayed = (amountPlayed / duration) * 100;
		if (audio.buffered.length) {
			const amountBuffered = audio.buffered.end(0) - audio.buffered.start(0);
			const percentBuffered = (amountBuffered / duration) * 100;
			setBuffered(percentBuffered - percentPlayed);
		}

		setPlayed({ percent: percentPlayed, seconds: amountPlayed });
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

	// Handle events from media session
	useEffect(() => {
		if (!MEDIA_SESSION) return;

		const handler: MediaSessionActionHandler = ({
			action,
			seekOffset,
			seekTime,
		}) => {
			switch (action) {
				case 'stop':
					console.warn('unimplemented stop action');
					return;
				case 'nexttrack':
					nextSong(playerState());
					return;
				case 'pause':
					audioRef.current.pause();
					return;
				case 'play':
					audioRef.current.play();
					return;
				case 'previoustrack':
					prevSong(playerState());
					return;
				case 'seekbackward':
					audioRef.current.currentTime -= seekOffset ?? 10;
					return;
				case 'seekforward':
					audioRef.current.currentTime += seekOffset ?? 10;
					return;
				case 'seekto':
					audioRef.current.currentTime = seekTime ?? 0;
					return;
				case 'skipad':
					console.warn('unimplemented skip ad');
			}
		};

		const actions: MediaSessionAction[] = [
			'nexttrack',
			'pause',
			'play',
			'previoustrack',
			'seekbackward',
			'seekforward',
			'seekto',
		];

		actions.forEach((action) =>
			navigator.mediaSession.setActionHandler(action, handler),
		);

		return () =>
			actions.forEach((action) =>
				navigator.mediaSession.setActionHandler(action, null),
			);
	}, []);

	// Set up listeners for audio element
	useEffect(() => {
		const audio = audioRef.current;
		const onLoaded = () => {
			setDuration(audio.duration);
			updatePositionState();
		};
		const onPlay = () => {
			startInterval();
			setPlayState('playing');
			if (MEDIA_SESSION) {
				navigator.mediaSession.playbackState = 'playing';
				updatePositionState();
			}
		};
		const onPause = () => {
			stopInterval();
			setPlayState('paused');
			if (MEDIA_SESSION) {
				navigator.mediaSession.playbackState = 'paused';
				updatePositionState();
			}
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
		const onCanPlay = () => {
			audio.play();
			updatePositionState();
		};

		audio.addEventListener('loadeddata', onLoaded);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('ended', onEnd);
		audio.addEventListener('volumechange', onVolumeChange);
		audio.addEventListener('canplay', onCanPlay);

		audio.loop = loopState === 'loop-song';

		audio.currentTime = 0;
		audio.volume = volume;
		audio.muted = muted;

		return () => {
			audio.removeEventListener('loadeddata', onLoaded);
			audio.removeEventListener('play', onPlay);
			audio.removeEventListener('pause', onPause);
			audio.removeEventListener('ended', onEnd);
			audio.removeEventListener('volumechange', onVolumeChange);
			audio.removeEventListener('canplay', onCanPlay);
			audio.pause();
			audio.src = '';
		};
	}, []);

	// Handle song/source changes
	useShallowEffect(() => {
		if (!sources || !sources.length) return;

		const audio = audioRef.current;
		audio.src = `${location.protocol}//${HOST}/api/sources/${sources[0].id}/data`;
		setSelectedSource(sources[0]);
		if (MEDIA_SESSION) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: song.title,
				artist: `Ibomb's Music`,
				artwork: [
					{
						src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💣</text></svg>',
						type: 'image/svg+xml',
					},
				],
				// TODO: populate other media data (artists, album, album cover)
			});
		}

		audio.currentTime = 0;
		audio.play();
	}, [sources]);

	if (error) {
		console.error(error);
	}

	if ((sources && !sources.length) || !selectedSource) {
		return <Text>No sources to play from</Text>;
	}

	return (
		<Box className={classes.base}>
			<Stack gap='xs' align='stretch'>
				<Group gap='xs' align='center'>
					<Badge variant='light'>
						{fileTypeFromMime(selectedSource.mimeType)}
					</Badge>
					<Text size='lg' fw={600} ta='left' style={{ whiteSpace: 'nowrap' }}>
						{song.title}
					</Text>
				</Group>
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
		</Box>
	);
};
