<script
	lang="ts"
	generics="Entry extends { book: { id: string; title: string; author: string | null; coverUrl: string | null }; userBook: { id: string } }"
>
	import { resolve } from '$app/paths';
	import { trapFocus } from '$lib/trapFocus';
	import { coverSrc } from '$lib/coverPlaceholder';
	import { dialogModal } from '$lib/dialogModal';

	let {
		open,
		onClose,
		books,
		onPick,
		heading = 'Log reading'
	}: {
		open: boolean;
		onClose: () => void;
		books: Entry[];
		onPick: (entry: Entry) => void;
		heading?: string;
	} = $props();

</script>

<dialog class="settings-modal" onclose={onClose} use:dialogModal={{ open, onClose }} use:trapFocus>
	<div class="settings-modal__header">
		<h2>{heading}</h2>
		<button type="button" class="settings-modal__close" aria-label="Close" onclick={onClose}>
			×
		</button>
	</div>
	<div class="settings-modal__content">
		{#if books.length === 0}
			<p class="settings-hint">Nothing currently being read.</p>
		{:else}
			<ul class="book-picker__list">
				{#each books as entry (entry.userBook.id)}
					<li>
						<button type="button" class="book-picker__row" onclick={() => onPick(entry)}>
							<img
								class="book-picker__cover"
								src={coverSrc(entry.book.coverUrl, entry.book.id, entry.book.title)}
								alt=""
							/>
							<span class="book-picker__info">
								<span class="book-picker__title">{entry.book.title}</span>
								{#if entry.book.author}
									<span class="book-picker__author">{entry.book.author}</span>
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<a class="book-picker__add-new" href={resolve('/(app)/search')}>+ Add a new book</a>
	</div>
</dialog>
