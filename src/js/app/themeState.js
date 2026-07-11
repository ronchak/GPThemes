const THEMES = Object.freeze({
	DARK: 'dark',
	LIGHT: 'light',
	OLED: 'oled',
	SYSTEM: 'system',
})

const STORAGE_KEYS = Object.freeze({
	IS_OLED: 'isOLED',
	THEME: 'theme',
})

const ROOT_THEME_CLASSES = [THEMES.LIGHT, THEMES.DARK]
const OWNED_THEME_CLASSES = Object.values(THEMES).map((theme) => `gpth-theme-${theme}`)
const VALID_STORED_THEMES = new Set([THEMES.LIGHT, THEMES.DARK, THEMES.SYSTEM])

function getSystemTheme(mediaQuery = window.matchMedia('(prefers-color-scheme: light)')) {
	return mediaQuery.matches ? THEMES.LIGHT : THEMES.DARK
}

function getStoredThemeState(storage = localStorage) {
	try {
		const storedTheme = storage.getItem(STORAGE_KEYS.THEME)
		return {
			isOLED: storage.getItem(STORAGE_KEYS.IS_OLED) === 'true',
			theme: VALID_STORED_THEMES.has(storedTheme) ? storedTheme : THEMES.SYSTEM,
		}
	} catch (error) {
		console.warn('[GPThemes] Local storage is unavailable. Using the system theme.', error)
		return { isOLED: false, theme: THEMES.SYSTEM }
	}
}

function resolveTheme(state, mediaQuery) {
	const effectiveTheme =
		state.theme === THEMES.SYSTEM ? getSystemTheme(mediaQuery) : state.theme
	const displayTheme = effectiveTheme === THEMES.DARK && state.isOLED ? THEMES.OLED : effectiveTheme
	return { displayTheme, effectiveTheme }
}

function applyThemeState(
	state,
	root = document.documentElement,
	mediaQuery = window.matchMedia('(prefers-color-scheme: light)'),
) {
	if (!root) return null

	const resolved = resolveTheme(state, mediaQuery)
	root.classList.remove(...ROOT_THEME_CLASSES, ...OWNED_THEME_CLASSES)
	root.classList.add(resolved.effectiveTheme, `gpth-theme-${resolved.displayTheme}`)
	root.style.colorScheme = resolved.effectiveTheme
	root.dataset.gpthTheme = resolved.displayTheme
	root.dataset.gptheme = resolved.displayTheme
	return resolved
}

function applyStoredTheme(
	root = document.documentElement,
	mediaQuery = window.matchMedia('(prefers-color-scheme: light)'),
) {
	return applyThemeState(getStoredThemeState(), root, mediaQuery)
}

function isThemeStateApplied(
	state,
	root = document.documentElement,
	mediaQuery = window.matchMedia('(prefers-color-scheme: light)'),
) {
	if (!root) return false

	const { displayTheme, effectiveTheme } = resolveTheme(state, mediaQuery)
	return (
		root.classList.contains(effectiveTheme) &&
		root.classList.contains(`gpth-theme-${displayTheme}`) &&
		root.dataset.gpthTheme === displayTheme &&
		root.dataset.gptheme === displayTheme &&
		root.style.colorScheme === effectiveTheme
	)
}

function saveThemeState(state, storage = localStorage) {
	storage.setItem(STORAGE_KEYS.THEME, state.theme)
	storage.setItem(STORAGE_KEYS.IS_OLED, String(state.isOLED))
}

export {
	STORAGE_KEYS,
	THEMES,
	applyStoredTheme,
	applyThemeState,
	getStoredThemeState,
	isThemeStateApplied,
	saveThemeState,
}
