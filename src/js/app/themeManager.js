// =====================================================
// CONSTANTS
// =====================================================

const THEMES = {
	LIGHT: 'light',
	DARK: 'dark',
	SYSTEM: 'system',
	OLED: 'oled',
}

const STORAGE_KEYS = {
	THEME: 'theme',
	IS_OLED: 'isOLED',
}

const ROOT_THEME_CLASSES = [THEMES.LIGHT, THEMES.DARK]
const OWNED_THEME_CLASSES = Object.values(THEMES).map((theme) => `gpth-theme-${theme}`)
const PREFERS_LIGHT_MEDIA_QUERY = window.matchMedia('(prefers-color-scheme: light)')

let cachedThemeState = null
let removeListeners = null

// =====================================================
// STATE
// =====================================================

function getSysTheme() {
	return PREFERS_LIGHT_MEDIA_QUERY.matches ? THEMES.LIGHT : THEMES.DARK
}

function getStoredThemeState() {
	if (cachedThemeState) return cachedThemeState

	try {
		cachedThemeState = {
			theme: localStorage.getItem(STORAGE_KEYS.THEME) || THEMES.SYSTEM,
			isOLED: localStorage.getItem(STORAGE_KEYS.IS_OLED) === 'true',
		}
	} catch (error) {
		console.warn('[Theme] Local storage unavailable, using defaults:', error)
		cachedThemeState = { theme: THEMES.SYSTEM, isOLED: false }
	}

	return cachedThemeState
}

function invalidateThemeCache() {
	cachedThemeState = null
}

// =====================================================
// DOM
// =====================================================

function setRootTheme(theme, isOLED) {
	const root = document.documentElement
	if (!root) return

	const effectiveTheme = theme === THEMES.SYSTEM ? getSysTheme() : theme
	const dataAttrTheme = effectiveTheme === THEMES.DARK && isOLED ? THEMES.OLED : effectiveTheme
	const ownedClass = `gpth-theme-${dataAttrTheme}`
	const hasConflictingRootClass = ROOT_THEME_CLASSES.some(
		(className) => className !== effectiveTheme && root.classList.contains(className),
	)
	const hasConflictingOwnedClass = OWNED_THEME_CLASSES.some(
		(className) => className !== ownedClass && root.classList.contains(className),
	)

	if (
		root.classList.contains(effectiveTheme) &&
		root.classList.contains(ownedClass) &&
		!hasConflictingRootClass &&
		!hasConflictingOwnedClass &&
		root.style.colorScheme === effectiveTheme &&
		root.dataset.gpthTheme === dataAttrTheme &&
		root.dataset.gptheme === dataAttrTheme
	) {
		return
	}

	root.classList.remove(...ROOT_THEME_CLASSES, ...OWNED_THEME_CLASSES)
	root.classList.add(effectiveTheme, ownedClass)
	root.style.colorScheme = effectiveTheme
	root.dataset.gpthTheme = dataAttrTheme
	root.dataset.gptheme = dataAttrTheme
}

// =====================================================
// UPDATES
// =====================================================

function updateTheme(newTheme, isOLED = false) {
	const { theme: currentTheme, isOLED: currentIsOLED } = getStoredThemeState()

	if (currentTheme !== newTheme || currentIsOLED !== isOLED) {
		try {
			localStorage.setItem(STORAGE_KEYS.THEME, newTheme)
			localStorage.setItem(STORAGE_KEYS.IS_OLED, String(isOLED))
			invalidateThemeCache()
		} catch (error) {
			console.error('[Theme] Failed to save theme:', error)
			return
		}
	}

	setRootTheme(newTheme, isOLED)
	broadcastThemeChange(newTheme)
}

function broadcastThemeChange(newTheme) {
	window.dispatchEvent(
		new StorageEvent('storage', {
			key: STORAGE_KEYS.THEME,
			newValue: newTheme,
			storageArea: localStorage,
		}),
	)
}

// =====================================================
// EVENTS
// =====================================================

function onChangeTheme(event) {
	const themeButton = event.target.closest('button[data-gpth-dock-btn]')
	if (!themeButton) return

	switch (themeButton.id) {
		case THEMES.LIGHT:
		case THEMES.DARK:
		case THEMES.SYSTEM:
			updateTheme(themeButton.id, false)
			break
		case THEMES.OLED:
			updateTheme(THEMES.DARK, true)
			break
	}
}

function syncStoredTheme() {
	invalidateThemeCache()
	const { theme, isOLED } = getStoredThemeState()
	setRootTheme(theme, isOLED)
}

function onStorageChange(event) {
	if (event.key && event.key !== STORAGE_KEYS.THEME && event.key !== STORAGE_KEYS.IS_OLED) return
	syncStoredTheme()
}

function onSystemPrefChange() {
	const { theme, isOLED } = getStoredThemeState()
	if (theme === THEMES.SYSTEM) setRootTheme(theme, isOLED)
}

// =====================================================
// LIFECYCLE
// =====================================================

function init() {
	syncStoredTheme()

	if (!removeListeners) {
		PREFERS_LIGHT_MEDIA_QUERY.addEventListener('change', onSystemPrefChange)
		window.addEventListener('storage', onStorageChange)
		removeListeners = () => {
			PREFERS_LIGHT_MEDIA_QUERY.removeEventListener('change', onSystemPrefChange)
			window.removeEventListener('storage', onStorageChange)
			removeListeners = null
			invalidateThemeCache()
		}
	}

	return () => removeListeners?.()
}

export { init, onChangeTheme }
