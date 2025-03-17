import { useViewportSize } from '@mantine/hooks';
import { ReactNode, useMemo, useRef } from 'react';
import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';
import {
	PlaybackManager,
	PlaybackManagerProvider,
	PlayingManagerContext,
} from '../Playback/PlaybackManager';

export const MOBILE_WIDTH = 600;

export const Layout = ({ children }: { children?: ReactNode }) => {
	const { width } = useViewportSize();
	const playbackRef = useRef<PlayingManagerContext>({
		playing: null,
		setPlaying: () => console.log('default setplaying unreachable'),
	});
	const playbackManager = useMemo(() => {
		return <PlaybackManager ref={playbackRef} />;
	}, []);

	if (width <= MOBILE_WIDTH) {
		return (
			<PlaybackManagerProvider ref={playbackRef}>
				<MobileLayout playbackManager={playbackManager}>
					{children}
				</MobileLayout>
			</PlaybackManagerProvider>
		);
	} else {
		return (
			<PlaybackManagerProvider ref={playbackRef}>
				<DesktopLayout playbackManager={playbackManager}>
					{children}
				</DesktopLayout>
			</PlaybackManagerProvider>
		);
	}
};
