import { $ } from '../../utils/dom.js'
import { getItem, watchStorageChanges } from '../../utils/storage.js'
import {
	icon_kofi_cup,
	icon_moon,
	icon_moon_full,
	icon_paint,
	icon_settings,
	icon_sun,
} from '../components/icons.js'
import { SK_TOGGLE_FAB_HIDDEN } from '../config/consts-storage.js'
import { SELECTORS } from '../config/selectors.js'
import { setupExtensionMessaging } from '../messaging/index.js'
import {
	createSettings,
	destroySettings,
	onCloseSettings,
	onToggleSettings,
} from '../settingsManager.js'
import { onChangeTheme } from '../themeManager.js'

// =====================================================
// CONSTANTS
// =====================================================

const STORAGE_KEY = SK_TOGGLE_FAB_HIDDEN

// =====================================================
// STATE
// =====================================================

let isDockOpen = false
let isInitialized = false
let listenersAttached = false
let removeStorageWatcher = null
let removeMessagingListener = null
let settingsCreationPromise = null
let settingsReady = false
let initToken = 0

const elements = {
	FAB: null,
	dock: null,
	dockButtons: null,
}

// =====================================================
// TEMPLATE
// =====================================================

function templateHTML() {
	return `
	        <div class="${SELECTORS.FAB.ROOT}__icon" data-gpth-label="Change theme">${icon_paint}</div>
	        
	        <aside class="${SELECTORS.FAB.DOCK}">
	            <div class="${SELECTORS.FAB.DOCK_BTNS}">
	                <button id="light" type="button" aria-label="Use light theme" data-gpth-label="Light theme" data-gpth-dock-btn="light" class="${SELECTORS.FAB.DOCK}__btn">${icon_sun}</button>
	                <button id="dark" type="button" aria-label="Use dark theme" data-gpth-label="Dark theme" data-gpth-dock-btn="dark" class="${SELECTORS.FAB.DOCK}__btn">${icon_moon}</button>
	                <button id="oled" type="button" aria-label="Use OLED theme" data-gpth-label="OLED theme" data-gpth-dock-btn="black" class="${SELECTORS.FAB.DOCK}__btn">${icon_moon_full}</button>
	                <button id="${SELECTORS.SETTINGS.OPEN_BTN}" type="button" aria-label="Toggle GPThemes settings" data-gpth-label="Settings" data-gpth-dock-btn="settings" class="${SELECTORS.FAB.DOCK}__btn">${icon_settings}</button>
	            </div>
	
	            <a href="https://ko-fi.com/http417" aria-label="Support the original creator" data-gpth-label="Support the original creator" data-gpth-dock-btn="ko-fi" class="${SELECTORS.FAB.DOCK}__btn" target="_blank" rel="noopener noreferrer">
	                ${icon_kofi_cup}
	            </a>
	        </aside>
	    `
}

// =====================================================
// CREATION
// =====================================================

async function createFAB() {
	const existing = document.querySelector(`.${SELECTORS.FAB.ROOT}`)
	if (existing) {
		setElements(existing)
		await setInitialFABVisibility()
		requestAnimationFrame(addListeners)
		return existing
	}

	const FAB = document.createElement('div')
	FAB.className = SELECTORS.FAB.ROOT
	FAB.innerHTML = templateHTML()
	document.body.appendChild(FAB)

	setElements(FAB)
	await setInitialFABVisibility()
	requestAnimationFrame(addListeners)

	return FAB
}

function setElements(FAB) {
	elements.FAB = FAB
	elements.dock = $(`.${SELECTORS.FAB.DOCK}`, FAB)
	elements.dockButtons = $(`.${SELECTORS.FAB.DOCK_BTNS}`, FAB)
}

// =====================================================
// SETTINGS
// =====================================================

