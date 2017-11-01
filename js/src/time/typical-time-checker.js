module.exports = (getCurrentTime, threshold = 5000) => {

	let epoch

	function delayed(time) {
		if (!epoch) {
			start()
		}

		let expectedTime = getCurrentTime() - epoch
		return expectedTime > time + threshold
	}

	function start() {
		epoch = getCurrentTime()
	}

	function reset() {
		epoch = undefined
	}

	return {
		delayed: delayed,
		reset: reset
	}
}