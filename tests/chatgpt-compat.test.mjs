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

test('root tokens preserve chat surfaces and tertiary icon contrast', async () => {
	const variables = await source('src/sass/abstract/_vars-gpt.scss')
	assert.match(variables, /--black:\s*var\(--c-bg-chats-container\)\s*!important;/)
	assert.match(variables, /--icon-tertiary:\s*var\(--c-subtext-2\)\s*!important;/)
	assert.doesNotMatch(variables, /--black:\s*var\(--c-accent\)\s*!important;/)
})

test('composer styling and Expand Chatbox share the current surface contract', async () => {
	const textarea = await source('src/sass/elements/_right--textarea.scss')
	const customTextarea = await source('src/sass/customs/_custom--textarea.scss')
	const selectors = await source('src/js/app/config/selectors.js')

	for (const value of [textarea, customTextarea, selectors]) {
		assert.match(value, /\.contain-inline-size\[data-composer-surface\]/)
		assert.doesNotMatch(value, /\.contain-inline-size\.bg-token-bg-primary/)
	}

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

test('current writing and collapsible-message controls inherit themed surfaces', async () => {
	const chats = await source('src/sass/elements/_right--chats.scss')
	assert.match(chats, /\.writing-block-editor\s*\{/)
	assert.match(
		chats,
		/\[data-testid="collapsible-user-message-toggle"\]\s*\{[^}]*color:\s*currentColor\s*!important;/s,
	)
})

test('Hide Footer targets the current disclaimer without relying on a generic utility', async () => {
	const selectors = await source('src/js/app/config/selectors.js')
	const hides = await source('src/sass/customs/_custom--hides.scss')
	const currentFooter =
		/#main #thread-bottom-container > \[data-testid=["']thread-disclaimer["']\]/
	const broadFooter = /#main #thread-bottom-container > \.mt-auto/

	for (const value of [selectors, hides]) {
		assert.match(value, currentFooter)
		assert.doesNotMatch(value, broadFooter)
	}
})

test('full theme CSS avoids the Chromium startup path and keeps Firefox idle timing', async () => {
	const chromium = JSON.parse(await source('src/manifests/chromium-mv3/manifest.json'))
	const firefox = JSON.parse(await source('src/manifests/firefox-mv2/manifest.json'))
	const background = await source('src/js/background/index.js')
	const content = await source('src/js/content.js')

	for (const manifest of [chromium, firefox]) {
		const startScript = manifest.content_scripts.find(
			({ run_at }) => run_at === 'document_start',
		)
		assert.deepEqual(startScript.js, ['../../js/inject-theme.js'])
		assert.equal(startScript.css, undefined)
	}

	const chromiumIdle = chromium.content_scripts.find(({ run_at }) => run_at === 'document_idle')
	const firefoxIdle = firefox.content_scripts.find(({ run_at }) => run_at === 'document_idle')
	assert.equal(chromiumIdle.css, undefined)
	assert.deepEqual(firefoxIdle.css, ['../../sass/index.scss'])
	assert.ok(chromium.permissions.includes('scripting'))
	assert.match(
		background,
		/runtime\.onMessage\.addListener\(onMessage\)[\s\S]*initBackgroundScript\(\)/,
	)
	assert.match(background, /chrome\?\.scripting/)
	assert.match(background, /scripting\.insertCSS/)
	assert.match(content, /action:\s*'injectThemeStyles'/)
})

test('suggested prompts use stable runtime markers without relational host fallbacks', async () => {
	const textarea = await source('src/sass/elements/_right--textarea.scss')

	assert.match(textarea, /\[data-gpth-suggested-prompts-panel\]/)
	assert.match(textarea, /\[data-gpth-suggested-prompt-button\]/)
	assert.doesNotMatch(textarea, /body:has\(#prompt-textarea\)/)
})

test('activity panel mutation processing themes inline descendants without computed-style resolution', async () => {
	const activityPanel = await source('src/js/app/custom-layouts/activityPanel.js')
	const search = await source('src/sass/elements/_search.scss')

	assert.doesNotMatch(activityPanel, /getComputedStyle/)
	assert.match(activityPanel, /INLINE_BACKGROUND_SELECTOR\s*=\s*'\[style\*="background" i\]'/)
	assert.match(activityPanel, /hasThemeableInlineBackground\(element\)/)
	assert.match(
		search,
		/\[data-gpth-activity-surface\]\s*\{[^}]*background:\s*var\(--c-surface-2\)\s*!important;/s,
	)
})

test('sidebar pill controls include the current Pinned section label', async () => {
	const pills = await source('src/js/app/custom-hide/sidebarPills.js')
	const hides = await source('src/sass/customs/_custom--hides.scss')
	const hiddenElements = await source('src/js/app/config/consts-hidden-els.js')

	assert.match(pills, /pinned:\s*'pinned'/)
	assert.match(hides, /data-gpth-hide-pinned-pill/)
	assert.match(hiddenElements, /label:\s*'Hide Pinned Pill'/)
})
