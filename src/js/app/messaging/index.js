import browser from 'webextension-polyfill'

let removeMessageListener = null
let setFABVisibility = null

function getFABHiddenState(message) {
	if (typeof message?.isHidden === 'boolean') return message.isHidden
	if (typeof message?.hidden === 'boolean') return message.hidden
	if (typeof message?.visible === 'boolean') return !message.visible
	return false
}

function setupExtensionMessaging(visibilityHandler) {
	if (!browser?.runtime?.onMessage || typeof visibilityHandler !== 'function') return
	setFABVisibility = visibilityHandler
	if (removeMessageListener) return removeMessageListener

	const listener = (message) => {
		if (message?.action === 'toggleFABVisibility') {
			setFABVisibility?.(getFABHiddenState(message))
		}
	}

	browser.runtime.onMessage.addListener(listener)
	removeMessageListener = () => {
		browser.runtime.onMessage.removeListener(listener)
		removeMessageListener = null
		setFABVisibility = null
	}
	return removeMessageListener
}

export { setupExtensionMessaging }
