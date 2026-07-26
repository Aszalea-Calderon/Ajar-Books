<script lang="ts">
	import { enhance } from '$app/forms';

	let { value }: { value: number | null } = $props();

	const stars = [1, 2, 3, 4, 5];
</script>

<form method="POST" action="?/setRating" use:enhance class="star-rating">
	{#each stars as star (star)}
		<span
			class="star-rating__star"
			style="--fill: {Math.max(0, Math.min(1, (value ?? 0) - (star - 1))) * 100}%"
		>
			<button
				type="submit"
				name="rating"
				value={star - 0.5}
				class="star-rating__half star-rating__half--left"
				aria-label="Rate {star - 0.5} stars"
			></button>
			<button
				type="submit"
				name="rating"
				value={star}
				class="star-rating__half star-rating__half--right"
				aria-label="Rate {star} stars"
			></button>
		</span>
	{/each}
</form>
