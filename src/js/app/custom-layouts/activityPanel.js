import { subscribeDomMutations } from '../../runtime/domMutations.js'

const PANEL_ATTR = 'data-gpth-activity-panel'
const SURFACE_ATTR = 'data-gpth-activity-surface'
const CANDIDATE_SELECTOR =
	'aside, [role="complementary"], [data-testid*="flyout" i], [data-testid*="activity" i], [class*="flyout" i]'
const INLINE_BACKGROUND_SELECTOR = '[style*="background" i]'
const SURFACE_TOKEN_PATTERN =
	/^(?:bg-(?:primary|secondary|tertiary|elevated(?:-[\w-]+)?|neutral(?:-[\w-]+)?|gr[ae]y(?:-[\w-]+)?|white)|(?:main|popover)-surface(?:-[\w-]+)?|(?:card|panel|container)-(?:bg|background|surface)(?:-[\w-]+)?|(?:background|surface)-(?:primary|secondary|tertiary|elevated)(?:-[\w-]+)?|(?:neutral|gr[ae]y|white)-(?:bg|background|surface)(?:-[\w-]+)?)$/i
const INTERACTION_TOKEN_PATTERN =
	/(?:^|-)(?:accent|badge|button|hover|active|selected|interactive|status|success|warning|danger|error|info)(?:-|$)/i

let active = false
let removeDomSubscription = null

function isActivityPanel(element) {
	if (element.matches('aside, [role="complementary"]')) return true
	if (element.getAttribute('data-testid')?.match(/flyout|activity/i)) return true
	return !!(
		element.className?.match?.(/flyout|activity|sidebar/i) &&
		!element.matches('#stage-slideover-sidebar, #stage-popover-sidebar, nav')
	)
}

function getMatches(root, selector) {
	if (!(root instanceof HTMLElement)) return []
	return [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)]
}

function isLightColor(value) {
	const normalized = value.trim().toLowerCase()
	if (/^(?:white|snow|ivory|floralwhite|whitesmoke)$/.test(normalized)) return true

	const hex = normalized.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/)
	if (hex) {
		const digits = [3, 4].includes(hex[1].length)
			? [...hex[1]].map((digit) => digit.repeat(2)).join('')
			: hex[1]
		const channels = digits.match(/.{2}/g).map((channel) => Number.parseInt(channel, 16))
		const [red, green, blue, alpha = 255] = channels
		if (alpha / 255 < 0.5) return false
		return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.7
	}

	const rgb = normalized.match(/^rgba?\((.+)\)$/)
	if (!rgb) return false
	const channels = rgb[1].match(/(?:\d+(?:\.\d+)?|\.\d+)%?/g)
	if (!channels || channels.length < 3) return false

	const [red, green, blue] = channels
		.slice(0, 3)
		.map((channel) =>
			channel.endsWith('%') ? Number.parseFloat(channel) * 2.55 : Number.parseFloat(channel),
		)
	const alphaValue = channels[3]
	const alpha = alphaValue
		? alphaValue.endsWith('%')
			? Number.parseFloat(alphaValue) / 100
			: Number.parseFloat(alphaValue)
		: 1
	if (alpha < 0.5) return false

	return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.7
}

function isThemeableBackground(value) {
	const normalized = value.replace(/\s*!important\s*$/i, '').trim()
	const variable = normalized.match(/^var\(\s*--([\w-]+)(?:\s*,\s*(.+))?\)$/i)
	if (!variable) return isLightColor(normalized)

	const [, token, fallback] = variable
	if (!SURFACE_TOKEN_PATTERN.test(token) || INTERACTION_TOKEN_PATTERN.test(token)) return false
	return !fallback || isLightColor(fallback)
}

function hasThemeableInlineBackground(element) {
	const inlineStyle = element.getAttribute('style') || ''
	return inlineStyle.split(';').some((declaration) => {
		const match = declaration.match(/^\s*background(?:-color)?\s*:\s*(.+?)\s*$/i)
		return match ? isThemeableBackground(match[1]) : false
	})
}

function markChildSurfaces(panel, root = panel) {
	for (const element of getMatches(root, INLINE_BACKGROUND_SELECTOR)) {
		if (panel.contains(element) && hasThemeableInlineBackground(element)) {
			element.setAttribute(SURFACE_ATTR, '')
		}
	}
}

function markPanel(panel) {
	if (!panel.hasAttribute(PANEL_ATTR)) panel.setAttribute(PANEL_ATTR, '')
	markChildSurfaces(panel)
}

function scanRoot(root) {
	if (!(root instanceof HTMLElement)) return

	const containingPanel = root.closest(`[${PANEL_ATTR}]`)
	if (containingPanel) markChildSurfaces(containingPanel, root)

	for (const element of getMatches(root, CANDIDATE_SELECTOR)) {
		if (isActivityPanel(element)) markPanel(element)
	}
}

function scanDocument() {
	const root = document.querySelector('main') || document.body
	if (root instanceof HTMLElement) scanRoot(root)
}

function onDomMutations(mutations) {
	for (const mutation of mutations) {
		for (const node of mutation.addedNodes) {
			if (node instanceof HTMLElement) scanRoot(node)
		}
	}
}

function mount() {
	if (active) return cleanup
	active = true

	scanDocument()
	removeDomSubscription = subscribeDomMutations(onDomMutations)
	return cleanup
}

function cleanup() {
	removeDomSubscription?.()
	removeDomSubscription = null
	active = false
	document.querySelectorAll(`[${PANEL_ATTR}], [${SURFACE_ATTR}]`).forEach((element) => {
		element.removeAttribute(PANEL_ATTR)
		element.removeAttribute(SURFACE_ATTR)
	})
}

export { cleanup, mount }
