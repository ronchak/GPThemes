import { applyStoredTheme } from './app/themeState.js'

function applyEarlyTheme() {
	if (applyStoredTheme()) return

	const observer = new MutationObserver(() => {
		if (!applyStoredTheme()) return
		observer.disconnect()
	})
	observer.observe(document, { childList: true })
}

applyEarlyTheme()
