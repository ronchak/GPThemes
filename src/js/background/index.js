import { runtime } from 'webextension-polyfill'
import themeCssUrl from 'url:../../sass/index.scss'
import { removeItems } from '../utils/storage'
import {
	getCurrentBadge,
	initBadgeColor,
	isBadgeSeen,
	setNewBadge,
	setVersionBadge,
	updateBadgeToVersion,
} from './updateBadge'
import {
	checkAndCleanStorage,
	getExtCurrVersion,
	getExtStoredVersion,
	setExtStoredVersion,
} from './versionControl'

// Register onInstalled listener at module level (before init runs)
runtime.onInstalled.addListener(onInstallation)
if (!globalThis.hasBackgroundMessageListener) {
	runtime.onMessage.addListener(onMessage)
	globalThis.hasBackgroundMessageListener = true
}

initBackgroundScript()

async function onInstallation(details) {
	try {
		const currVersion = getExtCurrVersion()
		const storedVersion = await getExtStoredVersion()
		const prevVersion = details.previousVersion || storedVersion

		console.log(`📦 Extension ${details.reason}: ${prevVersion || 'none'} → ${currVersion}`)

		if (details.reason === 'update') {
			if (prevVersion !== currVersion) {
				await initBadgeColor()
				await setNewBadge()
				await removeItems(['gptheme'])
				console.log('✅ NEW badge set')
			} else {
				const seen = await isBadgeSeen()
				if (seen) {
					await initBadgeColor()
					await setVersionBadge()
				}
			}
			await setExtStoredVersion(currVersion)
		} else if (details.reason === 'install') {
			await initBadgeColor()
			await setVersionBadge()
			await setExtStoredVersion(currVersion)
			console.log('✅ Version badge set')
		}
	} catch (error) {
		console.error('❌ Installation handler error:', error)
	}
}

// function onMessage(message, sender, sendResponse) {
function getThemeCssPath() {
	return new URL(themeCssUrl, runtime.getURL('/')).pathname.replace(/^\//, '')
}

async function injectThemeStyles(sender) {
	const tabId = sender.tab?.id
	if (!Number.isInteger(tabId) || !globalThis.chrome?.scripting) {
		throw new Error('Theme stylesheet injection is unavailable')
	}

	await globalThis.chrome.scripting.insertCSS({
		files: [getThemeCssPath()],
		target: {
			allFrames: false,
			frameIds: [sender.frameId || 0],
			tabId,
		},
	})
}

function onMessage(message, sender, sendResponse) {
	if (message.action === 'setBadge') {
		updateBadgeToVersion()
			.then(() => sendResponse({ status: 'success' }))
			.catch((error) => {
				console.error('❌ Badge update error:', error)
				sendResponse({ status: 'error', message: error.message })
			})
		return true
	}

	if (message.action === 'injectThemeStyles') {
		injectThemeStyles(sender)
			.then(() => sendResponse({ status: 'success' }))
			.catch((error) => {
				console.error('❌ Theme stylesheet injection error:', error)
				sendResponse({ status: 'error', message: error.message })
			})
		return true
	}
}

async function initBackgroundScript() {
	console.log('🚀 Background script initializing...')

	try {
		await checkAndCleanStorage()
		await initBadgeColor()

		const seen = await isBadgeSeen()
		const storedVersion = await getExtStoredVersion()
		const currentVersion = getExtCurrVersion()
		const currentBadge = await getCurrentBadge()

		console.log(
			`📊 State: Badge="${currentBadge}" | Seen=${seen} | v${storedVersion}→${currentVersion}`,
		)

		// Restore badge if empty
		if (!currentBadge) {
			if (seen) {
				await setVersionBadge()
			} else if (storedVersion && storedVersion !== currentVersion) {
				await setNewBadge()
			} else if (!storedVersion) {
				await setVersionBadge()
				await setExtStoredVersion(currentVersion)
			}
		}

		console.log('✅ Background script ready')
	} catch (error) {
		console.error('❌ Init error:', error)
	}
}
