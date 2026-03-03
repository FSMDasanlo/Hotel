const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

admin.initializeApp();

/**
 * Cloud Function que recibe una URL, extrae el texto principal de la página y lo devuelve.
 */
exports.scrapeUrl = functions
    .region("europe-west1") // IMPORTANTE: Esta región debe coincidir con la que usas en viaje.js
    .https.onCall(async (data, context) => {
        const url = data.url;

        if (!url || !url.startsWith("http")) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "La función debe ser llamada con un argumento 'url' válido."
            );
        }

        try {
            // Hacemos la petición a la URL, simulando ser un navegador
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                },
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // Lógica de extracción de texto. Intentamos ser genéricos.
            // Eliminamos elementos que no suelen tener contenido útil.
            $("script, style, nav, header, footer, aside, form").remove();
            
            // Obtenemos el texto del body, limpiamos espacios y saltos de línea.
            const text = $("body").text()
                .replace(/(\r\n|\n|\r)/gm, " ") // Reemplazar saltos de línea por espacios
                .replace(/\s\s+/g, " ")       // Reemplazar múltiples espacios por uno solo
                .trim();

            if (!text) {
                return { error: "No se pudo extraer contenido de texto de la página." };
            }

            // Devolvemos el texto, limitado a 15000 caracteres para no exceder límites.
            return { text: text.substring(0, 15000) };

        } catch (error) {
            console.error("Error durante el scraping:", error.message);
            throw new functions.https.HttpsError(
                "unknown",
                `No se pudo acceder a la URL. Es posible que el sitio esté protegido contra scraping. Error: ${error.message}`
            );
        }
    });
