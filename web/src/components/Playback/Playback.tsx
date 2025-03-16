import { useEffect, useRef, useState } from 'react';
import { apiFetcher, HOST } from '../../api';
import { Song } from '../../types/Song';
import { Source } from '../../types/Source';
import useSWR from 'swr';
import {
	ActionIcon,
	Group,
	Progress,
	Stack,
	Text,
	useMantineTheme,
} from '@mantine/core';
import {
	TbArrowsShuffle,
	TbPlayerPause,
	TbPlayerPlay,
	TbRepeat,
	TbRepeatOff,
	TbRepeatOnce,
} from 'react-icons/tb';
import { useInterval, useShallowEffect } from '@mantine/hooks';

const LOADED_INTERVAL_MS = 250;

const formatSeconds = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60);
	return `${minutes.toFixed(0)}:${(seconds % 60).toFixed(0).padStart(2, '0')}`;
};

export const Playback = ({ song }: { song: Song }) => {
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
	const [playState, setPlayState] = useState<'none' | 'playing' | 'paused'>(
		'none',
	);
	const [loopState, setLoopState] = useState<'none' | 'loop' | 'loop-song'>(
		'loop-song',
	);
	const theme = useMantineTheme();

	const { start: startInterval, stop: stopInterval } = useInterval(() => {
		if (!audioRef.current) return;
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
		if (!audioRef.current) return;
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
				case 'none':
					audioRef.current!.loop = false;
					return 'loop';
				case 'loop':
					audioRef.current!.loop = true;
					return 'loop-song';
				case 'loop-song':
					audioRef.current!.loop = false;
					return 'none';
			}
		});
	};

	useEffect(() => {
		if (!audioRef.current) return;

		const audio = audioRef.current;
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
			
		};

		audio.addEventListener('loadeddata', onLoaded);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('ended', onEnd);

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
		};
	}, []);

	useShallowEffect(() => {
		if (!sources || !sources.length) return;

		audioRef.current.srcObject
		for (const source of sources) {
			audioRef.current.src = `${location.protocol}//${HOST}/api/sources/${source.id}/data`
		}
	}, [sources]);

	if (error) {
		console.error(error);
	}

	if (sources && !sources.length) {
		return <Text>No sources to play from</Text>;
	}

	return (
		<Stack gap='xs' align='stretch'>
			<Group align='center' justify='center' gap='xs'>
				<Text w={48} ta='right' c='dimmed' size='sm'>
					{formatSeconds(played.seconds)}
				</Text>
				<div style={{ flexGrow: 1 }}>
					<Progress.Root transitionDuration={LOADED_INTERVAL_MS}>
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
				<ActionIcon>
					<TbArrowsShuffle />
				</ActionIcon>
				<ActionIcon onClick={togglePlayState}>
					{playState === 'none' ? (
						<TbPlayerPlay />
					) : playState === 'playing' ? (
						<TbPlayerPause />
					) : (
						<TbPlayerPlay />
					)}
				</ActionIcon>
				<ActionIcon onClick={changeLoopState}>
					{loopState === 'none' ? (
						<TbRepeatOff />
					) : loopState === 'loop' ? (
						<TbRepeat />
					) : (
						<TbRepeatOnce />
					)}
				</ActionIcon>
			</Group>
		</Stack>
	);
};
