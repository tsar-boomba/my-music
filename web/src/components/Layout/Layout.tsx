import { useViewportSize } from '@mantine/hooks';
import { ReactNode, useMemo, useRef } from 'react';
import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';
import {
	PlaybackManager,
	PlayingManagerContext,
} from '../Playback/PlaybackManager';

export const MOBILE_WIDTH = 600;

export const Layout = ({ children }: { children?: ReactNode }) => {
	const { width } = useViewportSize();
	const playbackRef = useRef<PlayingManagerContext>({
		playing: null,
		setPlaying: () => {},
	});
	const playbackManager = useMemo(
		() => <PlaybackManager ref={playbackRef.current} />,
		[],
	);

	if (width <= MOBILE_WIDTH) {
		return (
			<MobileLayout playbackRef={playbackRef.current} playbackManager={playbackManager}>{children}</MobileLayout>
		);
	} else {
		return (
			<DesktopLayout
				playbackRef={playbackRef.current}
				playbackManager={playbackManager}
			>
				{children}
			</DesktopLayout>
		);
	}
};
