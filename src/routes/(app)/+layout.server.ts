import type { LayoutServerLoad } from './$types';
import { hasRecoveryKey } from '$lib/server/auth';
import { getUnreadCount, listNotifications } from '$lib/server/notifications';

// Only what every (app) page genuinely needs (nav avatar, the notification
// bell, the recovery-key reminder banner) — settings/languagePriority/
// manageableTags/customThemes moved to settings/+page.server.ts, since
// Settings was the only consumer but this load ran on every single route.
export const load: LayoutServerLoad = async ({ locals }) => {
	const [hasRecovery, notifications, unreadCount] = locals.user
		? await Promise.all([
				hasRecoveryKey(locals.user.id),
				listNotifications(locals.user.id),
				getUnreadCount(locals.user.id)
			])
		: [false, [], 0];

	return {
		user: locals.user,
		hasRecoveryKey: hasRecovery,
		notifications,
		unreadNotificationCount: unreadCount
	};
};
