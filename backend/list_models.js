const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // Correct path to .env based on where we run it (backend root)
        const envPath = path.resolve(__dirname, '.env');
        let apiKey = '';

        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf8');
            const match = envConfig.match(/GEMINI_API_KEY=(.*)/);
            apiKey = match ? match[1].trim() : '';
        }

        // Clean quotes if present
        apiKey = apiKey.replace(/^["']|["']$/g, '');

        if (!apiKey) {
            console.error("No API Key found in .env");
            return;
        }

        console.log("API Key loaded: ✓");

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

        // Node 18+ has fetch
        const response = await fetch(url);
        const data = await response.json();

        console.log("\n--- Available Models ---");
        if (data.models) {
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`Name: ${m.name}`);
                    console.log(`Display: ${m.displayName}`);
                    console.log(`Version: ${m.version}`);
                    console.log('---');
                }
            });
        } else {
            console.log("No models found or error:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

main();
