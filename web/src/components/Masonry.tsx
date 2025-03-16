import { useViewportSize } from '@mantine/hooks';
import {
	MasonryScroller,
	MasonryScrollerProps,
	useContainerPosition,
	usePositioner,
	UsePositionerOptions,
	useResizeObserver,
	useScrollToIndex,
	UseScrollToIndexOptions,
} from 'masonic';
import { createElement, useEffect, useRef } from 'react';

/**
 * A "batteries included" masonry grid which includes all of the implementation details below. This component is the
 * easiest way to get off and running in your app, before switching to more advanced implementations, if necessary.
 * It will change its column count to fit its container's width and will decide how many rows to render based upon
 * the height of the browser `window`.
 *
 * @param props
 */
export function Masonry<Item>(props: MasonryProps<Item>) {
	const containerRef = useRef<null | HTMLElement>(null);
	const { width, height } = useViewportSize();
	const containerPos = useContainerPosition(containerRef, [width, height]);
	const nextProps = Object.assign(
		{
			offset: containerPos.offset,
			width: containerPos.width || width,
			height: height,
			containerRef,
		},
		props,
	) as any;
	// Workaround for https://github.com/jaredLunde/masonic/issues/12
	const itemCounter = useRef<number>(props.items.length);
	let shrunk = false;
	if (props.items.length !== itemCounter.current) {
		if (props.items.length < itemCounter.current) shrunk = true;
		itemCounter.current = props.items.length;
	}

	nextProps.positioner = usePositioner(nextProps, [shrunk && Math.random()]);
	nextProps.resizeObserver = useResizeObserver(nextProps.positioner);
	const scrollToIndex = useScrollToIndex(nextProps.positioner, {
		height: nextProps.height,
		offset: containerPos.offset,
		align:
			typeof props.scrollToIndex === 'object'
				? props.scrollToIndex.align
				: void 0,
	});
	const index =
		props.scrollToIndex &&
		(typeof props.scrollToIndex === 'number'
			? props.scrollToIndex
			: props.scrollToIndex.index);

	useEffect(() => {
		if (index !== void 0) scrollToIndex(index);
	}, [index, scrollToIndex]);

	return createElement(MasonryScroller, nextProps);
}

export interface MasonryProps<Item>
	extends Omit<
			MasonryScrollerProps<Item>,
			'offset' | 'width' | 'height' | 'containerRef' | 'positioner'
		>,
		Pick<
			UsePositionerOptions,
			| 'columnWidth'
			| 'columnGutter'
			| 'rowGutter'
			| 'columnCount'
			| 'maxColumnCount'
		> {
	/**
	 * Scrolls to a given index within the grid. The grid will re-scroll
	 * any time the index changes.
	 */
	scrollToIndex?:
		| number
		| {
				index: number;
				align: UseScrollToIndexOptions['align'];
		  };
	/**
	 * This is the width that will be used for the browser `window` when rendering this component in SSR.
	 * This prop isn't relevant for client-side only apps.
	 */
	ssrWidth?: number;
	/**
	 * This is the height that will be used for the browser `window` when rendering this component in SSR.
	 * This prop isn't relevant for client-side only apps.
	 */
	ssrHeight?: number;
	/**
	 * This determines how often (in frames per second) to update the scroll position of the
	 * browser `window` in state, and as a result the rate the masonry grid recalculates its visible cells.
	 * The default value of `12` has been very reasonable in my own testing, but if you have particularly
	 * heavy `render` components it may be prudent to reduce this number.
	 *
	 * @default 12
	 */
	scrollFps?: number;
}
