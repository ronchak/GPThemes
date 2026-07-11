import { subscribeDomChanges } from '../../runtime/domObserver.js'

const PILL_ATTR = 'data-gpth-sidebar-pill'
const PILL_WRAPPER_ATTR = 'data-gpth-sidebar-pill-wrapper'
const LABEL_SELECTOR = '.__menu-label'

const PILL_LABELS = new Set(['recents', 'gpts'])

let removeDomListener = null
const markedLabels = new Set()
const markedWrappers = new Set()
const wrapperByLabel = new Map()

function normalizeLabel(text = '') {
	return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function unmarkLabel(label) {
	label.removeAttribute(PILL_ATTR)
	markedLabels.delete(label)

	const wrapper = wrapperByLabel.get(label)
	if (wrapper) {
		wrapper.removeAttribute(PILL_WRAPPER_ATTR)
		markedWrappers.delete(wrapper)
		wrapperByLabel.delete(label)
	}
}

function updateLabel(label) {
	if (!(label instanceof HTMLElement) || !label.matches(LABEL_SELECTOR)) return

	const normalized = normalizeLabel(label.textContent)
	const wrapper = label.closest('button')
	const previousWrapper = wrapperByLabel.get(label)
	if (previousWrapper && previousWrapper !== wrapper) unmarkLabel(label)

	if (!PILL_LABELS.has(normalized)) {
		unmarkLabel(label)
		return
	}

	label.setAttribute(PILL_ATTR, normalized)
	markedLabels.add(label)
	if (wrapper) {
		wrapper.setAttribute(PILL_WRAPPER_ATTR, normalized)
		markedWrappers.add(wrapper)
		wrapperByLabel.set(label, wrapper)
	}
}

function processElement(element) {
	if (!(element instanceof Element)) return

	const closestLabel = element.closest(LABEL_SELECTOR)
	if (closestLabel) updateLabel(closestLabel)
	if (element.matches(LABEL_SELECTOR)) updateLabel(element)
	for (const label of element.querySelectorAll(LABEL_SELECTOR)) updateLabel(label)
}

function releaseElement(element) {
	if (!(element instanceof Element)) return

	const labels = []
	if (element.matches(LABEL_SELECTOR)) labels.push(element)
	labels.push(...element.querySelectorAll(LABEL_SELECTOR))
	for (const label of labels) unmarkLabel(label)

	const wrappers = []
	if (element.hasAttribute(PILL_WRAPPER_ATTR)) wrappers.push(element)
	wrappers.push(...element.querySelectorAll(`[${PILL_WRAPPER_ATTR}]`))
	for (const wrapper of wrappers) {
		wrapper.removeAttribute(PILL_WRAPPER_ATTR)
		markedWrappers.delete(wrapper)
		for (const [label, mappedWrapper] of wrapperByLabel) {
			if (mappedWrapper === wrapper) wrapperByLabel.delete(label)
		}
	}
}

function syncSidebarPillMarkers() {
	for (const label of [...markedLabels]) {
		if (!label.isConnected || !label.matches(LABEL_SELECTOR)) unmarkLabel(label)
	}
	for (const label of document.querySelectorAll(LABEL_SELECTOR)) updateLabel(label)
}

function onDomChanges(records) {
	for (const record of records) {
		for (const node of record.removedNodes) releaseElement(node)
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				processElement(node)
			} else if (node.parentElement?.closest(LABEL_SELECTOR)) {
				processElement(node.parentElement)
			}
		}
	}
}

function observeSidebarPillMarkers() {
	if (removeDomListener || !document.body) return

	syncSidebarPillMarkers()
	removeDomListener = subscribeDomChanges(onDomChanges)
}

function disconnectSidebarPillMarkers() {
	removeDomListener?.()
	removeDomListener = null
	for (const label of [...markedLabels]) unmarkLabel(label)
	for (const wrapper of markedWrappers) wrapper.removeAttribute(PILL_WRAPPER_ATTR)
	markedLabels.clear()
	markedWrappers.clear()
	wrapperByLabel.clear()
}

export { disconnectSidebarPillMarkers, observeSidebarPillMarkers, syncSidebarPillMarkers }
