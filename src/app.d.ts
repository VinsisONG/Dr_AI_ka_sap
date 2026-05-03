import type { Session, User } from '@supabase/supabase-js';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session | null;
			user: User | null;
		}
		interface PageData {
			viewer: {
				isAuthenticated: true;
				nickname: string | null;
			} | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
