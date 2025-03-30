import TrackPlayer, {
	AppKilledPlaybackBehavior,
	Capability,
	Event,
	IOSCategory,
	IOSCategoryMode,
	IOSCategoryOptions,
} from 'react-native-track-player';

const serviceHandler = async () => {
	console.log('service handler');
	TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
	TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
	TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
	TrackPlayer.addEventListener(Event.PlaybackError, (e) => console.error(e));
	TrackPlayer.addEventListener(Event.RemoteNext, () => {
		console.log('remote next');
		TrackPlayer.skipToNext();
	});
	TrackPlayer.addEventListener(Event.RemotePrevious, () =>
		TrackPlayer.skipToPrevious(),
	);
	TrackPlayer.addEventListener(Event.RemoteSeek, (e) =>
		TrackPlayer.seekTo(e.position),
	);
};

export const registerPlayerService = () => {
	console.log('registered service factory');
	TrackPlayer.registerPlaybackService(() => serviceHandler);
};

export const registerPlayer = async (): Promise<void> => {
	await TrackPlayer.setupPlayer({
		iosCategory: IOSCategory.Playback,
		iosCategoryMode: IOSCategoryMode.Default,
		iosCategoryOptions: [IOSCategoryOptions.DuckOthers],
	});
	await TrackPlayer.updateOptions({
		android: {
			appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
		},
		capabilities: [
			Capability.Play,
			Capability.Pause,
			Capability.SkipToNext,
			Capability.SkipToPrevious,
		],
	});
};
