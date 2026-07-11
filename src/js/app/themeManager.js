import {
	STORAGE_KEYS,
	THEMES,
	applyStoredTheme,
	applyThemeState,
	getStoredThemeState,
	isThemeStateApplied,
	saveThemeState,
} from './themeState.js'

const PREFERS_LIGHT_MEDIA_QUERY = window.matchMedia('(prefers-color-scheme: light)')

let cleanupThemeManager = null
let rootObserver = null

function applyCurrentTheme() {
	return applyStoredTheme(document.documentElement, PREFERS_LIGHT_MEDIA_QUERY)
}

function updateTheme(theme, isOLED = false) {
	const currentState = getStoredThemeState()
	if (currentState.theme === theme && currentState.isOLED === isOLED) return

	const nextState = { isOLED, theme }
	try {
		saveThemeState(nextState)
	} catch (error) {
		console.error('[GPThemes] Failed to save theme preference.', error)
		return
	}

	applyThemeState(nextState, document.documentElement, PREFERS_LIGHT_MEDIA_QUERY)
	broadcastThemeChange(theme)
}

function broadcastThemeChange(theme) {
	window.dispatchEvent(
		new StorageEvent('storage', {
			key: STORAGE_KEYS.THEME,
			newValue: theme,
			storageArea: localStorage,
		}),
	)
}

function onChangeTheme(event) {
	const themeButton = event.target.closest('button[data-gpth-dock-btn]')
	if (!themeButton) return false

	switch (themeButton.id) {
		case THEMES.LIGHT:
		case THEMES.DARK:
		case THEMES.SYSTEM:
			updateTheme(themeButton.id)
			return true
		case THEMES.OLED:
			updateTheme(THEMES.DARK, true)
			return true
		default:
			return false
	}
}

function onSystemPreferenceChange() {
	const state = getStoredThemeState()
	if (state.theme === THEMES.SYSTEM) {
		applyThemeState(state, document.documentElement, PREFERS_LIGHT_MEDIA_QUERY)
	}
}

function onStorageChange(event) {
	if (event.key !== STORAGE_KEYS.THEME && event.key !== STORAGE_KEYS.IS_OLED) return
	applyCurrentTheme()
}

function observeRootTheme() {
	if (rootObserver || !document.documentElement) return

	rootObserver = new MutationObserver(() => {
		const state = getStoredThemeState()
		if (!isThemeStateApplied(state, document.documentElement, PREFERS_LIGHT_MEDIA_QUERY)) {
			applyThemeState(state, document.documentElement, PREFERS_LIGHT_MEDIA_QUERY)
		}
	})
	rootObserver.observe(document.documentElement, {
		attributeFilter: ['class', 'data-gpth-theme', 'data-gptheme', 'style'],
		attributes: true,
	})
}

function init() {
	if (cleanupThemeManager) return cleanupThemeManager

	applyCurrentTheme()
	observeRootTheme()
	PREFERS_LIGHT_MEDIA_QUERY.addEventListener('change', onSystemPreferenceChange)
	window.addEventListener('storage', onStorageChange)

	cleanupThemeManager = () => {
		rootObserver?.disconnect()
		rootObserver = null
		PREFERS_LIGHT_MEDIA_QUERY.removeEventListener('change', onSystemPreferenceChange)
		window.removeEventListener('storage', onStorageChange)
		cleanupThemeManager = null
	}

	return cleanupThemeManager
}

export { init, onChangeTheme }
