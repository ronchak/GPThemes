import browser from 'webextension-polyfill'

const FAVICON_ATTR = 'data-gpth-favicon'

function resolveExtensionUrl(assetUrl) {
	if (typeof assetUrl !== 'string') return null
	if (/^[a-z][a-z\d+.-]*:/i.test(assetUrl)) return assetUrl
	return browser.runtime.getURL(assetUrl.replace(/^\//, ''))
}

function mountFavicon(assetUrl) {
	const resolvedUrl = resolveExtensionUrl(assetUrl)
	if (!resolvedUrl) return () => {}

	let favicon = null
	let headObserver = null
	let documentObserver = null
	let applying = false
	let disposed = false

	function apply() {
		if (disposed || applying || !document.head) return
		applying = true

		favicon = document.head.querySelector(`link[${FAVICON_ATTR}]`) || favicon
		if (!favicon) {
			favicon = document.createElement('link')
			favicon.rel = 'icon'
			favicon.setAttribute(FAVICON_ATTR, '')
		}
		if (favicon.href !== resolvedUrl) favicon.href = resolvedUrl
		if (document.head.lastElementChild !== favicon) document.head.appendChild(favicon)

		applying = false
	}

	function observeHead() {
		if (disposed || headObserver || !document.head) return
		documentObserver?.disconnect()
		documentObserver = null
		apply()
		headObserver = new MutationObserver(apply)
		headObserver.observe(document.head, { childList: true })
	}

	if (document.head) {
		observeHead()
	} else if (document.documentElement) {
		documentObserver = new MutationObserver(observeHead)
		documentObserver.observe(document.documentElement, { childList: true })
	}

	return () => {
		disposed = true
		headObserver?.disconnect()
		documentObserver?.disconnect()
		headObserver = null
		documentObserver = null
		favicon?.remove()
		favicon = null
	}
}

export { mountFavicon }
