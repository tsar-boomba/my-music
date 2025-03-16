export const toLocaleDateString = (dateTimeStr: string): string =>
	new Date(dateTimeStr + 'Z').toLocaleDateString();
export const toLocaleTimeString = (dateTimeStr: string): string =>
	new Date(dateTimeStr + 'Z').toLocaleTimeString();
