<script lang="ts">
	import type { PaceStats } from '$lib/server/insights/stats';

	let { stats }: { stats: PaceStats } = $props();

	let hasAnyStat = $derived(
		stats.averageDaysPerBook != null ||
			stats.pagesPerActiveDay != null ||
			stats.minutesPerActiveDay != null
	);
</script>

{#if !hasAnyStat}
	<p class="insights-empty">Log some reading (with a start and finish date) to see your pace here.</p>
{:else}
	<div class="streak-card__tiles pace-stats__tiles">
		<div class="streak-card__tile">
			<p class="streak-card__tile-value">
				{stats.averageDaysPerBook != null ? stats.averageDaysPerBook : '—'}
			</p>
			<p class="streak-card__tile-label">Days per book</p>
		</div>
		<div class="streak-card__tile">
			<p class="streak-card__tile-value">
				{stats.pagesPerActiveDay != null ? stats.pagesPerActiveDay : '—'}
			</p>
			<p class="streak-card__tile-label">Pages per active day</p>
		</div>
		<div class="streak-card__tile">
			<p class="streak-card__tile-value">
				{stats.minutesPerActiveDay != null ? stats.minutesPerActiveDay : '—'}
			</p>
			<p class="streak-card__tile-label">Minutes per active day</p>
		</div>
	</div>
{/if}
