import assert from 'node:assert/strict'
import test from 'node:test'
import {
	THEMES,
	applyThemeState,
	getStoredThemeState,
	isThemeStateApplied,
	saveThemeState,
} from '../src/js/app/themeState.js'

class FakeClassList {
	#classes = new Set()

	add(...classes) {
		for (const className of classes) this.#classes.add(className)
	}

	contains(className) {
		return this.#classes.has(className)
	}

	remove(...classes) {
		for (const className of classes) this.#classes.delete(className)
	}
}

function createRoot() {
	return {
		classList: new FakeClassList(),
		dataset: {},
		style: {},
	}
}

function createStorage(initial = {}) {
	const values = new Map(Object.entries(initial))
	return {
		getItem(key) {
			return values.has(key) ? values.get(key) : null
		},
		setItem(key, value) {
			values.set(key, value)
		},
	}
}

test('system dark mode resolves to OLED when requested', () => {
	const root = createRoot()
	const state = { isOLED: true, theme: THEMES.SYSTEM }

	const resolved = applyThemeState(state, root, { matches: false })

	assert.deepEqual(resolved, { displayTheme: THEMES.OLED, effectiveTheme: THEMES.DARK })
	assert.equal(root.classList.contains(THEMES.DARK), true)
	assert.equal(root.classList.contains('gpth-theme-oled'), true)
	assert.equal(root.dataset.gpthTheme, THEMES.OLED)
	assert.equal(root.style.colorScheme, THEMES.DARK)
	assert.equal(isThemeStateApplied(state, root, { matches: false }), true)
})

test('applying a new theme removes stale GPThemes classes', () => {
	const root = createRoot()
	applyThemeState({ isOLED: true, theme: THEMES.DARK }, root, { matches: false })
	applyThemeState({ isOLED: false, theme: THEMES.LIGHT }, root, { matches: false })

	assert.equal(root.classList.contains('gpth-theme-oled'), false)
	assert.equal(root.classList.contains(THEMES.DARK), false)
	assert.equal(root.classList.contains(THEMES.LIGHT), true)
	assert.equal(root.classList.contains('gpth-theme-light'), true)
})

test('stored state is validated and persists as strings', () => {
	const storage = createStorage({ isOLED: 'true', theme: 'invalid-theme' })
	assert.deepEqual(getStoredThemeState(storage), { isOLED: true, theme: THEMES.SYSTEM })

	saveThemeState({ isOLED: false, theme: THEMES.DARK }, storage)
	assert.deepEqual(getStoredThemeState(storage), { isOLED: false, theme: THEMES.DARK })
})
