<script lang="ts">
	let {
		currentStreak,
		weeklyStreak,
		isNewRecord
	}: {
		currentStreak: number;
		weeklyStreak: number;
		isNewRecord: boolean;
	} = $props();

	let hasStreak = $derived(currentStreak > 0 || weeklyStreak > 0);
</script>

<div class="streak-card">
	{#if isNewRecord}
		<p class="streak-card__badge">🔥 New record!</p>
		<h2 class="streak-card__heading">You beat your record reading streak!</h2>
		<p class="streak-card__subheading">You're at your all-time best — keep it going.</p>
	{:else if hasStreak}
		<h2 class="streak-card__heading">Reading Streak</h2>
	{:else}
		<h2 class="streak-card__heading">Reading Streak</h2>
		<p class="dashboard__empty">Log some reading today to start a streak.</p>
	{/if}

	{#if hasStreak}
		<div class="streak-card__tiles">
			<div class="streak-card__tile streak-card__tile--primary">
				<p class="streak-card__tile-value">{currentStreak}</p>
				<p class="streak-card__tile-label">Day{currentStreak === 1 ? '' : 's'} in a row</p>
			</div>
			<div class="streak-card__tile">
				<p class="streak-card__tile-value">{weeklyStreak}</p>
				<p class="streak-card__tile-label">Week{weeklyStreak === 1 ? '' : 's'} in a row</p>
			</div>
		</div>
	{/if}
</div>
