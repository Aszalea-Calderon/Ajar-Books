import { fail } from '@sveltejs/kit';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import { getProgressTotals } from '$lib/server/books/progress';
import { getMonthActivity, getStreakActiveDates } from '$lib/server/books/calendar';
import { createGoal, deleteGoal, getGoalsWithProgress } from '$lib/server/goals';
import { computeCurrentStreak, computeWeeklyStreak, computeLongestStreakEver, isStreakRecord } from '$lib/streak';
import { toLocalDateInputValue } from '$lib/date';

export const load: PageServerLoad = async ({ url }) => {
	const rows = await db
		.select({ book: books, userBook: userBooks })
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(eq(userBooks.status, 'reading'))
		.orderBy(desc(userBooks.startedAt));

	const userBookIds = rows.map((row) => row.userBook.id);

	// Most-recently-active book (last logged session) is the default hero,
	// not just whichever was started most recently — falls back to startedAt
	// for a book with no logs yet.
	const recentLogs = userBookIds.length
		? await db
				.select({ userBookId: readingLogs.userBookId, loggedAt: readingLogs.loggedAt })
				.from(readingLogs)
				.where(inArray(readingLogs.userBookId, userBookIds))
				.orderBy(desc(readingLogs.loggedAt))
		: [];

	const lastActivityByUserBook = new Map<string, Date>();
	for (const log of recentLogs) {
		if (!lastActivityByUserBook.has(log.userBookId)) {
			lastActivityByUserBook.set(log.userBookId, log.loggedAt);
		}
	}

	const currentlyReading = await Promise.all(
		rows.map(async (row) => ({ ...row, totals: await getProgressTotals(row.userBook.id) }))
	);

	currentlyReading.sort((a, b) => {
		const aTime = lastActivityByUserBook.get(a.userBook.id) ?? a.userBook.startedAt ?? new Date(0);
		const bTime = lastActivityByUserBook.get(b.userBook.id) ?? b.userBook.startedAt ?? new Date(0);
		return bTime.getTime() - aTime.getTime();
	});

	const now = new Date();

	// Streak is always relative to today, independent of whichever month the
	// calendar below is currently showing. One fetch of the full active-dates
	// history backs all three metrics below, rather than a query each.
	const streakActiveDates = await getStreakActiveDates();
	const currentStreak = computeCurrentStreak(streakActiveDates, now);
	const weeklyStreak = computeWeeklyStreak(streakActiveDates, now);
	const longestStreakEver = computeLongestStreakEver(streakActiveDates);
	const isNewRecord = isStreakRecord(currentStreak, longestStreakEver);

	// Calendar month comes from ?month=YYYY-MM (prev/next links), defaulting
	// to the current month. Falls back silently on a malformed param.
	const monthParam = url.searchParams.get('month');
	const monthMatch = monthParam ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null;
	const year = monthMatch ? Number(monthMatch[1]) : now.getFullYear();
	const month = monthMatch ? Number(monthMatch[2]) - 1 : now.getMonth();

	const monthStart = new Date(year, month, 1);
	const monthEnd = new Date(year, month + 1, 1);
	const monthActivity = await getMonthActivity(monthStart, monthEnd);

	const isCurrentOrFutureMonth =
		year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());

	return {
		currentlyReading,
		streak: currentStreak,
		weeklyStreak,
		isNewRecord,
		calendarMonth: {
			year,
			month,
			today: toLocalDateInputValue(now),
			activity: monthActivity,
			hasNextMonth: !isCurrentOrFutureMonth
		},
		goals: await getGoalsWithProgress(now)
	};
};

export const actions: Actions = {
	createGoal: async ({ request }) => {
		const formData = await request.formData();
		const period = formData.get('period');
		const metric = formData.get('metric');
		const target = Number(formData.get('target'));

		if (period !== 'week' && period !== 'month' && period !== 'year') {
			return fail(400, { error: 'Invalid timeframe' });
		}
		if (metric !== 'books' && metric !== 'pages' && metric !== 'minutes') {
			return fail(400, { error: 'Invalid metric' });
		}
		if (!Number.isFinite(target) || target <= 0) {
			return fail(400, { error: 'Enter a target greater than 0' });
		}

		await createGoal({ period, metric, target: Math.round(target) });
	},

	deleteGoal: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id');
		if (typeof id !== 'string' || !id) return fail(400, { error: 'Missing goal id' });

		await deleteGoal(id);
	}
};
