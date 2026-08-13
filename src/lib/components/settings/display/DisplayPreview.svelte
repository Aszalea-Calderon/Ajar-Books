<script lang="ts">
	// Deliberately reuses the exact classes real book cards/panels/buttons
	// use (.search-result, .search-result__cover, .auth-submit) rather than
	// inventing separate preview-only markup — every knob on this page is a
	// CSS custom property on :root, so anything wearing these classes
	// updates live for free, with no wiring needed here at all.
</script>

<aside class="display-preview">
	<p class="display-preview__heading">Live Preview</p>
	<p class="settings-hint">Updates instantly as you change anything on this page.</p>

	<div class="search-result display-preview__card">
		<div class="search-result__cover-wrap">
			<div class="search-result__cover display-preview__swatch"></div>
		</div>
		<div class="search-result__info">
			<p class="search-result__title">Sample Book</p>
			<p class="search-result__author">Jane Author</p>
		</div>
	</div>

	<button type="button" class="auth-submit display-preview__button">Sample Button</button>
</aside>
