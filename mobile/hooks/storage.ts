import { storage } from '@/utils/storage';
import { useMMKVStorage } from 'react-native-mmkv-storage';

export const useAuthToken = () => {
	return useMMKVStorage<string>('authToken', storage);
};

export const useServer = () => {
	return useMMKVStorage<string>('server', storage);
}