function ensureSettings() {
	const settingsExists = document.querySelector(`.${SELECTORS.SETTINGS.ROOT}`)
	if (settingsReady && settingsExists) return Promise.resolve(settingsExists)

	settingsReady = false
	if (!settingsCreationPromise) {
		settingsCreationPromise = createSettings()
			.then((settings) => {
				settingsReady = true
				return settings
			})
			.finally(() => {
				settingsCreationPromise = null
			})
	}

	return settingsCreationPromise
}

// =====================================================
// LISTENERS
// =====================================================

function addListeners() {
	if (listenersAttached || !elements.FAB || !elements.dockButtons) return

	elements.FAB.addEventListener('click', onFABClick)
	elements.dockButtons.addEventListener('click', onDockButtonClick)
	listenersAttached = true
}

function removeListeners() {
	if (!listenersAttached) return

	elements.FAB?.removeEventListener('click', onFABClick)
	elements.dockButtons?.removeEventListener('click', onDockButtonClick)
	document.removeEventListener('click', onOutsideClick, { capture: true })
	listenersAttached = false
}

function onFABClick(event) {
	if (event.target.closest(`.${SELECTORS.FAB.DOCK_BTNS}`)) return
	toggleDock()
}

async function onDockButtonClick(event) {
	const button = event.target.closest('button[data-gpth-dock-btn]')
	if (!button) return

	if (button.id === SELECTORS.SETTINGS.OPEN_BTN) {
		const creation = ensureSettings()
		onToggleSettings()

		try {
			await creation
		} catch (error) {
			onCloseSettings()
			console.error('[FAB] Could not create settings:', error)
		}
		return
	}

	onChangeTheme(event)
}

// =====================================================
// DOCK
// =====================================================

function toggleDock(shouldOpen) {
	const newState = shouldOpen ?? !isDockOpen
	if (!elements.dock || isDockOpen === newState) return

	isDockOpen = newState
	elements.dock.classList.toggle(SELECTORS.FAB.OPEN_STATE, newState)

	if (newState) {
		document.addEventListener('click', onOutsideClick, { capture: true })
	} else {
		document.removeEventListener('click', onOutsideClick, { capture: true })
	}
}

function onOutsideClick(event) {
	if (!elements.FAB?.contains(event.target)) toggleDock(false)
}

// =====================================================
// VISIBILITY
// =====================================================

function setFABVisibility(isHidden = false) {
	if (!elements.FAB) return

	elements.FAB.classList.toggle(`${SELECTORS.FAB.ROOT}--hidden`, isHidden)
	if (isHidden && $(`.${SELECTORS.SETTINGS.OPEN_STATE}`)) onCloseSettings()
}

async function setInitialFABVisibility() {
	setFABVisibility(false)

	try {
		const isHidden = await getItem(STORAGE_KEY)
		if (isHidden) setFABVisibility(true)
	} catch (error) {
		console.warn('[FAB] Could not load visibility state:', error)
	}
}

function onStorageChange(changes, area) {
	if (area !== 'sync') return

	const visibilityChange = changes[STORAGE_KEY]
	if (!visibilityChange) return

	setFABVisibility(visibilityChange.newValue === true)
}

// =====================================================
// LIFECYCLE
// =====================================================

async function init() {
	if (isInitialized && elements.FAB?.isConnected) return cleanup

	const token = ++initToken

	try {
		await createFAB()
		if (token !== initToken || !elements.FAB?.isConnected) return

		removeMessagingListener = setupExtensionMessaging()
		removeStorageWatcher = watchStorageChanges(onStorageChange)
		isInitialized = true
		return cleanup
	} catch (error) {
		console.error('[FAB] Initialization failed:', error)
		throw error
	}
}

function cleanup() {
	initToken++
	toggleDock(false)
	removeListeners()
	removeStorageWatcher?.()
	removeStorageWatcher = null
	removeMessagingListener?.()
	removeMessagingListener = null
	destroySettings()
	settingsCreationPromise = null
	settingsReady = false
	elements.FAB?.remove()
	elements.FAB = null
	elements.dock = null
	elements.dockButtons = null
	isDockOpen = false
	isInitialized = false
}

export { init, setFABVisibility as toggleFABVisibility }
