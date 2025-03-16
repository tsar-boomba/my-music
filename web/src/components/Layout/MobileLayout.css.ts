import { style } from '@vanilla-extract/css';
import { vars } from '../../theme';

export const bottom = style({
	backgroundColor:
		'light-dark(var(--mantine-color-body), var(--mantine-color-body))',
	boxShadow: vars.shadows.xl,
});
