const fs = require('fs');

function parseBase(value, base) {
    try {
        return BigInt(parseInt(value, base));
    } catch (error) {
        throw new Error(`Invalid value '${value}' for base ${base}`);
    }
}

function lagrangeInterpolation(points, x, k) {
    let result = BigInt(0);
    for (let i = 0; i < k; i++) {
        let term = points[i][1];
        for (let j = 0; j < k; j++) {
            if (i !== j) {
                const num = x - points[j][0];
                const den = points[i][0] - points[j][0];
                if (den === BigInt(0)) {
                    throw new Error("Duplicate x values detected");
                }
                term = term * num / den;
            }
        }
        result += term;
    }
    return result;
}

function* combinations(arr, k) {
    function* comb(pos, k, current) {
        if (k === 0) yield current;
        else {
            for (let i = pos; i <= arr.length - k; i++) {
                yield* comb(i + 1, k - 1, [...current, arr[i]]);
            }
        }
    }
    yield* comb(0, k, []);
}

function findInconsistentShares(points, k) {
    const n = points.length;
    let maxConsistent = 0;
    let secret = BigInt(0);
    let wrongIndices = [];
    
    const indices = Array.from({length: n}, (_, i) => i);
    console.log(`Checking ${n} points with k=${k}`);

    let firstValidSecret = null;
    let firstValidSubset = null;
    for (const subset of combinations(indices, k)) {
        console.log(`Trying subset: ${subset}`);
        const subPoints = subset.map(i => points[i]);
        try {
            const currentSecret = lagrangeInterpolation(subPoints, BigInt(0), k);
            console.log(`Secret from subset: ${currentSecret}`);
            let consistentCount = 0;
            const inconsistent = [];
            for (let i = 0; i < n; i++) {
                const x = points[i][0];
                const computedY = lagrangeInterpolation(subPoints, x, k);
                if (computedY === points[i][1]) {
                    consistentCount++;
                } else {
                    inconsistent.push(i);
                }
            }
            console.log(`Consistent count: ${consistentCount}, Inconsistent: ${inconsistent}`);
            if (consistentCount === n && !firstValidSecret) {
                firstValidSecret = currentSecret;
                firstValidSubset = subset;
                wrongIndices = [];
            } else if (firstValidSecret && currentSecret !== firstValidSecret) {
                wrongIndices = Array.from({length: n}, (_, i) => i).filter(i => !firstValidSubset.includes(i));
            }
            if (consistentCount > maxConsistent) {
                maxConsistent = consistentCount;
                secret = currentSecret;
            }
        } catch (error) {
            console.log(`Error in subset: ${error.message}`);
            continue;
        }
    }
    
    console.log(`Final max consistent: ${maxConsistent}`);
    if (maxConsistent >= k) {
        console.log(`Using secret from first valid subset: ${firstValidSecret || secret}`);
        return { secret: firstValidSecret || secret, wrongIndices, maxConsistent };
    } else {
        return { secret: BigInt(0), wrongIndices: [], maxConsistent };
    }
}

function processShares(filename) {
    console.log(`Processing file: ${filename}`);
    try {
        if (!fs.existsSync(filename)) {
            throw new Error(`File ${filename} does not exist`);
        }
        console.log("Reading JSON file...");
        const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
        console.log("JSON parsed successfully:", JSON.stringify(data, null, 2));
        const { n, k } = data.keys;
        console.log(`n: ${n}, k: ${k}`);

        if (!n || !k || k > n) {
            throw new Error("Invalid n or k values");
        }

        const points = [];
        const shareIndices = Object.keys(data).filter(key => key !== "keys").map(Number).sort((a, b) => a - b);
        if (shareIndices.length !== n) {
            console.log(`Warning: Expected ${n} shares, but found ${shareIndices.length}. Using available shares.`);
        }

        for (let index of shareIndices) {
            const key = index.toString();
            if (!data[key]) {
                throw new Error(`Missing share for index ${key}`);
            }
            const { base, value } = data[key];
            console.log(`Parsing share ${key}: base=${base}, value=${value}`);
            const x = BigInt(index);
            const y = parseBase(value, parseInt(base));
            points.push([x, y]);
            console.log(`Point ${key}: (x=${x}, y=${y})`);
        }

        console.log("Finding inconsistent shares...");
        const { secret, wrongIndices, maxConsistent } = findInconsistentShares(points, k);
        console.log(`Max consistent points: ${maxConsistent}`);

        if (maxConsistent < k) {
            console.log("Not enough consistent shares to reconstruct the secret.");
            return;
        }

        console.log(`Secret: ${secret}`);
        if (wrongIndices.length > 0) {
            console.log(`Inconsistent shares at indices (1-based): [${wrongIndices.map(i => i + 1).join(', ')}]`);
        } else {
            console.log("All shares are consistent.");
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
        console.error(error.stack); // Log stack trace for debugging
    }
}

// Example usage
if (process.argv.length < 3) {
    console.log("Please provide a JSON filename as an argument.");
} else {
    processShares(process.argv[2]);
}