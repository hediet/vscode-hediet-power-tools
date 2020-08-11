async function main() {
	let i = 0;
	while (true) {
		await new Promise((res) => setTimeout(res, 1000));
		i++;
		require("inspector").console.debug(".");
	}
}

main();
