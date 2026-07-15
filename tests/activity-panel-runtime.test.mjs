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
	const compoundImage = new FakeElement('div', {
		style: 'background: var(--card-background) url(hero.png) center/cover',
	})
	const compoundGradient = new FakeElement('div', {
		style: 'background: linear-gradient(var(--main-surface-primary), transparent)',
	})
	const reverseCompoundImage = new FakeElement('div', {
		style: 'background: url(hero.png) var(--main-surface-primary)',
	})
	const imageFallback = new FakeElement('div', {
		style: 'background: var(--card-background, url(fallback.png))',
	})
	const transparentHex = new FakeElement('div', {
		style: 'background: #ffffff00',
	})
	const translucentWhite = new FakeElement('div', {
		style: 'background-color: rgb(255 255 255 / 20%)',
	})
	const variableAlpha = new FakeElement('div', {
		style: 'background-color: rgb(255 255 255 / var(--host-opacity))',
	})
	const opaqueWhite = new FakeElement('div', {
		style: 'background-color: rgba(255, 255, 255, 0.8)',
	})
	const laterDarkLonghand = new FakeElement('div', {
		style: 'background: var(--card-background); background-color: rgb(20 20 20)',
	})
	const laterThemeableLonghand = new FakeElement('div', {
		style: 'background: rgb(20 20 20); background-color: var(--card-background)',
	})
	const importantThemeableFirst = new FakeElement('div', {
		style: 'background-color: var(--card-background) !important; background: rgb(20 20 20)',
	})
	const importantDarkLast = new FakeElement('div', {
		style: 'background: var(--card-background); background-color: rgb(20 20 20) !important',
	})
	const separateImage = new FakeElement('div', {
		style: 'background-color: var(--card-background); background-image: url(hero.png)',
	})
	const inheritedImage = new FakeElement('div', {
		style: 'background-color: var(--card-background) !important; background: inherit',
	})
	const laterDuplicateDark = new FakeElement('div', {
		style: 'background-color: var(--card-background); background-color: rgb(20 20 20)',
	})
	const laterDuplicateThemeable = new FakeElement('div', {
		style: 'background-color: rgb(20 20 20); background-color: var(--card-background)',
	})
	const surfaces = [
		themedSurface,
		gradient,
		accentSurface,
		imageSurface,
		compoundImage,
		compoundGradient,
		reverseCompoundImage,
		imageFallback,
		transparentHex,
		translucentWhite,
		variableAlpha,
		opaqueWhite,
		laterDarkLonghand,
		laterThemeableLonghand,
		importantThemeableFirst,
		importantDarkLast,
		separateImage,
		inheritedImage,
		laterDuplicateDark,
		laterDuplicateThemeable,
	]
	panel.append(...surfaces)
	FakeMutationObserver.instance.trigger(surfaces)

	assert.equal(themedSurface.hasAttribute(SURFACE_ATTR), true)
	assert.equal(gradient.hasAttribute(SURFACE_ATTR), false)
	assert.equal(accentSurface.hasAttribute(SURFACE_ATTR), false)
	assert.equal(imageSurface.hasAttribute(SURFACE_ATTR), false)
	assert.equal(compoundImage.hasAttribute(SURFACE_ATTR), false)
	assert.equal(compoundGradient.hasAttribute(SURFACE_ATTR), false)
	assert.equal(reverseCompoundImage.hasAttribute(SURFACE_ATTR), false)
	assert.equal(imageFallback.hasAttribute(SURFACE_ATTR), false)
	assert.equal(transparentHex.hasAttribute(SURFACE_ATTR), false)
	assert.equal(translucentWhite.hasAttribute(SURFACE_ATTR), false)
	assert.equal(variableAlpha.hasAttribute(SURFACE_ATTR), false)
	assert.equal(opaqueWhite.hasAttribute(SURFACE_ATTR), true)
	assert.equal(laterDarkLonghand.hasAttribute(SURFACE_ATTR), false)
	assert.equal(laterThemeableLonghand.hasAttribute(SURFACE_ATTR), true)
	assert.equal(importantThemeableFirst.hasAttribute(SURFACE_ATTR), true)
	assert.equal(importantDarkLast.hasAttribute(SURFACE_ATTR), false)
	assert.equal(separateImage.hasAttribute(SURFACE_ATTR), false)
	assert.equal(inheritedImage.hasAttribute(SURFACE_ATTR), false)
	assert.equal(laterDuplicateDark.hasAttribute(SURFACE_ATTR), false)
	assert.equal(laterDuplicateThemeable.hasAttribute(SURFACE_ATTR), true)

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
