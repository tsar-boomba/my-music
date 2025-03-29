import { style } from '@vanilla-extract/css';
import { vars } from '../../theme';

export const container = style({
	position: 'relative',
});

export const image = style({
	borderRadius: vars.radius.md,
	border: `1px solid ${vars.colors.dark[4]}`,
	[vars.lightSelector]: {
		border: `1px solid ${vars.colors.gray[3]}`,
	},
	boxShadow: vars.shadows.sm,
	height: 100,
	width: 100,
	'@media': {
		[vars.smallerThan('sm')]: {
			height: 60,
			width: 60,
		},
	},
});

export const noImage = style({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	borderRadius: vars.radius.md,
	height: 100,
	width: 100,
	border: `1px solid ${vars.colors.dark[4]}`,
	background: vars.colors.dark[8],
	[vars.lightSelector]: {
		border: `1px solid ${vars.colors.gray[3]}`,
		background: vars.colors.white,
	},
	'@media': {
		[vars.smallerThan('sm')]: {
			height: 60,
			width: 60,
		},
	},
});
