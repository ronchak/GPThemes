const subscribers = new Set()

let observer = null
let observedRoot = null

function dispatch(records) {
	for (const subscriber of [...subscribers]) {
		try {
			subscriber(records)
		} catch (error) {
			console.error('[GPThemes] DOM observer subscriber failed.', error)
		}
	}
}

function ensureObserver() {
	const root = document.documentElement
	if (!root) return false
	if (observer && observedRoot === root) return true

	observer?.disconnect()
	observedRoot = root
	observer = new MutationObserver(dispatch)
	observer.observe(root, { childList: true, subtree: true })
	return true
}

function stopObserver() {
	observer?.disconnect()
	observer = null
	observedRoot = null
}

function subscribeDomChanges(subscriber) {
	if (typeof subscriber !== 'function') {
		throw new TypeError('DOM observer subscriber must be a function.')
	}

	subscribers.add(subscriber)
	ensureObserver()

	return () => {
		subscribers.delete(subscriber)
		if (subscribers.size === 0) stopObserver()
	}
}

export { subscribeDomChanges }
