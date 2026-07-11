const DIALOG_ATTR = 'data-gpth-intelligence-dialog'

let active = false
let observer = null
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

function mount() {
	if (active) return cleanup
	active = true
	scan()
	observer = new MutationObserver(onMutations)
	observer.observe(document.body, { characterData: true, childList: true, subtree: true })
	return cleanup
}

function cleanup() {
	observer?.disconnect()
	observer = null
	active = false
	for (const dialog of markedDialogs) dialog.removeAttribute(DIALOG_ATTR)
	markedDialogs.clear()
}

export { cleanup, mount }
