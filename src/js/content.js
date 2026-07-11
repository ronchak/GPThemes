import faviconUrl from 'url:../assets/icons/32.png'
import { init as initFAB } from './app/custom-fab/index.js'
import { mount as mountSuggestedPrompts } from './app/custom-layouts/suggestedPrompts.js'
import { init as initThemes } from './app/themeManager.js'
import { subscribeDomChanges } from './runtime/domObserver.js'
import { mountFavicon } from './runtime/favicon.js'
import { mountLibraryPage } from './runtime/libraryPage.js'

const CLEANUP_KEY = '_gpthCleanup'
const FAB_SELECTOR = '.gpth-fab'
const RETRY_DELAYS_MS = [250, 1000, 3000]

let generation = 0
let runtimeCleanup = null
let startPromise = null
let retryIndex = 0
let retryTimeout = null
let removeGuardianListener = null
let domReadyHandler = null
let themeCleanup = null

function runCleanups(cleanups) {
	for (let index = cleanups.length - 1; index >= 0; index--) {
		try {
			cleanups[index]?.()
		} catch (error) {
			console.warn('[GPThemes] Runtime cleanup failed.', error)
		}
	}
}

function clearRetry() {
	if (!retryTimeout) return
	window.clearTimeout(retryTimeout)
	retryTimeout = null
}

function stopGuardian() {
	removeGuardianListener?.()
	removeGuardianListener = null
}

function stopRuntime() {
	generation++
	stopGuardian()
	runtimeCleanup?.()
	runtimeCleanup = null
}

function scheduleRetry() {
	if (retryTimeout || runtimeCleanup || retryIndex >= RETRY_DELAYS_MS.length) return
	const delay = RETRY_DELAYS_MS[retryIndex]
	retryIndex++
	retryTimeout = window.setTimeout(() => {
		retryTimeout = null
		startRuntime()
	}, delay)
}

function scheduleRemount() {
	if (retryTimeout) return
	stopRuntime()
	retryIndex = 0
	scheduleRetry()
}

function startGuardian(fab) {
	stopGuardian()
	if (!document.body || !fab) return

	removeGuardianListener = subscribeDomChanges(() => {
		if (!fab.isConnected) scheduleRemount()
	})
}

async function mountRuntime(token) {
	if (!document.body) return false

	const cleanups = []
	try {
		cleanups.push(mountFavicon(faviconUrl))
		cleanups.push(mountLibraryPage())
		cleanups.push(mountSuggestedPrompts())

		const cleanupFAB = await initFAB()
		if (typeof cleanupFAB === 'function') cleanups.push(cleanupFAB)
		if (token !== generation) {
			runCleanups(cleanups)
			return false
		}

		const fab = document.querySelector(FAB_SELECTOR)
		if (!fab) throw new Error('The floating theme control did not mount.')

		runtimeCleanup = () => runCleanups(cleanups)
		startGuardian(fab)
		return true
	} catch (error) {
		runCleanups(cleanups)
		console.error('[GPThemes] Runtime initialization failed.', error)
		return false
	}
}

function startRuntime() {
	if (runtimeCleanup) return Promise.resolve(true)
	if (startPromise) return startPromise

	clearRetry()
	const token = ++generation
	startPromise = mountRuntime(token)
		.then((mounted) => {
			if (mounted) {
				retryIndex = 0
			} else if (token === generation) {
				scheduleRetry()
			}
			return mounted
		})
		.finally(() => {
			startPromise = null
		})
	return startPromise
}

function cleanup() {
	clearRetry()
	if (domReadyHandler) {
		document.removeEventListener('DOMContentLoaded', domReadyHandler)
		domReadyHandler = null
	}
	stopRuntime()
	themeCleanup?.()
	themeCleanup = null
}

if (typeof window[CLEANUP_KEY] === 'function') window[CLEANUP_KEY]()
window[CLEANUP_KEY] = cleanup
themeCleanup = initThemes()

if (document.body) {
	startRuntime()
} else {
	domReadyHandler = () => {
		domReadyHandler = null
		startRuntime()
	}
	document.addEventListener('DOMContentLoaded', domReadyHandler, { once: true })
}
