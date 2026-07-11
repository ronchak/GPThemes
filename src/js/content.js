import browser from 'webextension-polyfill'
import faviconUrl from 'url:../assets/icons/32.png'
import { init as initFAB } from './app/custom-fab/index'
import { mount as mountSuggestedPrompts } from './app/custom-layouts/suggestedPrompts'
import { init as initThemes } from './app/themeManager'

const CONFIG = {
	TARGET_SELECTOR: '.gpth-fab',
}

const CLEANUP_KEY = '_gpthCleanup'
const FAVICON_ATTR = 'data-gpth-favicon'
const PAGE_ATTRS = {
	LIBRARY: 'data-gpth-page-library',
}
const LIBRARY_HEADER_ATTR = 'data-gpth-library-header-control'
const LIBRARY_UPLOAD_ATTR = 'data-gpth-library-upload-button'
const LIBRARY_HEADER_LABEL_PATTERN = /^(Name|Modified|Size)\b/
const LIBRARY_HEADER_SELECTOR = [
	'button',
	'[role="button"]',
	'[aria-sort]',
	'[role="columnheader"]',
	'th',
	'span',
	'div',
	'label',
	'p',
].join(',')

let routeObserverStarted = false
let routeObserver = null
let routeScanFrame = null
let lastRoutePath = ''
let routeCleanup = null

let observedBody = null
let bodyObserver = null
let rootObserver = null
let lifecycleFrame = null

let surfaceCleanup = null
let surfaceMountPromise = null
let surfaceGeneration = 0
let surfaceMountRequested = false

let themeCleanup = null
let runtimeStarted = false
let disposed = false

// =====================================================
// PAGE MARKERS
// =====================================================

function normalizeLibraryLabel(text) {
	return text?.trim().replace(/\s+/g, ' ') || ''
}

function markLibraryHeaderNode(element) {
	if (!(element instanceof HTMLElement)) return

	const target =
		element.closest('button, [role="button"], [aria-sort], th, [role="columnheader"]') || element

	target.setAttribute(LIBRARY_HEADER_ATTR, '')
	element.setAttribute(LIBRARY_HEADER_ATTR, '')

	let current = target
	for (let depth = 0; depth < 6; depth++) {
		const parent = current.parentElement
		if (!parent || parent.matches('main')) break

		const parentText = normalizeLibraryLabel(parent.textContent)
		if (parentText.length > 90) break

		parent.setAttribute(LIBRARY_HEADER_ATTR, '')
		current = parent
	}
}

function clearLibraryMarkers(root) {
	root.querySelectorAll(`[${LIBRARY_HEADER_ATTR}], [${LIBRARY_UPLOAD_ATTR}]`).forEach((element) => {
		element.removeAttribute(LIBRARY_HEADER_ATTR)
		element.removeAttribute(LIBRARY_UPLOAD_ATTR)
	})
}

function markLibraryUploadButton(main) {
	main.querySelectorAll('button, a, [role="button"]').forEach((element) => {
		if (normalizeLibraryLabel(element.textContent) !== 'Upload') return
		element.setAttribute(LIBRARY_UPLOAD_ATTR, '')
	})
}

function markLibraryHeaderControls(main) {
	if (!main) return

	clearLibraryMarkers(main)
	main.querySelectorAll(LIBRARY_HEADER_SELECTOR).forEach((element) => {
		const label = normalizeLibraryLabel(element.textContent)
		if (LIBRARY_HEADER_LABEL_PATTERN.test(label)) markLibraryHeaderNode(element)
	})

	const textWalker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			return LIBRARY_HEADER_LABEL_PATTERN.test(normalizeLibraryLabel(node.textContent))
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT
		},
	})

	let node = textWalker.nextNode()
	while (node) {
		markLibraryHeaderNode(node.parentElement)
		node = textWalker.nextNode()
	}
}

function updatePageAttrs() {
	const path = location.pathname
	const currentPage = path.split('/').filter(Boolean)[0]
	const isLibrary = currentPage === 'library'

	if (path !== lastRoutePath) {
		lastRoutePath = path
		document.documentElement.toggleAttribute(PAGE_ATTRS.LIBRARY, isLibrary)
	}

	if (!isLibrary) return

	const main = document.querySelector('main')
	if (!main) return

	markLibraryHeaderControls(main)
	markLibraryUploadButton(main)
}

function scheduleRouteScan() {
	if (routeScanFrame) return

	routeScanFrame = window.requestAnimationFrame(() => {
		routeScanFrame = null
		updatePageAttrs()
	})
}

function observePageRoute() {
	if (routeObserverStarted || !document.body) return null

	routeObserverStarted = true
	updatePageAttrs()

	routeObserver = new MutationObserver(scheduleRouteScan)
	routeObserver.observe(document.body, { childList: true, subtree: true })
	window.addEventListener('popstate', updatePageAttrs)

	return () => {
		if (routeScanFrame) {
			window.cancelAnimationFrame(routeScanFrame)
			routeScanFrame = null
		}
		routeObserver?.disconnect()
		routeObserver = null
		routeObserverStarted = false
		lastRoutePath = ''
		document.documentElement.removeAttribute(PAGE_ATTRS.LIBRARY)
		clearLibraryMarkers(document)
		window.removeEventListener('popstate', updatePageAttrs)
	}
}

