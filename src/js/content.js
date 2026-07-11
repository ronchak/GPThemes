import browser from 'webextension-polyfill'
import faviconUrl from 'url:../assets/icons/32.png'
import { init as initFAB } from './app/custom-fab/index.js'
import { mount as mountSuggestedPrompts } from './app/custom-layouts/suggestedPrompts.js'
import { mount as mountLibraryPageMarkers } from './app/pageMarkers/library.js'
import { init as initThemes } from './app/themeManager.js'

const CLEANUP_KEY = '_gpthCleanup'
const runtimeCleanups = []
let started = false
let lifecycleGeneration = 0

function resolveExtensionUrl(assetUrl) {
	if (typeof assetUrl !== 'string') return null
	if (/^[a-z][a-z\d+.-]*:/i.test(assetUrl)) return assetUrl
	return browser.runtime.getURL(assetUrl.replace(/^\//, ''))
}

function installFavicon() {
	const resolvedUrl = resolveExtensionUrl(faviconUrl)
	if (!resolvedUrl || !document.head) return

	const existing = document.head.querySelector('link[data-gpth-favicon]')
	const link = existing || document.createElement('link')
	link.rel = 'icon'
	link.href = resolvedUrl
	link.setAttribute('data-gpth-favicon', '')
	if (!existing) document.head.appendChild(link)

	return () => link.remove()
}

function addCleanup(cleanup) {
	if (typeof cleanup === 'function') runtimeCleanups.push(cleanup)
}

function isCurrentLifecycle(generation) {
	return started && generation === lifecycleGeneration
}

function disposeFeature(name, cleanup) {
	if (typeof cleanup !== 'function') return
	try {
		cleanup()
	} catch (error) {
		console.warn(`[GPThemes] ${name} stale initialization cleanup failed:`, error)
	}
}

async function mountFeature(name, initializer, generation) {
	try {
		const cleanup = await initializer()
		if (!isCurrentLifecycle(generation)) {
			disposeFeature(name, cleanup)
			return false
		}

		addCleanup(cleanup)
		return true
	} catch (error) {
		console.error(`[GPThemes] ${name} failed to initialize:`, error)
		return false
	}
}

async function start() {
	if (started || !document.body) return
	started = true
	const generation = ++lifecycleGeneration

	await Promise.all([
		mountFeature('theme manager', initThemes, generation),
		mountFeature('favicon', installFavicon, generation),
		mountFeature('library page markers', mountLibraryPageMarkers, generation),
		mountFeature('suggested prompt markers', mountSuggestedPrompts, generation),
	])
	if (!isCurrentLifecycle(generation)) return

	await mountFeature('floating theme menu', initFAB, generation)
	if (!isCurrentLifecycle(generation)) return

	console.info('[GPThemes] Runtime initialized')
}

function cleanup() {
	started = false
	lifecycleGeneration++
	while (runtimeCleanups.length) {
		const dispose = runtimeCleanups.pop()
		try {
			dispose()
		} catch (error) {
			console.warn('[GPThemes] Runtime cleanup failed:', error)
		}
	}
}

if (typeof window[CLEANUP_KEY] === 'function') window[CLEANUP_KEY]()
window[CLEANUP_KEY] = cleanup

if (document.body) {
	start()
} else {
	document.addEventListener('DOMContentLoaded', start, { once: true })
	addCleanup(() => document.removeEventListener('DOMContentLoaded', start))
}
