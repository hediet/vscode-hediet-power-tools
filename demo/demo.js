main();

async function main() {
	bar();
	let i = 0;
	while (i < 10) {
		i++;
		await new Promise((res) => setTimeout(res, 1000));
	}

	await asyncFn1();
}

async function asyncFn1() {
	console.log("asyncFn1");
	await asyncFn2();
	await asyncFn2();
}

async function asyncFn2() {
	await new Promise((res) => setTimeout(res, 10));
	console.log("asyncFn2");
}

function bar() {
	console.log("foo");

	require("./lib.js").a(10);
}
