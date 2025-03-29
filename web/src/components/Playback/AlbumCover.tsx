import { Image, Loader } from '@mantine/core';
import { useState } from 'react';
import { TbMusic } from 'react-icons/tb';
import { AlbumSource, uriForSource } from './Playback';
import * as classes from './AlbumCover.css';
import { SongWTags } from '../../utils/maps';
import { openSongDetailModal } from '../SongDetailModal/SongDetailModal';

type Props = {
	song: SongWTags;
	album?: AlbumSource;
	width?: string | number;
	height?: string | number;
	maxHeight?: string | number;
	maxWidth?: string | number;
	canOpenModal?: boolean;
};

export const AlbumCover = ({
	song,
	album,
	width,
	height,
	maxWidth,
	maxHeight,
	canOpenModal,
}: Props) => {
	const [imageLoaded, setImageLoaded] = useState(false);
	const src = album ? uriForSource(album) : undefined;
	const styles = { width, height, maxHeight, maxWidth };

	return (
		<div
			className={classes.container}
			onClick={() => canOpenModal && openSongDetailModal({ song, album })}
			style={{ cursor: canOpenModal ? 'pointer' : undefined }}
		>
			{!src && (
				<div className={classes.noImage} style={styles}>
					<TbMusic size={32} />
				</div>
			)}
			{src && !imageLoaded && (
				<div className={classes.noImage} style={styles}>
					<Loader size='sm' />
				</div>
			)}
			{src && (
				<Image
					src={src}
					alt={`${album!.title} Album Cover`}
					style={imageLoaded ? styles : { display: `none` }}
					className={classes.image}
					onLoadStart={() => setImageLoaded(false)}
					onLoad={() => setImageLoaded(true)}
				/>
			)}
		</div>
	);
};
