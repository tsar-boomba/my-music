import React, { useEffect, useRef, useState } from 'react';
import {
	Container,
	Group,
	Burger,
	Text,
	useMantineTheme,
	Collapse,
	Paper,
} from '@mantine/core';
import { useToggle } from '@mantine/hooks';
import { ThemeToggle } from './ThemeToggle';
import { TbExternalLink } from 'react-icons/tb';
import {
	desktopOnly,
	header,
	mobileMenu,
	mobileOnly,
	root,
	title,
	linkActive,
	linkClass,
} from './Header.css';
import { Link } from 'react-router';

interface HeaderSimpleProps {
	links: { link: string; label: string }[];
}

const CLICK_OUT_EVENTS: (keyof DocumentEventMap)[] = [
	'touchstart',
	'mousedown',
];

const Header: React.FC<HeaderSimpleProps> = ({ links }) => {
	const [opened, toggleOpened] = useToggle([false, true]);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState<string | undefined>(undefined);
	const theme = useMantineTheme();

	const updateLinkActive = () => {
		setTimeout(
			() =>
				setActive(links.find((link) => link.link === location.pathname)?.link),
			0,
		);
	};

	useEffect(updateLinkActive, []);

	useEffect(() => {
		const handler = () => toggleOpened(false);

		const listener = (e: Event) => {
			!menuRef.current?.contains(e.target as Node) &&
				!buttonRef.current?.contains(e.target as Node) &&
				handler();
		};

		CLICK_OUT_EVENTS.forEach((ev) =>
			document.addEventListener(ev, listener, { passive: true }),
		);
		return () =>
			CLICK_OUT_EVENTS.forEach((ev) =>
				document.removeEventListener(ev, listener),
			);
	}, [menuRef, buttonRef]);

	const items = links.map((link) => (
		// eslint-disable-next-line react/jsx-no-target-blank
		<Link
			key={link.label}
			to={link.link}
			target={link.link.startsWith('http') ? '_blank' : undefined}
			rel={link.link.startsWith('http') ? 'norefrerer' : undefined}
			className={`${linkClass} ${link.link === active ? linkActive : ''}`}
			onClick={() => {
				toggleOpened(false);
				updateLinkActive();
			}}
		>
			{link.label} {link.label === 'Blog' && <TbExternalLink />}
		</Link>
	));

	return (
		<Paper shadow='md' component='header' className={root}>
			<Container className={header}>
				<Text
					component='h1'
					variant='gradient'
					className={title}
					gradient={{
						from: theme.colors[theme.primaryColor][8],
						to: theme.colors[theme.primaryColor][5],
						deg: 75,
					}}
					ta='center'
				>
					<Link
						to='/'
						onClick={() => {
							updateLinkActive();
						}}
					>
						My Music
					</Link>
				</Text>
				<Group gap={5} className={desktopOnly}>
					{items}
				</Group>

				<Burger
					opened={opened}
					ref={buttonRef}
					onClick={() => toggleOpened()}
					className={mobileOnly}
					size='sm'
				/>

				<Group wrap='nowrap'>
					<ThemeToggle />
				</Group>

				<div className={mobileMenu} ref={menuRef}>
					<Collapse in={opened}>{items}</Collapse>
				</div>
			</Container>
		</Paper>
	);
};

export default Header;
