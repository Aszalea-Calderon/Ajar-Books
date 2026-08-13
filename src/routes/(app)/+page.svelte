<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { parseLocalDateInput } from '$lib/date';
	import LogProgressModal from '$lib/components/LogProgressModal.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import CalendarGrid from '$lib/components/CalendarGrid.svelte';
	import DayDetailModal from '$lib/components/DayDetailModal.svelte';
	import GoalModal from '$lib/components/GoalModal.svelte';
	import StreakCard from '$lib/components/StreakCard.svelte';
	import MonthPicker from '$lib/components/MonthPicker.svelte';
	import { openSettingsTo } from '$lib/client/settingsModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedUserBookId = $state<string | null>(null);
	let logModalOpen = $state(false);

	let selectedDate = $state<string | null>(null);
	let dayModalOpen = $state(false);
	let goalModalOpen = $state(false);

	function openDay(date: string) {
		selectedDate = date;
		dayModalOpen = true;
	}

	let selectedEntries = $derived(
		selectedDate ? (data.calendarMonth.activity.get(selectedDate) ?? []) : []
	);

	function monthParam(year: number, month: number) {
		const d = new Date(year, month, 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	}
	let prevMonthHref = $derived(
		`?month=${monthParam(data.calendarMonth.year, data.calendarMonth.month - 1)}`
	);
	let nextMonthHref = $derived(
		`?month=${monthParam(data.calendarMonth.year, data.calendarMonth.month + 1)}`
	);
	let calendarMonthLabel = $derived(
		new Date(data.calendarMonth.year, data.calendarMonth.month, 1).toLocaleDateString(undefined, {
			month: 'long',
			year: 'numeric'
		})
	);

	// Trailing 6 real months ending at today (not the currently-viewed month)
	// — a fixed, predictable set of direct-jump pills. MonthPicker's own
	// prev/next arrows (reusing prevMonthHref/nextMonthHref above) cover
	// reaching further back than the window, same range Prev/Next always had.
	let monthPills = $derived.by(() => {
		const anchor = parseLocalDateInput(data.calendarMonth.today) ?? new Date();
		return Array.from({ length: 6 }, (_, i) => {
			const d = new Date(anchor.getFullYear(), anchor.getMonth() - (5 - i), 1);
			return {
				year: d.getFullYear(),
				month: d.getMonth(),
				label: d.toLocaleDateString(undefined, { month: 'short' }),
				href: `?month=${monthParam(d.getFullYear(), d.getMonth())}`,
				isActive:
					d.getFullYear() === data.calendarMonth.year && d.getMonth() === data.calendarMonth.month
			};
		});
	});

	const PERIOD_LABELS = { week: 'This week', month: 'This month', year: 'This year' };

	function goalLabel(goal: (typeof data.goals)[number]) {
		return `${PERIOD_LABELS[goal.period]} · ${goal.metric}`;
	}

	function goalPaceText(goal: (typeof data.goals)[number]) {
		if (goal.pace.status === 'reached') return 'Goal reached!';
		if (goal.pace.status === 'on-track') return 'On track';
		return `${goal.pace.behindAmount} ${goal.metric} behind pace`;
	}

	let hero = $derived(
		data.currentlyReading.find((row) => row.userBook.id === selectedUserBookId) ??
			data.currentlyReading[0]
	);

	let isAudiobook = $derived(hero?.userBook.format === 'audiobook');

	// Keeps the row to a single line rather than wrapping — "See more" links
	// out to the full Currently Reading list once there's more than this.
	const CHIP_LIMIT = 5;
	let visibleChips = $derived(data.currentlyReading.slice(0, CHIP_LIMIT));
	let hasMoreChips = $derived(data.currentlyReading.length > CHIP_LIMIT);

	const greetingTemplates = [
		(name: string) => `Welcome back, ${name}!`,
		(name: string) => `Good to see you, ${name}.`,
		(name: string) => `Hey ${name}, ready to read?`,
		(name: string) => `Welcome back, ${name} — let's pick up where you left off.`
	];
	let greeting = $derived.by(() => {
		const name = data.user?.username ?? 'reader';
		return greetingTemplates[Math.floor(Math.random() * greetingTemplates.length)](name);
	});

	function percentDone(row: (typeof data.currentlyReading)[number]) {
		const current = row.userBook.format === 'audiobook' ? row.totals.minutes : row.totals.pages;
		const total =
			row.userBook.format === 'audiobook' ? row.userBook.totalMinutes : row.userBook.totalPages;
		if (!total) return null;
		return Math.round((current / total) * 100);
	}
</script>

<svelte:head>
	<title>Ajar Books</title>
</svelte:head>

<p class="dashboard__greeting">{greeting}</p>

{#if !data.hasRecoveryKey}
	<div class="recovery-key-reminder">
		<p>
			You don't have a recovery key set up — if you ever forget your password, there's no way
			back in without one.
		</p>
		<button type="button" class="settings-trigger" onclick={() => openSettingsTo('data')}>
			Set one up now
		</button>
	</div>
{/if}

<div class="dashboard">
	<section class="dashboard__panel dashboard__panel--hero">
		<h2>Currently Reading</h2>
		{#if !hero}
			<div class="dashboard__empty-state">
				<p class="dashboard__empty">Nothing in progress yet.</p>
				<a class="dashboard__cta" href={resolve('/search')}>Add a Book</a>
			</div>
		{:else}
			<div class="currently-reading">
				<a
					class="currently-reading__link"
					href={resolve('/(app)/books/[id]', { id: hero.book.id })}
				>
					{#if hero.book.coverUrl}
						<img class="currently-reading__cover" src={hero.book.coverUrl} alt="" />
					{:else}
						<div class="currently-reading__cover currently-reading__cover--placeholder"></div>
					{/if}
					<div class="currently-reading__info">
						<p class="currently-reading__eyebrow">Up next today</p>
						<p class="currently-reading__title">{hero.book.title}</p>
						{#if hero.book.author}
							<p class="currently-reading__author">{hero.book.author}</p>
						{/if}
						<ProgressBar
							current={isAudiobook ? hero.totals.minutes : hero.totals.pages}
							total={isAudiobook ? hero.userBook.totalMinutes : hero.userBook.totalPages}
							unit={isAudiobook ? 'minutes' : 'pages'}
						/>
					</div>
				</a>
				<button
					type="button"
					class="currently-reading__track"
					onclick={() => (logModalOpen = true)}
				>
					Track Progress
				</button>
			</div>

			<div class="currently-reading-chips">
				{#each visibleChips as row (row.userBook.id)}
					{@const done = percentDone(row)}
					<button
						type="button"
						class="currently-reading-chip"
						class:currently-reading-chip--active={row.userBook.id === hero.userBook.id}
						onclick={() => (selectedUserBookId = row.userBook.id)}
					>
						{#if row.book.coverUrl}
							<img class="currently-reading-chip__cover" src={row.book.coverUrl} alt="" />
						{:else}
							<div
								class="currently-reading-chip__cover currently-reading-chip__cover--placeholder"
							></div>
						{/if}
						<span class="currently-reading-chip__info">
							<span class="currently-reading-chip__title">{row.book.title}</span>
							{#if done !== null}
								<span class="currently-reading-chip__done">{done}% done</span>
							{/if}
						</span>
					</button>
				{/each}
				{#if hasMoreChips}
					<a
						class="currently-reading-chip currently-reading-chip--see-more"
						href={resolve('/profile?status=reading')}
					>
						See more
					</a>
				{:else}
					<a class="currently-reading-chip currently-reading-chip--add" href={resolve('/search')}>
						+
					</a>
				{/if}
			</div>
		{/if}
	</section>

	<section class="dashboard__panel dashboard__panel--streak">
		<StreakCard
			currentStreak={data.streak}
			weeklyStreak={data.weeklyStreak}
			isNewRecord={data.isNewRecord}
		/>
	</section>

	<div class="dashboard__row dashboard__row--goal-calendar">
		<section class="dashboard__panel dashboard__panel--goal">
			<h2>Reading Goal</h2>
			{#if data.goals.length === 0}
				<p class="dashboard__empty">Set a reading goal to track your progress here.</p>
			{:else}
				<div class="goal-list">
					{#each data.goals as goal (goal.id)}
						<div class="goal-progress">
							<div class="goal-progress__main">
								<ProgressBar current={goal.current} total={goal.target} unit={goal.metric} />
								<div class="goal-progress__footer">
									<p class="goal-progress__label">{goalLabel(goal)}</p>
									<p
										class="goal-progress__pace"
										class:goal-progress__pace--behind={goal.pace.status === 'behind'}
									>
										{goalPaceText(goal)}
									</p>
								</div>
							</div>
							<form method="POST" action="?/deleteGoal" use:enhance>
								<input type="hidden" name="id" value={goal.id} />
								<button type="submit" class="goal-progress__remove">Remove</button>
							</form>
						</div>
					{/each}
				</div>
			{/if}
			<button type="button" class="dashboard__cta" onclick={() => (goalModalOpen = true)}>
				+ Set a Goal
			</button>
		</section>

		<section class="dashboard__panel dashboard__panel--calendar">
			<div class="calendar-panel__header">
				<h2>{calendarMonthLabel}</h2>
			</div>
			<MonthPicker
				months={monthPills}
				prevHref={prevMonthHref}
				nextHref={nextMonthHref}
				hasNext={data.calendarMonth.hasNextMonth}
			/>
			<CalendarGrid
				year={data.calendarMonth.year}
				month={data.calendarMonth.month}
				activity={data.calendarMonth.activity}
				today={data.calendarMonth.today}
				onDayClick={openDay}
			/>
		</section>
	</div>
</div>

<DayDetailModal
	open={dayModalOpen}
	onClose={() => (dayModalOpen = false)}
	date={selectedDate}
	entries={selectedEntries}
/>

<GoalModal open={goalModalOpen} onClose={() => (goalModalOpen = false)} action="?/createGoal" />

{#if hero}
	<LogProgressModal
		open={logModalOpen}
		onClose={() => (logModalOpen = false)}
		action={`/books/${hero.book.id}?/logProgress`}
		format={hero.userBook.format}
		totalPages={hero.userBook.totalPages}
		totalMinutes={hero.userBook.totalMinutes}
		currentPages={hero.totals.pages}
		currentMinutes={hero.totals.minutes}
	/>
{/if}
