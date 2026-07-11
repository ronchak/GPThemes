import browser from 'webextension-polyfill'
import faviconUrl from 'url:../assets/icons/32.png'
import { init as initFAB } from './app/custom-fab/index.js'
import { mount as mountSuggestedPrompts } from './app/custom-layouts/suggestedPrompts.js'
import { mount as mountLibraryPageMarkers } from './app/pageMarkers/library.js'
import { init as initThemes } from './app/themeManager.js'

const CLEANUP_KEY = '_gpthCleanup'
const runtimeCleanups = []
let started = false

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

async function mountFeature(name, initializer) {
	try {
		addCleanup(await initializer())
		return true
	} catch (error) {
		console.error(`[GPThemes] ${name} failed to initialize:`, error)
		return false
	}
}

async function start() {
	if (started || !document.body) return
	started = true

	await Promise.all([
		mountFeature('theme manager', initThemes),
		mountFeature('favicon', installFavicon),
		mountFeature('library page markers', mountLibraryPageMarkers),
		mountFeature('suggested prompt markers', mountSuggestedPrompts),
	])
	await mountFeature('floating theme menu', initFAB)
	console.info('[GPThemes] Runtime initialized')
}

function cleanup() {
	started = false
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
