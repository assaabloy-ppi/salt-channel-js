module.exports = (getCurrentTime) => {

	let epoch
	function getTime() {
		if (epoch === undefined) {
			epoch = getCurrentTime()
			return 1
		}

		let t = getCurrentTime() - epoch
		if (t > 2147483647 || t < 0) {
			t = 2147483647
		}
		return t
	}

	function reset() {
		epoch = undefined
	}
	return {
		getTime: getTime,
		reset: reset
	}
}

