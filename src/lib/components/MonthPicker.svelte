<script lang="ts">
	// Purely presentational — the trailing-6-month window and hrefs are built
	// by the caller (same `?month=YYYY-MM` links the old Prev/Next used), so
	// this stays a drop-in swap rather than a new navigation mechanism.
	let {
		months,
		prevHref,
		nextHref,
		hasNext
	}: {
		months: { year: number; month: number; label: string; href: string; isActive: boolean }[];
		prevHref: string;
		nextHref: string;
		hasNext: boolean;
	} = $props();
</script>

<div class="month-picker">
	<a class="month-picker__arrow" href={prevHref} aria-label="Previous month">‹</a>
	<div class="month-picker__pills">
		{#each months as m (`${m.year}-${m.month}`)}
			<a class="month-picker__pill" class:month-picker__pill--active={m.isActive} href={m.href}>
				{m.label}
			</a>
		{/each}
	</div>
	{#if hasNext}
		<a class="month-picker__arrow" href={nextHref} aria-label="Next month">›</a>
	{:else}
		<span class="month-picker__arrow month-picker__arrow--disabled" aria-hidden="true">›</span>
	{/if}
</div>
