import { Image, Loader } from '@mantine/core';
import { useRef, useState } from 'react';
import { TbMusic } from 'react-icons/tb';
import { image, noImage } from './Playback.css';

type Props = {
	src?: string;
	alt?: string;
};

export const ImageWithFallback = ({ src, alt }: Props) => {
	const [imageLoaded, setImageLoaded] = useState(false);
	const prevSrc = useRef(src);
	if (prevSrc.current !== src) {
		// src changed
		setImageLoaded(false);
	}
	prevSrc.current = src;

	return (
		<>
			{!src && (
				<div className={noImage}>
					<TbMusic size={32} />
				</div>
			)}
			{src && !imageLoaded && (
				<div className={noImage}>
					<Loader size='sm' />
				</div>
			)}
			<Image
				src={src}
				alt={alt}
				style={imageLoaded ? {} : { display: `none` }}
				className={image}
				onLoad={() => setImageLoaded(true)}
			/>
		</>
	);
};
