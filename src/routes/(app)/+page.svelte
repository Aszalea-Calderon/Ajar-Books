<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedUserBookId = $state<string | null>(null);
	let logModalOpen = $state(false);
	let logDialogEl: HTMLDialogElement | undefined = $state();

	let hero = $derived(
		data.currentlyReading.find((row) => row.userBook.id === selectedUserBookId) ??
			data.currentlyReading[0]
	);

	let isAudiobook = $derived(hero?.userBook.format === 'audiobook');
	let logButtonLabel = $derived(isAudiobook ? '+ Log listening' : '+ Log progress');

	const greetingTemplates = [
		(name: string) => `Welcome back, ${name}!`,
		(name: string) => `Good to see you, ${name}.`,
		(name: string) => `Hey ${name}, ready to read?`,
		(name: string) => `Welcome back, ${name} — let's pick up where you left off.`
	];
	let greeting = $derived.by(() => {
		const name = data.user?.username ?? 'reader';
		return greetingTemplates[Math.floor(Math.random() * greetingTemplates.length)](name);
	});

	function percentDone(row: (typeof data.currentlyReading)[number]) {
		const current = row.userBook.format === 'audiobook' ? row.totals.minutes : row.totals.pages;
		const total =
			row.userBook.format === 'audiobook' ? row.userBook.totalMinutes : row.userBook.totalPages;
		if (!total) return null;
		return Math.round((current / total) * 100);
	}

	$effect(() => {
		if (!logDialogEl) return;
		if (logModalOpen && !logDialogEl.open) {
			logDialogEl.showModal();
		} else if (!logModalOpen && logDialogEl.open) {
			logDialogEl.close();
		}
	});

	function closeLogModalOnBackdrop(event: MouseEvent) {
		if (event.target === logDialogEl) logModalOpen = false;
	}
</script>

<svelte:head>
	<title>Ajar Books</title>
</svelte:head>

<p class="dashboard__greeting">{greeting}</p>

<div class="dashboard">
	<section class="dashboard__panel dashboard__panel--hero">
		<h2>Currently Reading</h2>
		{#if !hero}
			<p class="dashboard__empty">Nothing in progress yet.</p>
			<a class="dashboard__cta" href={resolve('/search')}>Add a Book</a>
		{:else}
			<div class="currently-reading">
				<a
					class="currently-reading__link"
					href={resolve('/(app)/books/[id]', { id: hero.book.id })}
				>
					{#if hero.book.coverUrl}
						<img class="currently-reading__cover" src={hero.book.coverUrl} alt="" />
					{:else}
						<div class="currently-reading__cover currently-reading__cover--placeholder"></div>
					{/if}
					<div class="currently-reading__info">
						<p class="currently-reading__eyebrow">Up next today</p>
						<p class="currently-reading__title">{hero.book.title}</p>
						{#if hero.book.author}
							<p class="currently-reading__author">{hero.book.author}</p>
						{/if}
						<ProgressBar
							current={isAudiobook ? hero.totals.minutes : hero.totals.pages}
							total={isAudiobook ? hero.userBook.totalMinutes : hero.userBook.totalPages}
							unit={isAudiobook ? 'minutes' : 'pages'}
						/>
					</div>
				</a>
				<button
					type="button"
					class="currently-reading__track"
					onclick={() => (logModalOpen = true)}
				>
					Track Progress
				</button>
			</div>

			<div class="currently-reading-chips">
				{#each data.currentlyReading as row (row.userBook.id)}
					{@const done = percentDone(row)}
					<button
						type="button"
						class="currently-reading-chip"
						class:currently-reading-chip--active={row.userBook.id === hero.userBook.id}
						onclick={() => (selectedUserBookId = row.userBook.id)}
					>
						{#if row.book.coverUrl}
							<img class="currently-reading-chip__cover" src={row.book.coverUrl} alt="" />
						{:else}
							<div
								class="currently-reading-chip__cover currently-reading-chip__cover--placeholder"
							></div>
						{/if}
						<span class="currently-reading-chip__info">
							<span class="currently-reading-chip__title">{row.book.title}</span>
							{#if done !== null}
								<span class="currently-reading-chip__done">{done}% done</span>
							{/if}
						</span>
					</button>
				{/each}
				<a class="currently-reading-chip currently-reading-chip--add" href={resolve('/search')}>
					+
				</a>
			</div>
		{/if}
	</section>

	<section class="dashboard__panel dashboard__panel--streak">
		<h2>Reading Streak</h2>
		<p class="dashboard__empty">
			Your streak calendar will show up here once you log some reading.
		</p>
	</section>

	<section class="dashboard__panel dashboard__panel--goal">
		<h2>Reading Goal</h2>
		<p class="dashboard__empty">Set a reading goal to track your progress here.</p>
	</section>
</div>

{#if hero}
	<dialog
		bind:this={logDialogEl}
		class="settings-modal"
		onclose={() => (logModalOpen = false)}
		onclick={closeLogModalOnBackdrop}
	>
		<div class="settings-modal__header">
			<h2>{logButtonLabel.replace('+ ', '')}</h2>
			<button
				type="button"
				class="settings-modal__close"
				aria-label="Close"
				onclick={() => (logModalOpen = false)}
			>
				×
			</button>
		</div>
		<div class="settings-modal__content">
			<form
				method="POST"
				action={`/books/${hero.book.id}?/logProgress`}
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						logModalOpen = false;
					};
				}}
			>
				{#if isAudiobook}
					<div class="auth-field">
						<label for="minutesRead">Minutes listened</label>
						<input id="minutesRead" name="minutesRead" type="number" min="1" required />
					</div>
				{:else}
					<div class="auth-field">
						<label for="pagesRead">Pages read</label>
						<input id="pagesRead" name="pagesRead" type="number" min="1" required />
					</div>
				{/if}
				<div class="auth-field">
					<label for="note">Note (optional)</label>
					<input id="note" name="note" type="text" />
				</div>
				<button class="auth-submit" type="submit">Log</button>
			</form>
		</div>
	</dialog>
{/if}
