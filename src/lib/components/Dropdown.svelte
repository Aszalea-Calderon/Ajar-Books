<script lang="ts">
	import { clickOutside } from '$lib/clickOutside';

	let {
		value,
		options,
		placeholder = 'Select…',
		ariaLabel,
		id,
		onChange
	}: {
		value: string;
		options: { value: string; label: string }[];
		placeholder?: string;
		ariaLabel?: string;
		id?: string;
		onChange: (value: string) => void;
	} = $props();

	let open = $state(false);
	let highlightedIndex = $state(-1);
	let buttonEl = $state<HTMLButtonElement>();
	let listEl = $state<HTMLUListElement>();

	let selectedOption = $derived(options.find((o) => o.value === value));
	let displayLabel = $derived(selectedOption?.label ?? placeholder);

	function optionEls() {
		return Array.from(listEl?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
	}

	function focusOption(index: number) {
		optionEls()[index]?.focus();
	}

	function openList() {
		open = true;
		highlightedIndex = Math.max(
			options.findIndex((o) => o.value === value),
			0
		);
		queueMicrotask(() => focusOption(highlightedIndex));
	}

	function selectOption(optionValue: string) {
		onChange(optionValue);
		open = false;
		buttonEl?.focus();
	}

	function handleButtonKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
			event.preventDefault();
			openList();
		}
	}

	function handleListKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
			buttonEl?.focus();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
			focusOption(highlightedIndex);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
			focusOption(highlightedIndex);
		} else if (event.key === 'Home') {
			event.preventDefault();
			highlightedIndex = 0;
			focusOption(0);
		} else if (event.key === 'End') {
			event.preventDefault();
			highlightedIndex = options.length - 1;
			focusOption(highlightedIndex);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (highlightedIndex >= 0) selectOption(options[highlightedIndex].value);
		} else if (event.key === 'Tab') {
			open = false;
		}
	}
</script>

<div class="dropdown" use:clickOutside={() => (open = false)}>
	<button
		type="button"
		{id}
		bind:this={buttonEl}
		class="dropdown__trigger"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={ariaLabel}
		onclick={() => (open ? (open = false) : openList())}
		onkeydown={handleButtonKeydown}
	>
		<span class="dropdown__trigger-label">{displayLabel}</span>
		<svg class="dropdown__chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
			<path fill="currentColor" d="M7 10l5 5 5-5z" />
		</svg>
	</button>
	{#if open}
		<ul bind:this={listEl} class="dropdown__list" role="listbox" aria-label={ariaLabel}>
			{#each options as option, i (option.value)}
				<li
					role="option"
					aria-selected={option.value === value}
					tabindex="-1"
					class="dropdown__option"
					class:dropdown__option--selected={option.value === value}
					class:dropdown__option--highlighted={i === highlightedIndex}
					onclick={() => selectOption(option.value)}
					onkeydown={handleListKeydown}
					onmouseenter={() => (highlightedIndex = i)}
				>
					{option.label}
				</li>
			{/each}
		</ul>
	{/if}
</div>
