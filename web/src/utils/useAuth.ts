import { User } from '../types/User';
import { apiUrl } from '../api';
import useSWR from 'swr';
import { useNavigate } from 'react-router';

const fetcher = (url: string): Promise<User | undefined> =>
	fetch(url, { credentials: 'include' }).then(
		(res) => {
			if (res.status === 401) throw new Error('unauthorized');
			else if (res.ok) return res.json();
			else return Promise.resolve(undefined);
		},
		(e) => {
			console.error(e);
			return undefined;
		},
	);

export const useAuth = ({ admin, allowAnon }: { admin?: boolean; allowAnon?: boolean } = {}): {
	user?: User;
} => {
	const navigate = useNavigate();
	const { data: user, error } = useSWR(apiUrl('/check-auth'), fetcher);

	if (error && !allowAnon) {
		navigate('/login');
	}

	if (user && admin) {
		if (!user.admin) navigate('/');
	}

	return { user };
};
