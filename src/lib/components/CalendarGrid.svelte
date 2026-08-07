<script lang="ts">
	import type { MonthActivityEntry } from '$lib/server/books/calendar';

	let {
		year,
		month,
		activity,
		today,
		onDayClick
	}: {
		year: number;
		month: number; // 0-indexed
		activity: Map<string, MonthActivityEntry[]>;
		today: string; // YYYY-MM-DD
		onDayClick: (date: string) => void;
	} = $props();

	const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const MAX_COVERS = 3;

	function dateString(day: number) {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	// Multiple log entries on the same day can share a book (e.g. two
	// progress updates) — dedupe by bookId so its cover only shows once.
	function coversFor(date: string) {
		const entries = activity.get(date) ?? [];
		const seen = new Set<string>();
		const unique: MonthActivityEntry[] = [];
		for (const entry of entries) {
			if (seen.has(entry.bookId)) continue;
			seen.add(entry.bookId);
			unique.push(entry);
			if (unique.length === MAX_COVERS) break;
		}
		return unique;
	}

	// Monday-start offset, matching the week convention used for goal periods.
	let leadingBlanks = $derived((new Date(year, month, 1).getDay() + 6) % 7);
	let daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
	let cells = $derived([
		...Array.from({ length: leadingBlanks }, () => null),
		...Array.from({ length: daysInMonth }, (_, i) => i + 1)
	]);
</script>

<div class="calendar-grid">
	<div class="calendar-grid__weekdays">
		{#each WEEKDAY_LABELS as label (label)}
			<span class="calendar-grid__weekday">{label}</span>
		{/each}
	</div>
	<div class="calendar-grid__days">
		{#each cells as day, i (i)}
			{#if day === null}
				<div class="calendar-grid__day calendar-grid__day--empty"></div>
			{:else}
				{@const date = dateString(day)}
				{@const covers = coversFor(date)}
				<button
					type="button"
					class="calendar-grid__day"
					class:calendar-grid__day--active={covers.length > 0}
					class:calendar-grid__day--today={date === today}
					onclick={() => onDayClick(date)}
				>
					<span class="calendar-grid__day-number">{day}</span>
					{#if covers.length > 0}
						<span class="calendar-grid__day-covers">
							{#each covers as entry (entry.bookId)}
								{#if entry.coverUrl}
									<img class="calendar-grid__day-cover" src={entry.coverUrl} alt="" />
								{:else}
									<span class="calendar-grid__day-cover calendar-grid__day-cover--placeholder"
									></span>
								{/if}
							{/each}
						</span>
					{/if}
				</button>
			{/if}
		{/each}
	</div>
</div>
