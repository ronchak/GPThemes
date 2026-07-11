/**
 * Tags the Activity sidebar and its light child surfaces so CSS can target them
 * without depending on ChatGPT's generated class names.
 */

const PANEL_ATTR = 'data-gpth-activity-panel'
const SURFACE_ATTR = 'data-gpth-activity-surface'
const CANDIDATE_SELECTOR =
	'aside, [role="complementary"], [data-testid*="flyout" i], [data-testid*="activity" i], [class*="flyout" i]'
const SURFACE_SELECTOR = [
	'[class*="bg-neutral-"]',
	'[class*="bg-gray-"]',
	'[class*="bg-white"]',
	'[class*="bg-[#f"]',
	'[class*="bg-[#e"]',
	'[class*="bg-[#d"]',
	'[class*="bg-[#F"]',
	'[class*="bg-[#E"]',
	'[class*="bg-[#D"]',
	'[style*="background"]',
].join(',')

let active = false
let observer = null
const markedPanels = new Set()
const markedSurfaces = new Set()

function isActivityPanel(element) {
	if (element.matches('aside, [role="complementary"]')) return true
	if (element.getAttribute('data-testid')?.match(/flyout|activity/i)) return true
	return Boolean(
		element.className?.match?.(/flyout|activity|sidebar/i) &&
			!element.matches('#stage-slideover-sidebar, #stage-popover-sidebar, nav'),
	)
}

function markSurface(element) {
	if (!(element instanceof HTMLElement)) return

	const background = window.getComputedStyle(element).backgroundColor
	if (!background || background === 'transparent' || background === 'rgba(0, 0, 0, 0)') {
		return
	}

	const match = background.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
	if (!match) return
	const [, red, green, blue] = match.map(Number)
	const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
	if (luminance > 0.7) {
		element.setAttribute(SURFACE_ATTR, '')
		markedSurfaces.add(element)
	}
}

function markSurfacesWithin(root) {
	if (!(root instanceof Element)) return
	if (root.matches(SURFACE_SELECTOR)) markSurface(root)
	for (const surface of root.querySelectorAll(SURFACE_SELECTOR)) markSurface(surface)
}

function markPanel(element) {
	if (!(element instanceof HTMLElement) || !isActivityPanel(element)) return
	element.setAttribute(PANEL_ATTR, '')
	markedPanels.add(element)
	markSurfacesWithin(element)
}

function processElement(element) {
	if (!(element instanceof Element)) return

	const existingPanel = element.closest(`[${PANEL_ATTR}]`)
	if (existingPanel) markSurfacesWithin(element)
	if (element.matches(CANDIDATE_SELECTOR)) markPanel(element)
	for (const candidate of element.querySelectorAll(CANDIDATE_SELECTOR)) markPanel(candidate)
}

function releaseElement(element) {
	if (!(element instanceof Element)) return

	const panels = []
	if (element.hasAttribute(PANEL_ATTR)) panels.push(element)
	panels.push(...element.querySelectorAll(`[${PANEL_ATTR}]`))
	for (const panel of panels) {
		panel.removeAttribute(PANEL_ATTR)
		markedPanels.delete(panel)
	}

	const surfaces = []
	if (element.hasAttribute(SURFACE_ATTR)) surfaces.push(element)
	surfaces.push(...element.querySelectorAll(`[${SURFACE_ATTR}]`))
	for (const surface of surfaces) {
		surface.removeAttribute(SURFACE_ATTR)
		markedSurfaces.delete(surface)
	}
}

function scan() {
	const root = document.querySelector('main') || document.body
	if (!root) return
	processElement(root)
}

function onMutations(records) {
	for (const record of records) {
		for (const node of record.removedNodes) releaseElement(node)
		for (const node of record.addedNodes) processElement(node)
	}
}

function mount() {
	if (active) return cleanup
	active = true
	scan()
	observer = new MutationObserver(onMutations)
	observer.observe(document.body, { childList: true, subtree: true })
	return cleanup
}

function cleanup() {
	observer?.disconnect()
	observer = null
	active = false
	for (const panel of markedPanels) panel.removeAttribute(PANEL_ATTR)
	for (const surface of markedSurfaces) surface.removeAttribute(SURFACE_ATTR)
	markedPanels.clear()
	markedSurfaces.clear()
}

export { cleanup, mount }