// =====================================================
// FAVICON
// =====================================================

function resolveExtensionUrl(assetUrl) {
	if (typeof assetUrl !== 'string') return null
	if (/^[a-z][a-z\d+.-]*:/i.test(assetUrl)) return assetUrl
	return browser.runtime.getURL(assetUrl.replace(/^\//, ''))
}

function applyFavicon() {
	const resolvedUrl = resolveExtensionUrl(faviconUrl)
	if (!resolvedUrl || !document.head) return

	let link = document.head.querySelector(`link[${FAVICON_ATTR}]`)
	if (!link) {
		link = document.createElement('link')
		link.rel = 'icon'
		link.setAttribute(FAVICON_ATTR, '')
		document.head.appendChild(link)
	}
	link.href = resolvedUrl
}

// =====================================================
// OWNED UI SURFACE
// =====================================================

function runCleanups(cleanups) {
	for (const cleanup of cleanups.reverse()) {
		try {
			cleanup()
		} catch (error) {
			console.warn('[GPThemes] Surface cleanup failed:', error)
		}
	}
}

function disposeSurface() {
	surfaceGeneration++
	surfaceCleanup?.()
	surfaceCleanup = null
}

async function mountSurface() {
	if (disposed || !document.body || surfaceCleanup || surfaceMountPromise) return surfaceMountPromise

	surfaceMountRequested = false
	const generation = surfaceGeneration

	surfaceMountPromise = (async () => {
		const cleanups = []
		try {
			const suggestedPromptsCleanup = mountSuggestedPrompts()
			if (typeof suggestedPromptsCleanup === 'function') cleanups.push(suggestedPromptsCleanup)

			const FABCleanup = await initFAB()
			if (typeof FABCleanup === 'function') cleanups.push(FABCleanup)

			if (disposed || generation !== surfaceGeneration) {
				runCleanups(cleanups)
				return
			}

			let cleaned = false
			surfaceCleanup = () => {
				if (cleaned) return
				cleaned = true
				runCleanups(cleanups)
			}
		} catch (error) {
			runCleanups(cleanups)
			console.error('[GPThemes] Could not mount the UI surface:', error)
		}
	})().finally(() => {
		surfaceMountPromise = null
		if (surfaceMountRequested && !surfaceCleanup && !disposed) void mountSurface()
	})

	return surfaceMountPromise
}

function requestSurfaceMount() {
	surfaceMountRequested = true
	if (!surfaceMountPromise && !surfaceCleanup) void mountSurface()
}

function restartSurface() {
	disposeSurface()
	requestSurfaceMount()
}

function scheduleSurfaceCheck() {
	if (disposed || lifecycleFrame) return

	lifecycleFrame = window.requestAnimationFrame(() => {
		lifecycleFrame = null
		if (document.querySelector(CONFIG.TARGET_SELECTOR)) return

		if (surfaceCleanup) disposeSurface()
		requestSurfaceMount()
	})
}

function ensureBodyObserver() {
	const nextBody = document.body
	if (observedBody === nextBody) return false

	bodyObserver?.disconnect()
	bodyObserver = null
	observedBody = nextBody

	if (observedBody) {
		bodyObserver = new MutationObserver(scheduleSurfaceCheck)
		bodyObserver.observe(observedBody, { childList: true })
	}

	return true
}

function observeHostLifecycle() {
	ensureBodyObserver()

	rootObserver = new MutationObserver(() => {
		if (ensureBodyObserver()) {
			routeCleanup?.()
			routeCleanup = observePageRoute()
			restartSurface()
			return
		}
		scheduleSurfaceCheck()
	})
	rootObserver.observe(document.documentElement, { childList: true })
}

// =====================================================
// RUNTIME
// =====================================================

function initRuntime() {
	if (disposed || runtimeStarted || !document.body) return

	runtimeStarted = true
	applyFavicon()
	routeCleanup = observePageRoute()
	observeHostLifecycle()
	requestSurfaceMount()
}

function cleanup() {
	if (disposed) return

	disposed = true
	runtimeStarted = false
	document.removeEventListener('DOMContentLoaded', initRuntime)

	if (lifecycleFrame) {
		window.cancelAnimationFrame(lifecycleFrame)
		lifecycleFrame = null
	}

	bodyObserver?.disconnect()
	bodyObserver = null
	rootObserver?.disconnect()
	rootObserver = null
	observedBody = null

	routeCleanup?.()
	routeCleanup = null
	disposeSurface()
	themeCleanup?.()
	themeCleanup = null
	document.head?.querySelector(`link[${FAVICON_ATTR}]`)?.remove()
}

if (typeof window[CLEANUP_KEY] === 'function') window[CLEANUP_KEY]()
window[CLEANUP_KEY] = cleanup

themeCleanup = initThemes()

if (document.body) {
	initRuntime()
} else {
	document.addEventListener('DOMContentLoaded', initRuntime, { once: true })
}
