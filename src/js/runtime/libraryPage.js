import { subscribeDomChanges } from './domObserver.js'
import { subscribeLocationChange } from './location.js'

const LIBRARY_PAGE_ATTR = 'data-gpth-page-library'
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
const SCAN_DELAY_MS = 80

function normalizeLabel(text) {
	return text?.trim().replace(/\s+/g, ' ') || ''
}

function mountLibraryPage() {
	const markedElements = new Set()
	let activeMain = null
	let removeDomListener = null
	let scanTimeout = null

	function mark(element, attribute) {
		if (!(element instanceof HTMLElement)) return
		element.setAttribute(attribute, '')
		markedElements.add(element)
	}

	function clearMarkers() {
		for (const element of markedElements) {
			element.removeAttribute(LIBRARY_HEADER_ATTR)
			element.removeAttribute(LIBRARY_UPLOAD_ATTR)
		}
		markedElements.clear()
	}

	function markHeaderNode(element) {
		if (!(element instanceof HTMLElement)) return

		const target =
			element.closest('button, [role="button"], [aria-sort], th, [role="columnheader"]') ||
			element
		mark(target, LIBRARY_HEADER_ATTR)
		mark(element, LIBRARY_HEADER_ATTR)

		let current = target
		for (let depth = 0; depth < 6; depth++) {
			const parent = current.parentElement
			if (!parent || parent.matches('main')) break
			if (normalizeLabel(parent.textContent).length > 90) break
			mark(parent, LIBRARY_HEADER_ATTR)
			current = parent
		}
	}

	function scan() {
		scanTimeout = null
		clearMarkers()
		if (!activeMain?.isConnected) return

		for (const element of activeMain.querySelectorAll(LIBRARY_HEADER_SELECTOR)) {
			if (LIBRARY_HEADER_LABEL_PATTERN.test(normalizeLabel(element.textContent))) {
				markHeaderNode(element)
			}
		}

		for (const element of activeMain.querySelectorAll('button, a, [role="button"]')) {
			if (normalizeLabel(element.textContent) === 'Upload') {
				mark(element, LIBRARY_UPLOAD_ATTR)
			}
		}
	}

	function scheduleScan() {
		if (scanTimeout) window.clearTimeout(scanTimeout)
		scanTimeout = window.setTimeout(scan, SCAN_DELAY_MS)
	}

	function stopMonitoring() {
		removeDomListener?.()
		removeDomListener = null
		activeMain = null
		if (scanTimeout) window.clearTimeout(scanTimeout)
		scanTimeout = null
	}

	function onDomChanges(records) {
		if (!activeMain?.isConnected) {
			const currentMain = document.querySelector('main')
			if (currentMain !== activeMain) {
				activeMain = currentMain
				scheduleScan()
			}
			return
		}

		if (records.some((record) => activeMain.contains(record.target))) scheduleScan()
	}

	function startMonitoring() {
		stopMonitoring()
		activeMain = document.querySelector('main')
		scan()
		removeDomListener = subscribeDomChanges(onDomChanges)
	}

	function onLocationChange({ pathname }) {
		stopMonitoring()
		clearMarkers()

		const isLibrary = pathname.split('/').filter(Boolean)[0] === 'library'
		document.documentElement.toggleAttribute(LIBRARY_PAGE_ATTR, isLibrary)
		if (isLibrary) startMonitoring()
	}

	const unsubscribeLocation = subscribeLocationChange(onLocationChange, { emitCurrent: true })

	return () => {
		unsubscribeLocation()
		stopMonitoring()
		clearMarkers()
		document.documentElement.removeAttribute(LIBRARY_PAGE_ATTR)
	}
}

export { mountLibraryPage }
