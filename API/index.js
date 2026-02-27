const express = require('express');
const app = express();
app.use(express.json());

// ─────────────────────────────────
//  PRIME NUMBER for secure math
// ─────────────────────────────────
const PRIME = 2083n;  // n means BigInt

// ─────────────────────────────────
//  STEP 1: Generate Shares
// ─────────────────────────────────
function generateShares(secret, k, n) {
    // Build polynomial coefficients
    // f(x) = secret + a1*x + a2*x^2 ...
    const coefficients = [BigInt(secret)];  // a0 = secret

    for (let i = 1; i < k; i++) {
        // random coefficients a1, a2 ...
        const random = BigInt(Math.floor(Math.random() * 1000) + 1);
        coefficients.push(random);
    }

    // Generate n shares using f(1), f(2) ... f(n)
    const shares = [];
    for (let x = 1; x <= n; x++) {
        let y = 0n;
        for (let i = 0; i < coefficients.length; i++) {
            y += coefficients[i] * (BigInt(x) ** BigInt(i));
        }
        y = ((y % PRIME) + PRIME) % PRIME;  // handle negative mod
        shares.push({ x: x, y: y.toString() });
    }

    return shares;
}

// ─────────────────────────────────
//  STEP 2: Modular Inverse
// ─────────────────────────────────
function modInverse(a, p) {
    a = ((a % p) + p) % p;  // handle negative
    return a ** (p - 2n) % p;  // Fermat's little theorem
}

// ─────────────────────────────────
//  STEP 3: Reconstruct Secret
// ─────────────────────────────────
function reconstructSecret(shares) {
    let secret = 0n;

    for (let i = 0; i < shares.length; i++) {
        let numerator = 1n;
        let denominator = 1n;

        const xi = BigInt(shares[i].x);
        const yi = BigInt(shares[i].y);

        for (let j = 0; j < shares.length; j++) {
            if (i !== j) {
                const xj = BigInt(shares[j].x);
                numerator = (numerator * (0n - xj)) % PRIME;
                denominator = (denominator * (xi - xj)) % PRIME;
            }
        }

        const lagrange = yi * numerator * modInverse(denominator, PRIME) % PRIME;
        secret = (secret + lagrange + PRIME) % PRIME;
    }

    return secret.toString();
}

// ─────────────────────────────────
//  ROUTES
// ─────────────────────────────────

// Route 1 - Info
app.get('/api/sss/info', (req, res) => {
    res.json({
        algorithm: "Shamir's Secret Sharing",
        description: "Splits a secret into n shares, requires k shares to reconstruct",
        prime: PRIME.toString(),
        usage: {
            split: "POST /api/sss/split",
            reconstruct: "POST /api/sss/reconstruct"
        }
    });
});

// Route 2 - Split
app.post('/api/sss/split', (req, res) => {
    const { secret, k, n } = req.body;

    // Validations
    if (secret === undefined)
        return res.status(400).json({ error: 'secret is required' });
    if (secret < 0)
        return res.status(400).json({ error: 'secret must be a positive number' });
    if (!k || !n)
        return res.status(400).json({ error: 'k and n are required' });
    if (k < 2)
        return res.status(400).json({ error: 'k must be at least 2' });
    if (k > n)
        return res.status(400).json({ error: 'k must be less than or equal to n' });

    const shares = generateShares(secret, k, n);

    res.json({
        message: 'Secret split successfully',
        threshold: k,
        totalShares: n,
        shares: shares
    });
});

// Route 3 - Reconstruct
app.post('/api/sss/reconstruct', (req, res) => {
    const { shares, k } = req.body;

    // Validations
    if (!shares || shares.length === 0)
        return res.status(400).json({ error: 'shares array is required' });
    if (shares.length < 2)
        return res.status(400).json({ error: 'Not enough shares to reconstruct' });
    if (k && shares.length < k)
        return res.status(400).json({ error: 'Not enough shares to reconstruct' });

    const secret = reconstructSecret(shares);

    res.json({
        message: 'Secret reconstructed successfully',
        secret: secret
    });
});

// ─────────────────────────────────
//  START SERVER
// ─────────────────────────────────
app.listen(3000, () => {
    console.log('SSS API running on port 3000');
});