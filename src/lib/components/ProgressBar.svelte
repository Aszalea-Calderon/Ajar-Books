<script lang="ts">
	let {
		current,
		total,
		unit,
		variant = 'bar',
		label
	}: {
		current: number;
		total: number | null;
		unit: 'pages' | 'minutes' | 'books';
		variant?: 'bar' | 'segments';
		label?: string;
	} = $props();

	const SEGMENT_COUNT = 15;
	const segmentIndexes = Array.from({ length: SEGMENT_COUNT }, (_, i) => i);

	function format(value: number) {
		if (unit === 'minutes') {
			const h = Math.floor(value / 60);
			const m = value % 60;
			return h > 0 ? `${h}h ${m}m` : `${m}m`;
		}
		return `${value}`;
	}

	let suffix = $derived(unit === 'pages' ? ' pages' : unit === 'books' ? ' books' : '');
	let percent = $derived(total ? Math.min(100, Math.round((current / total) * 100)) : 0);
	let filledSegments = $derived(Math.round((percent / 100) * SEGMENT_COUNT));
	let fractionText = $derived(
		total ? `${format(current)} of ${format(total)}${suffix}` : `${format(current)}${suffix} so far`
	);
</script>

<div class="progress-bar">
	{#if label}
		<div class="progress-bar__header">
			<span>{label}</span>
			{#if total}<span>{fractionText}</span>{/if}
		</div>
	{/if}

	{#if total && variant === 'segments'}
		<div class="progress-bar__segments">
			{#each segmentIndexes as i (i)}
				<div
					class="progress-bar__segment"
					class:progress-bar__segment--filled={i < filledSegments}
				></div>
			{/each}
		</div>
	{:else if total}
		<div class="progress-bar__track">
			<div class="progress-bar__fill" style="width: {percent}%"></div>
		</div>
	{/if}

	{#if !label}
		<p class="progress-bar__label">{fractionText}</p>
	{/if}
</div>
