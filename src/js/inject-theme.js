(function () {
	const STORAGE_KEYS = {
		THEME: 'theme',
		IS_OLED: 'isOLED',
	}
	const THEMES = {
		LIGHT: 'light',
		DARK: 'dark',
		SYSTEM: 'system',
		OLED: 'oled',
	}

	function getSysTheme() {
		return window.matchMedia('(prefers-color-scheme: light)').matches ? THEMES.LIGHT : THEMES.DARK
	}

	function getStoredThemeState() {
		try {
			return {
				theme: localStorage.getItem(STORAGE_KEYS.THEME) || THEMES.SYSTEM,
				isOLED: localStorage.getItem(STORAGE_KEYS.IS_OLED) === 'true',
			}
		} catch {
			return { theme: THEMES.SYSTEM, isOLED: false }
		}
	}

	function setRootTheme(theme, isOLED) {
		const root = document.documentElement
		if (!root) return

		const effectiveTheme = theme === THEMES.SYSTEM ? getSysTheme() : theme
		const dataAttrTheme = effectiveTheme === THEMES.DARK && isOLED ? THEMES.OLED : effectiveTheme

		root.classList.remove(
			THEMES.LIGHT,
			THEMES.DARK,
			'gpth-theme-light',
			'gpth-theme-dark',
			'gpth-theme-system',
			'gpth-theme-oled',
		)
		root.classList.add(effectiveTheme, `gpth-theme-${dataAttrTheme}`)
		root.style.colorScheme = effectiveTheme
		root.dataset.gpthTheme = dataAttrTheme
		root.dataset.gptheme = dataAttrTheme
	}

	const { theme, isOLED } = getStoredThemeState()
	setRootTheme(theme, isOLED)
})()
