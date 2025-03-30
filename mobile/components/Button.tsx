import { ReactNode } from 'react';
import {
	StyleSheet,
	TouchableOpacity,
	TouchableOpacityProps,
} from 'react-native';

export const Button = ({ children, ...props }: TouchableOpacityProps) => {
	return (
		<TouchableOpacity style={styles.button} {...props}>
			{children}
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	button: {
		alignItems: 'center',
		padding: 12,
	},
});
