import { useViewportSize } from '@mantine/hooks';
import { ReactNode } from 'react';
import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

export const MOBILE_WIDTH = 600;

export const Layout = ({ children }: { children?: ReactNode }) => {
	const { width } = useViewportSize();

	if (width <= MOBILE_WIDTH) {
		return <MobileLayout>{children}</MobileLayout>;
	} else {
		return <DesktopLayout>{children}</DesktopLayout>;
	}
};
