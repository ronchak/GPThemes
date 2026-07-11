import { subscribeDomChanges } from '../../runtime/domObserver.js'

const PANEL_ATTR = 'data-gpth-suggested-prompts-panel'
const ROW_ATTR = 'data-gpth-suggested-prompt-row'
const BUTTON_ATTR = 'data-gpth-suggested-prompt-button'
const MAX_PANEL_DISTANCE = 320
const SCAN_DELAY_MS = 60

let active = false
let removeDomListener = null
let observedRoot = null
let scanTimeout = null
let scanFrame = null
const markedElements = new Set()

function normalizeText(text) {
	return text?.trim().replace(/\s+/g, ' ') || ''
}

function isVisible(element) {
	const rect = element.getBoundingClientRect()
	return rect.width > 0 && rect.height > 0
}

function getPromptText(prompt) {
	return normalizeText(prompt.value || prompt.innerText || prompt.textContent)
}

function findComposer() {
	const prompt = document.querySelector('#prompt-textarea')
	if (!(prompt instanceof HTMLElement)) return null

	const form = prompt.closest('form')
	const anchor = form || prompt
	return {
		anchor,
		form,
		prompt,
		root: form?.parentElement || anchor.parentElement || document.querySelector('main'),
	}
}

function getComposerContext(composer) {
	if (!composer?.root) return null

	const promptText = getPromptText(composer.prompt)
	if (promptText.length < 2 || /^[#/@]/.test(promptText)) return null

	const rect = composer.anchor.getBoundingClientRect()
	if (rect.width <= 0 || rect.height <= 0) return null

	return { ...composer, rect }
}

function hasEnoughHorizontalOverlap(rect, composerRect) {
	const composerLeft = composerRect.left - 96
	const composerRight = composerRect.right + 96
	const overlap = Math.min(rect.right, composerRight) - Math.max(rect.left, composerLeft)
	return overlap >= Math.min(rect.width, composerRect.width) * 0.35
}

function isSuggestionCandidate(element, composer) {
	if (!(element instanceof HTMLElement) || !isVisible(element)) return false
	if (element.closest('form, aside, nav, [role="dialog"], [data-testid="modal-settings"]')) {
		return false
	}

	const text = normalizeText(element.innerText || element.textContent)
	if (text.length < 8 || text.length > 180) return false

	const rect = element.getBoundingClientRect()
	const centerY = rect.top + rect.height / 2
	if (centerY < composer.rect.bottom - 8) return false
	if (centerY > composer.rect.bottom + MAX_PANEL_DISTANCE) return false
	if (rect.height > 96 || rect.width < 160) return false
	return hasEnoughHorizontalOverlap(rect, composer.rect)
}

function countCandidatesInside(element, candidates) {
	let count = 0
	for (const candidate of candidates) {
		if (element.contains(candidate)) count++
	}
	return count
}

function containsComposer(element, composer) {
	return element.contains(composer.prompt) || (composer.form && element.contains(composer.form))
}

function findPanel(candidates, composer) {
	const minimumCount = Math.min(2, candidates.length)
	let best = null

	for (const candidate of candidates) {
		let current = candidate.parentElement

		for (let depth = 0; depth < 8 && current; depth++) {
			if (current.matches('main, body, html, form')) break
			if (containsComposer(current, composer)) break

			const count = countCandidatesInside(current, candidates)
			if (count >= minimumCount) {
				const rect = current.getBoundingClientRect()
				const area = rect.width * rect.height
				if (!best || count > best.count || (count === best.count && area < best.area)) {
					best = { area, count, element: current }
				}
			}
			current = current.parentElement
		}
	}

	return best?.element || null
}

function clearMarkers() {
	for (const element of markedElements) {
		element.removeAttribute(PANEL_ATTR)
		element.removeAttribute(ROW_ATTR)
		element.removeAttribute(BUTTON_ATTR)
	}
	markedElements.clear()
}

function mark(element, attribute) {
	if (!(element instanceof HTMLElement)) return
	element.setAttribute(attribute, '')
	markedElements.add(element)
}

function markPanelStack(panel, composer) {
	let current = panel

	for (let depth = 0; depth < 5 && current; depth++) {
		if (current.matches('main, body, html, form')) break
		if (containsComposer(current, composer)) break

		const rect = current.getBoundingClientRect()
		const isNearComposer =
			rect.bottom >= composer.rect.bottom - 16 &&
			rect.top <= composer.rect.bottom + MAX_PANEL_DISTANCE
		if (!isNearComposer) break

		mark(current, PANEL_ATTR)
		current = current.parentElement
	}
}

function addedNodeContainsPrompt(node) {
	return (
		node instanceof Element &&
		(node.matches('#prompt-textarea') || Boolean(node.querySelector('#prompt-textarea')))
	)
}

function onDomChanges(records) {
	if (observedRoot?.isConnected) {
		if (records.some((record) => observedRoot.contains(record.target))) scheduleScan()
		return
	}

	observedRoot = null
	for (const record of records) {
		if ([...record.addedNodes].some(addedNodeContainsPrompt)) {
			scheduleScan()
			return
		}
	}
}

function scan() {
	scanFrame = null
	const discoveredComposer = findComposer()
	observedRoot = discoveredComposer?.root || null
	const composer = getComposerContext(discoveredComposer)
	clearMarkers()

	if (!composer) return

	const candidates = [...composer.root.querySelectorAll('button, [role="button"], [role="option"]')]
		.filter((element) => isSuggestionCandidate(element, composer))
		.slice(0, 8)
	if (candidates.length < 2) return

	const panel = findPanel(candidates, composer)
	if (!panel) return
	markPanelStack(panel, composer)

	for (const button of candidates) {
		mark(button, BUTTON_ATTR)
		const row = button.closest('li, [role="option"], [role="presentation"], div')
		if (row instanceof HTMLElement && panel.contains(row)) mark(row, ROW_ATTR)
	}
}

function runScheduledScan() {
	scanTimeout = null
	if (scanFrame) window.cancelAnimationFrame(scanFrame)
	scanFrame = window.requestAnimationFrame(scan)
}

function scheduleScan() {
	if (scanTimeout) window.clearTimeout(scanTimeout)
	scanTimeout = window.setTimeout(runScheduledScan, SCAN_DELAY_MS)
}

function onInput(event) {
	if (!(event.target instanceof Element)) return
	if (event.target.id === 'prompt-textarea' || event.target.closest('#prompt-textarea')) {
		scheduleScan()
	}
}

function mount() {
	if (active) return cleanup
	active = true
	removeDomListener = subscribeDomChanges(onDomChanges)
	document.addEventListener('input', onInput, true)
	document.addEventListener('focusin', onInput, true)
	scheduleScan()
	return cleanup
}

function cleanup() {
	if (scanTimeout) window.clearTimeout(scanTimeout)
	if (scanFrame) window.cancelAnimationFrame(scanFrame)
	scanTimeout = null
	scanFrame = null
	removeDomListener?.()
	removeDomListener = null
	observedRoot = null
	document.removeEventListener('input', onInput, true)
	document.removeEventListener('focusin', onInput, true)
	clearMarkers()
	active = false
}

export { cleanup, mount }
