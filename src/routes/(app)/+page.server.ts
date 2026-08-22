import { fail } from '@sveltejs/kit';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import { getProgressTotalsForBooks, logProgress } from '$lib/server/books/progress';
import { getMonthActivity, getStreakActiveDates } from '$lib/server/books/calendar';
import { createGoal, deleteGoal, getGoalsWithProgress } from '$lib/server/goals';
import { computeCurrentStreak, computeWeeklyStreak, computeLongestStreakEver, isStreakRecord } from '$lib/streak';
import { parseLocalDateInput, toLocalDateInputValue } from '$lib/date';

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

	// One grouped query for every currently-reading book's totals, instead of
	// one SUM() per book — see getProgressTotalsForBooks's own doc comment.
	const totalsByUserBook = await getProgressTotalsForBooks(userBookIds);
	const currentlyReading = rows.map((row) => ({
		...row,
		totals: totalsByUserBook.get(row.userBook.id) ?? { pages: 0, minutes: 0 }
	}));

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

	// Bounds the "prev" arrow the same way hasNextMonth bounds "next" —
	// without this, stepping back is literally unlimited (every earlier
	// month renders, just empty), which is more confusing than useful once
	// you're well past any real history. streakActiveDates is already
	// fetched above for the streak metrics, so the earliest entry in it is
	// free — no extra query. No activity at all yet (a brand-new account)
	// is treated the same as "earliest = current month," since there's
	// nothing to see further back either way.
	const earliestActiveDate = [...streakActiveDates].sort()[0];
	const [earliestYear, earliestMonth] = earliestActiveDate
		? earliestActiveDate.split('-').map(Number)
		: [now.getFullYear(), now.getMonth() + 1];
	const isAtOrBeforeEarliestMonth =
		year < earliestYear || (year === earliestYear && month <= earliestMonth - 1);

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
			hasNextMonth: !isCurrentOrFutureMonth,
			hasPrevMonth: !isAtOrBeforeEarliestMonth
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
	},

	// Backs the calendar's "+ Log for this day" (RetroactiveLogModal) — a
	// plain amount for a specific past date, not the book detail page's
	// "what page are you on now" delta-from-current-total math, since a
	// backfilled day has no "current position" to speak of.
	logForDate: async ({ request }) => {
		const data = await request.formData();
		const userBookId = String(data.get('userBookId') ?? '');
		const dateRaw = String(data.get('date') ?? '');
		const pagesRaw = data.get('pages');
		const hoursRaw = data.get('hours');
		const minutesRaw = data.get('minutes');
		const note = String(data.get('note') ?? '').trim();

		if (!userBookId) return fail(400, { error: 'Missing book' });

		const loggedAt = parseLocalDateInput(dateRaw);
		if (!loggedAt) return fail(400, { error: 'Invalid date' });

		const endOfToday = new Date();
		endOfToday.setHours(23, 59, 59, 999);
		if (loggedAt.getTime() > endOfToday.getTime()) {
			return fail(400, { error: "Can't log a future date" });
		}

		let pagesRead: number | undefined;
		let minutesRead: number | undefined;
		if (pagesRaw) {
			pagesRead = Number(pagesRaw);
		} else if (hoursRaw != null && minutesRaw != null) {
			minutesRead = Number(hoursRaw) * 60 + Number(minutesRaw);
		}

		if (!pagesRead && !minutesRead) {
			return fail(400, { error: 'Enter an amount read' });
		}
		if ((pagesRead != null && pagesRead <= 0) || (minutesRead != null && minutesRead <= 0)) {
			return fail(400, { error: 'Enter a positive amount' });
		}

		await logProgress({ userBookId, pagesRead, minutesRead, note: note || undefined, loggedAt });
	}
};
