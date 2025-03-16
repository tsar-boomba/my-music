import { style } from '@vanilla-extract/css';
import { vars } from '../../theme';

export const icon = style({
	pointerEvents: 'none',
	zIndex: 1,
	color: vars.colors.gray[6],

	selectors: {
		[vars.darkSelector]: {
			color: vars.colors.white,
		},
	},
});
