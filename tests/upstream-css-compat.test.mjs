import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
	return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

function uncommentedLines(value) {
	return value
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('//'))
		.join('\n')
}

test('root tokens no longer repurpose black and tertiary icons as accent surfaces', async () => {
	const variables = await source('src/sass/abstract/_vars-gpt.scss')
	assert.match(variables, /--black:\s*var\(--c-bg-chats-container\)\s*!important;/)
	assert.match(variables, /--icon-tertiary:\s*var\(--c-subtext-2\)\s*!important;/)
	assert.doesNotMatch(variables, /--black:\s*var\(--c-accent\)\s*!important;/)
})

test('composer styling targets the current data-composer-surface contract', async () => {
	const textarea = await source('src/sass/elements/_right--textarea.scss')
	assert.match(textarea, /\.contain-inline-size\[data-composer-surface\]/)
	assert.match(textarea, /background:\s*var\(--c-bg-textarea\)\s*!important;/)
	assert.doesNotMatch(textarea, /#composer-background/)
	assert.doesNotMatch(textarea, /dark\\:bg-token-bg-elevated-primary/)
})

test('obsolete global sidebar surface overrides stay removed', async () => {
	const sidebar = uncommentedLines(await source('src/sass/elements/_sidebar.scss'))
	const backgrounds = uncommentedLines(await source('src/sass/global/_colors-bgs.scss'))
	assert.doesNotMatch(sidebar, /--sidebar-surface-primary:\s*var\(--c-bg-sidebar\)/)
	assert.doesNotMatch(backgrounds, /\.bg-token-sidebar-surface-primary\s*\{/)
})

test('current writing editor and collapsible user-message controls inherit theme surfaces', async () => {
	const chats = await source('src/sass/elements/_right--chats.scss')
	assert.match(chats, /\.writing-block-editor\s*\{/)
	assert.match(
		chats,
		/\[data-testid="collapsible-user-message-toggle"\]\s*\{[^}]*color:\s*currentColor\s*!important;/s,
	)
})
