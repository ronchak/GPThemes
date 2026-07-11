import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const contentSource = (await readFile(new URL('../src/js/content.js', import.meta.url), 'utf8'))
	.replace(/^import .*$/gm, '')
	.trim()

function createDeferred() {
	let resolve
	const promise = new Promise((promiseResolve) => {
		resolve = promiseResolve
	})
	return { promise, resolve }
}

async function flushMicrotasks(limit = 12) {
	for (let index = 0; index < limit; index++) await Promise.resolve()
}

function createRuntime({ deferredFAB = null } = {}) {
	const cleanupCounts = {
		fab: 0,
		favicon: 0,
		library: 0,
		prompts: 0,
		theme: 0,
	}
	const logs = []
	let fabInitializations = 0

	const context = {
		browser: { runtime: { getURL: (path) => path } },
		console: {
			error: (...args) => logs.push(['error', ...args]),
			info: (...args) => logs.push(['info', ...args]),
			warn: (...args) => logs.push(['warn', ...args]),
		},
		document: {
			addEventListener() {},
			body: {},
			head: null,
			removeEventListener() {},
		},
		faviconUrl: null,
		initFAB: () => {
			fabInitializations++
			if (deferredFAB) return deferredFAB.promise
			return () => cleanupCounts.fab++
		},
		initThemes: () => () => cleanupCounts.theme++,
		mountLibraryPageMarkers: () => () => cleanupCounts.library++,
		mountSuggestedPrompts: () => () => cleanupCounts.prompts++,
		window: {},
	}
	context.globalThis = context
	vm.createContext(context)
	const runSource = () => vm.runInContext(`(() => {${contentSource}})()`, context)
	runSource()

	return {
		cleanupCounts,
		context,
		get fabInitializations() {
			return fabInitializations
		},
		logs,
		runSource,
	}
}

test('disposes an asynchronous feature that resolves after runtime cleanup', async () => {
	const deferredFAB = createDeferred()
	const runtime = createRuntime({ deferredFAB })

	await flushMicrotasks()
	assert.equal(runtime.fabInitializations, 1)

	runtime.context.window._gpthCleanup()
	deferredFAB.resolve(() => runtime.cleanupCounts.fab++)
	await flushMicrotasks()

	assert.deepEqual(runtime.cleanupCounts, {
		fab: 1,
		favicon: 0,
		library: 1,
		prompts: 1,
		theme: 1,
	})
	assert.equal(
		runtime.logs.some(
			([level, message]) => level === 'info' && message === '[GPThemes] Runtime initialized',
		),
		false,
	)
})

test('registers and tears down all features after normal startup', async () => {
	const runtime = createRuntime()
	await flushMicrotasks()

	assert.equal(runtime.fabInitializations, 1)
	assert.equal(
		runtime.logs.some(
			([level, message]) => level === 'info' && message === '[GPThemes] Runtime initialized',
		),
		true,
	)

	runtime.context.window._gpthCleanup()
	assert.deepEqual(runtime.cleanupCounts, {
		fab: 1,
		favicon: 0,
		library: 1,
		prompts: 1,
		theme: 1,
	})
})

test('re-execution cleans up the previous runtime before starting another', async () => {
	const runtime = createRuntime()
	await flushMicrotasks()

	runtime.runSource()
	await flushMicrotasks()
	assert.equal(runtime.fabInitializations, 2)
	assert.deepEqual(runtime.cleanupCounts, {
		fab: 1,
		favicon: 0,
		library: 1,
		prompts: 1,
		theme: 1,
	})

	runtime.context.window._gpthCleanup()
	assert.deepEqual(runtime.cleanupCounts, {
		fab: 2,
		favicon: 0,
		library: 2,
		prompts: 2,
		theme: 2,
	})
})
