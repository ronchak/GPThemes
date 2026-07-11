const PILL_ATTR = 'data-gpth-sidebar-pill'
const PILL_WRAPPER_ATTR = 'data-gpth-sidebar-pill-wrapper'
const LABEL_SELECTOR = '.__menu-label'

const PILL_LABELS = new Set(['recents', 'gpts'])

let observer = null
const markedLabels = new Set()
const markedWrappers = new Set()

function normalizeLabel(text = '') {
	return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function updateLabel(label) {
	if (!(label instanceof HTMLElement) || !label.matches(LABEL_SELECTOR)) return

	const normalized = normalizeLabel(label.textContent)
	const wrapper = label.closest('button')
	if (PILL_LABELS.has(normalized)) {
		label.setAttribute(PILL_ATTR, normalized)
		markedLabels.add(label)
		if (wrapper) {
			wrapper.setAttribute(PILL_WRAPPER_ATTR, normalized)
			markedWrappers.add(wrapper)
		}
		return
	}

	label.removeAttribute(PILL_ATTR)
	markedLabels.delete(label)
	if (wrapper) {
		wrapper.removeAttribute(PILL_WRAPPER_ATTR)
		markedWrappers.delete(wrapper)
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
	if (element.hasAttribute(PILL_ATTR)) labels.push(element)
	labels.push(...element.querySelectorAll(`[${PILL_ATTR}]`))
	for (const label of labels) {
		label.removeAttribute(PILL_ATTR)
		markedLabels.delete(label)
	}

	const wrappers = []
	if (element.hasAttribute(PILL_WRAPPER_ATTR)) wrappers.push(element)
	wrappers.push(...element.querySelectorAll(`[${PILL_WRAPPER_ATTR}]`))
	for (const wrapper of wrappers) {
		wrapper.removeAttribute(PILL_WRAPPER_ATTR)
		markedWrappers.delete(wrapper)
	}
}

function syncSidebarPillMarkers() {
	for (const label of document.querySelectorAll(LABEL_SELECTOR)) updateLabel(label)
}

function onMutations(records) {
	for (const record of records) {
		if (record.type === 'characterData') {
			processElement(record.target.parentElement)
			continue
		}
		for (const node of record.removedNodes) releaseElement(node)
		for (const node of record.addedNodes) {
			processElement(node instanceof Element ? node : node.parentElement)
		}
	}
}

function observeSidebarPillMarkers() {
	if (observer || !document.body) return

	syncSidebarPillMarkers()
	observer = new MutationObserver(onMutations)
	observer.observe(document.body, {
		characterData: true,
		childList: true,
		subtree: true,
	})
}

function disconnectSidebarPillMarkers() {
	observer?.disconnect()
	observer = null
	for (const label of markedLabels) label.removeAttribute(PILL_ATTR)
	for (const wrapper of markedWrappers) wrapper.removeAttribute(PILL_WRAPPER_ATTR)
	markedLabels.clear()
	markedWrappers.clear()
}

export { disconnectSidebarPillMarkers, observeSidebarPillMarkers, syncSidebarPillMarkers }
