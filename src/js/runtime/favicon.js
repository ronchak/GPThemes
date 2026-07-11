import browser from 'webextension-polyfill'
import { subscribeDomChanges } from './domObserver.js'

const FAVICON_ATTR = 'data-gpth-favicon'

function resolveExtensionUrl(assetUrl) {
	if (typeof assetUrl !== 'string') return null
	if (/^[a-z][a-z\d+.-]*:/i.test(assetUrl)) return assetUrl
	return browser.runtime.getURL(assetUrl.replace(/^\//, ''))
}

function recordTouchesHead(record) {
	if (document.head?.contains(record.target)) return true
	for (const node of record.addedNodes) {
		if (node === document.head) return true
	}
	return false
}

function mountFavicon(assetUrl) {
	const resolvedUrl = resolveExtensionUrl(assetUrl)
	if (!resolvedUrl) return () => {}

	let favicon = null
	let applying = false
	let disposed = false

	function apply() {
		if (disposed || applying || !document.head) return
		applying = true
		try {
			favicon = document.head.querySelector(`link[${FAVICON_ATTR}]`) || favicon
			if (!favicon) {
				favicon = document.createElement('link')
				favicon.rel = 'icon'
				favicon.setAttribute(FAVICON_ATTR, '')
			}
			if (favicon.href !== resolvedUrl) favicon.href = resolvedUrl
			if (document.head.lastElementChild !== favicon) document.head.appendChild(favicon)
		} finally {
			applying = false
		}
	}

	apply()
	const unsubscribe = subscribeDomChanges((records) => {
		if (records.some(recordTouchesHead)) apply()
	})

	return () => {
		disposed = true
		unsubscribe()
		favicon?.remove()
		favicon = null
	}
}

export { mountFavicon }
