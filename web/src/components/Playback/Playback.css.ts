import { style } from "@vanilla-extract/css";
import { vars } from "../../theme";

export const base = style({
	backgroundColor:
		'light-dark(var(--mantine-color-body), var(--mantine-color-body))',
	boxShadow: vars.shadows.sm,
	borderTop: `1px solid ${vars.colors.dark[4]}`,
	[vars.lightSelector]: {
		borderTop: `1px solid ${vars.colors.gray[3]}`,
	},
	paddingBottom: vars.spacing.xs,
	paddingTop: vars.spacing.xs,
	pointerEvents: 'auto',
});
