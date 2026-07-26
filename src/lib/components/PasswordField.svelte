<script lang="ts">
	let {
		id,
		name,
		label,
		autocomplete,
		required = false,
		minlength,
		value = $bindable('')
	}: {
		id: string;
		name: string;
		label: string;
		autocomplete: 'current-password' | 'new-password';
		required?: boolean;
		minlength?: number;
		value?: string;
	} = $props();

	let visible = $state(false);
</script>

<div class="auth-field">
	<label for={id}>{label}</label>
	<div class="password-field">
		<input
			{id}
			{name}
			type={visible ? 'text' : 'password'}
			{autocomplete}
			{required}
			{minlength}
			bind:value
		/>
		<button
			type="button"
			class="password-field__toggle"
			aria-label={visible ? 'Hide password' : 'Show password'}
			onclick={() => (visible = !visible)}
		>
			{#if visible}
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<path
						fill="currentColor"
						d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
						opacity="0.35"
					/>
					<path
						fill="currentColor"
						d="M3.28 2.22 21.78 20.72l-1.06 1.06L17.9 19a11.5 11.5 0 0 1-5.9 1.5c-6.5 0-10-7-10-7a15.6 15.6 0 0 1 3.94-5.02L2.22 3.28ZM12 8a4 4 0 0 1 4 4c0 .3-.03.6-.09.88l-4.79-4.79c.28-.06.58-.09.88-.09Z"
					/>
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<path
						fill="currentColor"
						d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
					/>
				</svg>
			{/if}
		</button>
	</div>
</div>
