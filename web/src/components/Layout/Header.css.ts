import { vars } from '../../theme';
import { style } from '@vanilla-extract/css';

export const root = style({
	height: 60,
	width: '100vw',
	position: 'fixed',
	top: 0,
	left: 0,
	zIndex: 2,
	borderRadius: 0,
});

export const header = style({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
	height: '100%',
	position: 'relative',
	width: '100%',
});

export const title = style({
	fontFamily: `Greycliff CF, ${vars.fontFamily}`,
	fontSize: 30,
	fontWeight: 900,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	wordWrap: 'break-word',
	lineHeight: '30px',
	maxHeight: 30,
	margin: 0,
	padding: 0,
	color: vars.colors.black,

	selectors: {
		[vars.darkSelector]: {
			color: vars.colors.white,
		},
	},

	'@media': {
		[vars.smallerThan('xs')]: {
			fontSize: 24,
		},
	},
});

const BREAKPOINT = 650;

export const mobileOnly = style({
	'@media': {
		[vars.largerThan(BREAKPOINT + 1)]: {
			display: 'none',
		},
	},
});

export const desktopOnly = style({
	'@media': {
		[vars.smallerThan(BREAKPOINT)]: {
			display: 'none',
		},
	},
});

export const mobileMenu = style({
	display: 'flex',
	flexDirection: 'column',
	position: 'absolute',
	top: '60px',
	width: '100%',
	left: 0,
	zIndex: 1,
	backgroundColor: vars.colors.white,
	borderTopLeftRadius: 0,
	borderTopRightRadius: 0,

	selectors: {
		[vars.darkSelector]: {
			backgroundColor: vars.colors.dark[7],
		},
	},

	'@media': {
		[vars.largerThan(BREAKPOINT)]: {
			display: 'none',
		},
	},
});

export const linkClass = style({
	display: 'block',
	lineHeight: 1,
	padding: '8px 12px',
	borderRadius: vars.radius.sm,
	textDecoration: 'none',
	fontSize: vars.fontSizes.sm,
	fontWeight: 500,
	color: vars.colors.gray[7],

	':hover': {
		backgroundColor: vars.colors.gray[0],
	},

	selectors: {
		[vars.darkSelector]: {
			color: vars.colors.dark[0],
		},
		[vars.darkSelector + ':hover']: {
			backgroundColor: vars.colors.dark[6],
		},
	},
});

export const linkActive = style({
	selectors: {
		'&, &:hover': {
			backgroundColor: vars.colors.primaryColors.light,
			color: vars.colors.primaryColors.lightColor,
		},
	},
});
