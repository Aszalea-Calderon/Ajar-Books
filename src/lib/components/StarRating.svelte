<script lang="ts">
	import { enhance } from '$app/forms';

	let { value }: { value: number | null } = $props();

	const stars = [1, 2, 3, 4, 5];
	// Quarter-star increments: each star is split into 4 clickable zones
	// instead of 2, so a rating can land on .25/.5/.75 as well as a whole star.
	const quarters = [0.25, 0.5, 0.75, 1];
</script>

<form method="POST" action="?/setRating" use:enhance class="star-rating">
	{#each stars as star (star)}
		<span
			class="star-rating__star"
			style="--fill: {Math.max(0, Math.min(1, (value ?? 0) - (star - 1))) * 100}%"
		>
			{#each quarters as quarter, i (quarter)}
				<button
					type="submit"
					name="rating"
					value={star - 1 + quarter}
					class="star-rating__quarter star-rating__quarter--{i + 1}"
					aria-label="Rate {star - 1 + quarter} stars"
				></button>
			{/each}
		</span>
	{/each}
	{#if value}
		<span class="star-rating__value">{Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, '')}</span>
	{/if}
</form>
