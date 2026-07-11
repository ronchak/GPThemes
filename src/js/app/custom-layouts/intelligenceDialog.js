import { subscribeDomChanges } from '../../runtime/domObserver.js'

const DIALOG_ATTR = 'data-gpth-intelligence-dialog'

let active = false
let removeDomListener = null
const markedDialogs = new Set()

function isIntelligenceDialog(dialog) {
	const text = dialog.textContent || ''
	if (!text.includes('Intelligence') || !text.includes('Model')) return false
	return ['Instant', 'Thinking', 'Pro'].filter((model) => text.includes(model)).length >= 2
}

function updateDialog(dialog) {
	if (!(dialog instanceof HTMLElement) || dialog.getAttribute('role') !== 'dialog') return

	if (isIntelligenceDialog(dialog)) {
		dialog.setAttribute(DIALOG_ATTR, '')
		markedDialogs.add(dialog)
	} else if (dialog.hasAttribute(DIALOG_ATTR)) {
		dialog.removeAttribute(DIALOG_ATTR)
		markedDialogs.delete(dialog)
	}
}

function processElement(element) {
	if (!(element instanceof Element)) return

	updateDialog(element.closest('[role="dialog"]'))
	if (element.matches('[role="dialog"]')) updateDialog(element)
	for (const dialog of element.querySelectorAll('[role="dialog"]')) updateDialog(dialog)
}

function releaseElement(element) {
	if (!(element instanceof Element)) return

	const dialogs = []
	if (element.hasAttribute(DIALOG_ATTR)) dialogs.push(element)
	dialogs.push(...element.querySelectorAll(`[${DIALOG_ATTR}]`))
	for (const dialog of dialogs) {
		dialog.removeAttribute(DIALOG_ATTR)
		markedDialogs.delete(dialog)
	}
}

function scan() {
	for (const dialog of document.querySelectorAll('[role="dialog"]')) updateDialog(dialog)
}

function onDomChanges(records) {
	for (const record of records) {
		for (const node of record.removedNodes) releaseElement(node)
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				processElement(node)
			} else if (node.parentElement?.closest('[role="dialog"]')) {
				processElement(node.parentElement)
			}
		}
	}
}

function mount() {
	if (active) return cleanup
	active = true
	scan()
	removeDomListener = subscribeDomChanges(onDomChanges)
	return cleanup
}

function cleanup() {
	removeDomListener?.()
	removeDomListener = null
	active = false
	for (const dialog of markedDialogs) dialog.removeAttribute(DIALOG_ATTR)
	markedDialogs.clear()
}

export { cleanup, mount }
