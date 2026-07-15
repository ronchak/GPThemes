import assert from 'node:assert/strict'
import test from 'node:test'

const PANEL_ATTR = 'data-gpth-activity-panel'
const SURFACE_ATTR = 'data-gpth-activity-surface'

class FakeElement {
	constructor(tagName = 'div', attributes = {}) {
		this.attributes = new Map(Object.entries(attributes))
		this.children = []
		this.className = attributes.class || ''
		this.parentElement = null
		this.tagName = tagName.toLowerCase()
	}

	append(...children) {
		for (const child of children) {
			child.parentElement = this
			this.children.push(child)
		}
	}

	contains(element) {
		return element === this || this.children.some((child) => child.contains(element))
	}

	getAttribute(name) {
		return this.attributes.get(name) ?? null
	}

	hasAttribute(name) {
		return this.attributes.has(name)
	}

	setAttribute(name, value) {
		this.attributes.set(name, value)
	}

	removeAttribute(name) {
		this.attributes.delete(name)
	}

	matches(selectorList) {
		return selectorList.split(',').some((selector) => {
			const value = selector.trim()
			if (value === this.tagName) return true
			if (value === 'aside') return this.tagName === 'aside'
			if (value === 'nav') return this.tagName === 'nav'
			if (value.startsWith('#')) return this.getAttribute('id') === value.slice(1)

			const presence = value.match(/^\[([\w-]+)\]$/)
			if (presence) return this.hasAttribute(presence[1])

			const exact = value.match(/^\[([\w-]+)="([^"]+)"\]$/)
			if (exact) return this.getAttribute(exact[1]) === exact[2]

			const contains = value.match(/^\[([\w-]+)\*="([^"]+)"(?: i)?\]$/)
			if (!contains) return false
			const actual = this.getAttribute(contains[1]) || ''
			return actual.toLowerCase().includes(contains[2].toLowerCase())
		})
	}

	querySelectorAll(selector) {
		const matches = []
		for (const child of this.children) {
			if (child.matches(selector)) matches.push(child)
			matches.push(...child.querySelectorAll(selector))
		}
		return matches
	}

	closest(selector) {
		let element = this
		while (element) {
			if (element.matches(selector)) return element
			element = element.parentElement
		}
		return null
	}
}

class FakeMutationObserver {
	static instance = null

	constructor(callback) {
		this.callback = callback
		FakeMutationObserver.instance = this
	}

	observe() {}

	disconnect() {}

	trigger(addedNodes) {
		this.callback([{ addedNodes }])
	}
}

test('themes new inline activity surfaces without style resolution and cleans up markers', async () => {
	globalThis.HTMLElement = FakeElement
	globalThis.MutationObserver = FakeMutationObserver
	globalThis.getComputedStyle = () => {
		throw new Error('activity panel must not force style resolution')
	}

	const body = new FakeElement('body')
	const main = new FakeElement('main')
	const panel = new FakeElement('aside')
	body.append(main)
	main.append(panel)
	globalThis.document = {
		body,
		querySelector: (selector) => (selector === 'main' ? main : null),
		querySelectorAll: (selector) => body.querySelectorAll(selector),
	}

	const moduleUrl = new URL(
		`../src/js/app/custom-layouts/activityPanel.js?test=${Date.now()}`,
		import.meta.url,
	)
	const { mount } = await import(moduleUrl)
	const cleanup = mount()
	assert.equal(panel.hasAttribute(PANEL_ATTR), true)

	const themedSurface = new FakeElement('div', {
		style: 'background-color: var(--card-background); color: black',
	})
	const gradient = new FakeElement('div', {
		style: 'background-image: linear-gradient(red, blue)',
	})
	const accentSurface = new FakeElement('div', {
		style: 'background: var(--interactive-bg-secondary-hover)',
	})
	const imageSurface = new FakeElement('div', {
		style: 'background: var(--image-bg)',
	})
	panel.append(themedSurface, gradient, accentSurface, imageSurface)
	FakeMutationObserver.instance.trigger([themedSurface, gradient, accentSurface, imageSurface])

	assert.equal(themedSurface.hasAttribute(SURFACE_ATTR), true)
	assert.equal(gradient.hasAttribute(SURFACE_ATTR), false)
	assert.equal(accentSurface.hasAttribute(SURFACE_ATTR), false)
	assert.equal(imageSurface.hasAttribute(SURFACE_ATTR), false)

	const outsideSurface = new FakeElement('div', {
		style: 'background: var(--card-background)',
	})
	main.append(outsideSurface)
	FakeMutationObserver.instance.trigger([outsideSurface])
	assert.equal(outsideSurface.hasAttribute(SURFACE_ATTR), false)

	cleanup()
	assert.equal(panel.hasAttribute(PANEL_ATTR), false)
	assert.equal(themedSurface.hasAttribute(SURFACE_ATTR), false)
})
