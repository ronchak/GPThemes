const LOCATION_POLL_INTERVAL_MS = 250

const subscribers = new Set()
let intervalId = null
let lastUrl = location.href
let scheduledCheck = null

function notifySubscribers(previousUrl, url) {
	const detail = {
		pathname: location.pathname,
		previousUrl,
		url,
	}

	for (const subscriber of subscribers) {
		try {
			subscriber(detail)
		} catch (error) {
			console.error('[GPThemes] Location subscriber failed.', error)
		}
	}
}

function checkLocation() {
	const url = location.href
	if (url === lastUrl) return

	const previousUrl = lastUrl
	lastUrl = url
	notifySubscribers(previousUrl, url)
}

function scheduleLocationCheck() {
	if (scheduledCheck) return

	scheduledCheck = window.setTimeout(() => {
		scheduledCheck = null
		checkLocation()
	}, 0)
}

function onVisibilityChange() {
	if (!document.hidden) checkLocation()
}

function startLocationMonitor() {
	if (intervalId) return

	lastUrl = location.href
	window.addEventListener('focus', checkLocation)
	window.addEventListener('hashchange', checkLocation)
	window.addEventListener('pageshow', checkLocation)
	window.addEventListener('popstate', checkLocation)
	document.addEventListener('click', scheduleLocationCheck, true)
	document.addEventListener('submit', scheduleLocationCheck, true)
	document.addEventListener('visibilitychange', onVisibilityChange)
	window.navigation?.addEventListener('navigate', scheduleLocationCheck)
	window.navigation?.addEventListener('currententrychange', checkLocation)
	intervalId = window.setInterval(checkLocation, LOCATION_POLL_INTERVAL_MS)
}

function stopLocationMonitor() {
	if (!intervalId) return

	window.clearInterval(intervalId)
	intervalId = null
	if (scheduledCheck) {
		window.clearTimeout(scheduledCheck)
		scheduledCheck = null
	}
	window.removeEventListener('focus', checkLocation)
	window.removeEventListener('hashchange', checkLocation)
	window.removeEventListener('pageshow', checkLocation)
	window.removeEventListener('popstate', checkLocation)
	document.removeEventListener('click', scheduleLocationCheck, true)
	document.removeEventListener('submit', scheduleLocationCheck, true)
	document.removeEventListener('visibilitychange', onVisibilityChange)
	window.navigation?.removeEventListener('navigate', scheduleLocationCheck)
	window.navigation?.removeEventListener('currententrychange', checkLocation)
}

function subscribeLocationChange(subscriber, { emitCurrent = false } = {}) {
	if (typeof subscriber !== 'function') {
		throw new TypeError('Location subscriber must be a function.')
	}

	subscribers.add(subscriber)
	startLocationMonitor()

	if (emitCurrent) {
		subscriber({ pathname: location.pathname, previousUrl: null, url: location.href })
	}

	return () => {
		subscribers.delete(subscriber)
		if (subscribers.size === 0) stopLocationMonitor()
	}
}

export { subscribeLocationChange }
