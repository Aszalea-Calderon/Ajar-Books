import { and, count, eq, gte, lt, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { goals, readingLogs, userBooks } from '$lib/server/db/schema';
import { getPeriodRange } from '$lib/date';
import { computeGoalPace } from '$lib/goalPace';

export type GoalPeriod = 'week' | 'month' | 'year';
export type GoalMetric = 'books' | 'pages' | 'minutes';

async function getCurrentProgress(metric: GoalMetric, start: Date, end: Date): Promise<number> {
	if (metric === 'books') {
		const [row] = await db
			.select({ finished: count() })
			.from(userBooks)
			.where(and(gte(userBooks.finishedAt, start), lt(userBooks.finishedAt, end)));
		return row?.finished ?? 0;
	}

	const [row] = await db
		.select({ pages: sum(readingLogs.pagesRead), minutes: sum(readingLogs.minutesRead) })
		.from(readingLogs)
		.where(and(gte(readingLogs.loggedAt, start), lt(readingLogs.loggedAt, end)));

	return Number((metric === 'pages' ? row?.pages : row?.minutes) ?? 0);
}

/**
 * Goals whose stored period window contains today, each with current
 * progress and pace computed fresh — a goal past its window simply stops
 * appearing rather than being deleted, so it stays around as history.
 */
export async function getGoalsWithProgress(today = new Date()) {
	const allGoals = await db.select().from(goals);
	const active = allGoals.filter((goal) => today >= goal.periodStart && today < goal.periodEnd);

	return Promise.all(
		active.map(async (goal) => {
			const current = await getCurrentProgress(
				goal.metric as GoalMetric,
				goal.periodStart,
				goal.periodEnd
			);
			const pace = computeGoalPace({
				target: goal.target,
				current,
				periodStart: goal.periodStart,
				periodEnd: goal.periodEnd,
				today
			});
			return { ...goal, current, pace };
		})
	);
}

export async function createGoal(params: { period: GoalPeriod; metric: GoalMetric; target: number }) {
	const { start, end } = getPeriodRange(params.period, new Date());
	await db.insert(goals).values({
		period: params.period,
		metric: params.metric,
		target: params.target,
		periodStart: start,
		periodEnd: end
	});
}

export async function deleteGoal(id: string) {
	await db.delete(goals).where(eq(goals.id, id));
}
