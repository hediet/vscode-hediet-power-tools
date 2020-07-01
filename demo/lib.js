function a(i) {
	if (i === 0) {
		return 0;
	}
	return b(i - 1);
}

function b(i) {
	return a(i - 1);
}

module.exports.a = a;
