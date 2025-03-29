import { RefObject, useEffect, useRef, useState } from 'react';
import { HOST } from '../../api';
import { Song } from '../../types/Song';
import { Source } from '../../types/Source';
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
import { useInterval, useLocalStorage } from '@mantine/hooks';
import { ImageWithFallback } from './ImageWFallback';

export type PlayerState = {
	loopState: 'loop' | 'loop-song';
	playState: 'none' | 'playing' | 'paused';
	shuffle: 'none' | 'shuffle';
	volume: number;
	muted: boolean;
	secondsPlayed: number;
};

type GetSourceRequest = {
	method: string;
	uri: string;
	headers: Record<string, string>;
};

export type SongSource = Source & {
	songId: number;
	request: GetSourceRequest;
};

export type AlbumSource = Source & {
	title: string;
	link: string | null;
	request: GetSourceRequest;
};

type SongCallbacks = {
	playPrev: () => void;
	playNext: () => void;
	peekNext: () => Song | null;
	peekPrev: () => Song | null;
};

const MEDIA_SESSION = 'mediaSession' in navigator;
const LOADED_INTERVAL_MS = 250;
const VOLUME_KEY = 'playback.volume';
const DEFAULT_MEDIA_SESSION_IMAGE =
	'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💣</text></svg>';

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

const uriForSource = (source: { request: GetSourceRequest }) => {
	const uri = source.request.uri;
	const localUri = uri.startsWith('/');
	return localUri ? `${location.protocol}//${HOST}${uri}` : uri;
};

export const Playback = ({
	song,
	albums,
	sources,
	isRestored,
	playerStateRef,
	playNext,
	playPrev,
	peekNext,
	peekPrev,
}: {
	song: Song;
	albums: AlbumSource[] | undefined;
	sources: SongSource[] | undefined;
	isRestored: boolean;
	playerStateRef: RefObject<PlayerState>;
} & SongCallbacks) => {
	const audioRef = useRef<HTMLAudioElement>(new Audio());
	const [duration, setDuration] = useState<number | null>(null);
	const [played, setPlayed] = useState<{ percent: number; seconds: number }>({
		percent: 0,
		seconds: playerStateRef.current.secondsPlayed,
	});
	const [buffered, setBuffered] = useState(0);
	const [playState, setPlayState] = useState<PlayerState['playState']>('none');
	const [loopState, setLoopState] = useState<PlayerState['loopState']>('loop');
	const [shuffle, setShuffle] = useState<PlayerState['shuffle']>('none');
	const [volume, setVolume] = useLocalStorage<PlayerState['volume']>({
		key: 'playback.volume',
		defaultValue: 1,
	});
	const [muted, setMuted] = useState<PlayerState['muted']>(false);
	const songCallbackRefs = useRef<SongCallbacks>({
		peekNext,
		peekPrev,
		playNext,
		playPrev,
	});
	const selectedSource = sources?.[0] ?? null;
	const theme = useMantineTheme();
	const album = albums?.[0];

	const updatePositionState = () => {
		if (MEDIA_SESSION && !isNaN(audioRef.current.duration)) {
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
			...playerStateRef.current,
			playState,
			loopState,
			muted,
			shuffle,
			volume,
		};
	}, [playState, loopState, shuffle, volume, muted]);

	// update song callbacks for handlers
	songCallbackRefs.current = {
		peekNext,
		peekPrev,
		playNext,
		playPrev,
	};

	const { start: startInterval, stop: stopInterval } = useInterval(() => {
		const audio = audioRef.current;

		if (!duration || playState === 'none') {
			setPlayed({ percent: 0, seconds: 0 });
			setBuffered(0);
			return;
		}

		const amountPlayed = audio.currentTime;
		const percentPlayed = (amountPlayed / duration) * 100;
		if (audio.buffered.length) {
			const amountBuffered =
				audio.buffered.end(audio.buffered.length - 1) - audio.buffered.start(0);
			const percentBuffered = (amountBuffered / duration) * 100;
			setBuffered(percentBuffered - percentPlayed);
		}

		setPlayed({ percent: percentPlayed, seconds: amountPlayed });
		playerStateRef.current.secondsPlayed = amountPlayed;
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
					songCallbackRefs.current.playNext();
					return;
				case 'pause':
					audioRef.current.pause();
					return;
				case 'play':
					audioRef.current.play();
					return;
				case 'previoustrack':
					songCallbackRefs.current.playPrev();
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
		audio.preload = 'auto';
		const onLoaded = () => {
			setDuration(audio.duration);
			updatePositionState();
		};
		const onPlay = () => {
			startInterval();
			setPlayState('playing');
			updatePositionState();
			if (MEDIA_SESSION) {
				navigator.mediaSession.playbackState = 'playing';
			}
		};
		const onPause = () => {
			stopInterval();
			setPlayState('paused');
			updatePositionState();
			if (MEDIA_SESSION) {
				navigator.mediaSession.playbackState = 'paused';
			}
		};
		const onEnd = () => {
			if (!audioRef.current.loop) {
				songCallbackRefs.current.playNext();
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

		audio.currentTime = playerStateRef.current.secondsPlayed;
		audio.volume = isRestored
			? Number(localStorage.getItem(VOLUME_KEY) ?? 1)
			: volume;
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
	useEffect(() => {
		if (!selectedSource) return;

		const audio = audioRef.current;
		audio.src = uriForSource(selectedSource);

		if (MEDIA_SESSION) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: song.title,
				artist: `Ibomb's Music`,
				artwork: [
					{
						src: album ? uriForSource(album) : DEFAULT_MEDIA_SESSION_IMAGE,
						type: 'image/svg+xml',
					},
				],
				// TODO: populate other media data (artists, album, album cover)
			});
		}

		audio.currentTime = isRestored ? playerStateRef.current.secondsPlayed : 0;
		audio.volume = isRestored
			? Number(localStorage.getItem(VOLUME_KEY) ?? 1)
			: volume;
		audio.muted = muted;
		audio.play();
	}, [selectedSource?.id]);

	if ((sources && !sources.length) || !selectedSource) {
		return <Text>No sources to play from</Text>;
	}

	return (
		<Box className={classes.base}>
			<Stack gap='xs' align='stretch'>
				<Group wrap='nowrap' align='center'>
					<ImageWithFallback
						src={album ? uriForSource(album) : undefined}
						alt='Album Cover'
					/>
					<Stack gap='xs' flex='1' style={{ overflow: 'hidden' }}>
						<Group gap='xs' align='center' wrap='nowrap'>
							<Badge
								variant='light'
								styles={{ label: { overflow: 'visible' } }}
							>
								{fileTypeFromMime(selectedSource.mimeType)}
							</Badge>
							<Text
								size='lg'
								fw={600}
								ta='left'
								style={{
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
								}}
							>
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
								onClick={() =>
									(audioRef.current.muted = !audioRef.current.muted)
								}
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
									audioRef.current.volume =
										percentOfBar >= 0.97 ? 1 : percentOfBar;
								}}
							/>
						</Group>
					</Stack>
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
						onDoubleClick={() => playPrev()}
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
					<ActionIcon size='xl' radius='xl' onClick={() => playNext()}>
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
