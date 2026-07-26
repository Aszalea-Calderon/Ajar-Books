<script lang="ts">
	let {
		current,
		total,
		unit
	}: { current: number; total: number | null; unit: 'pages' | 'minutes' } = $props();

	function format(value: number) {
		if (unit === 'minutes') {
			const h = Math.floor(value / 60);
			const m = value % 60;
			return h > 0 ? `${h}h ${m}m` : `${m}m`;
		}
		return `${value}`;
	}

	let suffix = $derived(unit === 'pages' ? ' pages' : '');
	let percent = $derived(total ? Math.min(100, Math.round((current / total) * 100)) : 0);
</script>

<div class="progress-bar">
	{#if total}
		<div class="progress-bar__track">
			<div class="progress-bar__fill" style="width: {percent}%"></div>
		</div>
	{/if}
	<p class="progress-bar__label">
		{#if total}
			{format(current)} of {format(total)}{suffix}
		{:else}
			{format(current)}{suffix} so far
		{/if}
	</p>
</div>
