document.addEventListener('DOMContentLoaded', async () => {
    // --- UTILIDADES ---
    function getTripIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    const tripId = getTripIdFromUrl();
    if (!tripId) {
        alert('No se ha especificado un viaje.');
        window.location.href = 'index.html';
        return;
    }

    // --- Enlace a Comparativo ---
    const comparativoLink = document.getElementById('comparativoLink');
    if (comparativoLink) {
        comparativoLink.href = `comparativo.html?id=${tripId}`;
    }

    // --- REFERENCIAS FIREBASE ---
    const tripRef = db.collection('trips').doc(tripId);
    const hotelsCollection = tripRef.collection('hotels');
    const characteristicsCollection = db.collection('characteristics');

    // --- ELEMENTOS DOM ---
    const tripTitle = document.getElementById('tripTitle');
    const tripDetails = document.getElementById('tripDetails');
    const tripStats = document.getElementById('tripStats');
    const criteriaList = document.getElementById('criteriaList');
    const criteriaForm = document.getElementById('criteriaForm');
    const configModal = document.getElementById('configModal');
    const btnShowConfig = document.getElementById('btnShowConfig');
    const cancelConfig = document.getElementById('cancelConfig');

    const hotelsList = document.getElementById('hotelsList');
    const btnAddHotel = document.getElementById('btnAddHotel');
    const addHotelModal = document.getElementById('addHotelModal');
    const addHotelForm = document.getElementById('addHotelForm');
    const cancelAddHotel = document.getElementById('cancelAddHotel');
    const hotelRatingsInputs = document.getElementById('hotelRatingsInputs');
    const modalTitle = document.getElementById('modalTitle');
    const btnSaveHotel = document.getElementById('btnSaveHotel');
    const btnAnalyzeText = document.getElementById('btnAnalyzeText');
    const btnOpenUrl = document.getElementById('btnOpenUrl');
    
    // Elementos para Conclusión IA
    const btnConclusion = document.getElementById('btnConclusion');
    const conclusionModal = document.getElementById('conclusionModal');
    const closeConclusionModal = document.getElementById('closeConclusionModal');
    const conclusionModalBody = document.getElementById('conclusionModalBody');
    const btnDownloadPDF = document.getElementById('btnDownloadPDF');

    // --- ESTADO GLOBAL ---
    let currentTripConfig = {}; // Guardará { charId: { active: true, weight: 5, name: "..." } }
    let currentTripData = null;
    let editingHotelId = null; // ID del hotel que se está editando (null si es nuevo)
    let allCharacteristics = [];
    let rankedHotelsList = []; // Para guardar la lista ordenada de hoteles

    // --- CARGA INICIAL ---
    
    // 1. Cargar Info del Viaje
    tripRef.onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            currentTripData = data;
            tripTitle.textContent = data.name;
            tripDetails.textContent = `${data.city} | ${data.rooms} hab. | ${data.people} pers.`;
            
            // Actualizar configuración local si existe en la BD
            if (data.criteriaConfig) {
                currentTripConfig = data.criteriaConfig;
            }
            
            // Si ya tenemos las características maestras cargadas, refrescamos la UI
            if (allCharacteristics.length > 0) {
                renderConfigTable();
            }
        }
    });

    // 2. Cargar Características Maestras
    const snapshot = await characteristicsCollection.orderBy('category').get();
    allCharacteristics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderConfigTable();

    btnDownloadPDF.addEventListener('click', generatePDF);

    // 3. Cargar Hoteles (Listener en tiempo real)
    hotelsCollection.onSnapshot(snapshot => {
        const hotels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHotelsRanking(hotels);
    });

    // --- FUNCIONES UI: CONFIGURACIÓN ---

    btnShowConfig.addEventListener('click', () => {
        configModal.style.display = 'block';
        // Scroll suave hacia el formulario
        configModal.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    cancelConfig.addEventListener('click', () => {
        configModal.style.display = 'none';
    });

    function renderConfigTable() {
        let html = '<table class="criteria-table"><thead><tr><th>Activo</th><th>Categoría</th><th>Característica</th><th>Peso (1-9)</th></tr></thead><tbody>';
        
        // Agrupar para visualización (opcional, aquí listamos plano pero ordenado)
        // Usamos allCharacteristics que ya viene ordenado por categoría desde Firebase
        
        allCharacteristics.forEach(char => {
            // Verificar si está configurado en el viaje
            const config = currentTripConfig[char.id] || { active: false, weight: 1 };
            
            html += `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" name="active_${char.id}" ${config.active ? 'checked' : ''}>
                    </td>
                    <td><small>${char.category}</small></td>
                    <td>${char.name}</td>
                    <td>
                        <input type="number" name="weight_${char.id}" min="1" max="9" value="${config.weight}">
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        criteriaList.innerHTML = html;
    }

    // Guardar Configuración
    criteriaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(criteriaForm);
        const newConfig = {};

        allCharacteristics.forEach(char => {
            const isActive = formData.get(`active_${char.id}`) === 'on';
            const weight = parseInt(formData.get(`weight_${char.id}`));
            
            if (isActive) {
                newConfig[char.id] = {
                    active: true,
                    weight: weight,
                    name: char.name, // Guardamos el nombre por si se borra de la maestra
                    category: char.category
                };
            }
        });

        try {
            await tripRef.update({ criteriaConfig: newConfig });
            alert('Configuración guardada. Los puntos de los hoteles se recalcularán.');
            configModal.style.display = 'none';
        } catch (error) {
            console.error("Error al guardar config:", error);
            alert("Error al guardar configuración");
        }
    });

    // --- FUNCIONES UI: AÑADIR HOTEL ---

    function renderRatingInputs(ratings = {}) {
        hotelRatingsInputs.innerHTML = '';
        const charIdsToRender = Object.keys(ratings);
    
        if (charIdsToRender.length === 0) {
            hotelRatingsInputs.innerHTML = '<p style="grid-column: 1 / -1; font-size: 0.9em; color: var(--text-light-color);">Pega una descripción y pulsa "Analizar" para generar las valoraciones, o añade valoraciones manualmente si lo prefieres.</p>';
            return;
        }
    
        charIdsToRender.forEach(charId => {
            const tripConfigItem = currentTripConfig[charId];
            const masterChar = allCharacteristics.find(c => c.id === charId);
    
            const name = tripConfigItem?.name || masterChar?.name || 'Característica Desconocida';
            const weight = tripConfigItem?.weight || 1;
            const ratingValue = ratings[charId];
    
            const div = document.createElement('div');
            div.className = 'input-group';
            div.innerHTML = `
                <label style="font-size: 0.85rem;">${name} <span style="color:var(--secondary-color)">(x${weight})</span></label>
                <input type="number" name="rating_${charId}" min="0" max="10" placeholder="0-10" required value="${ratingValue}">
            `;
            hotelRatingsInputs.appendChild(div);
        });
    }

    btnAddHotel.addEventListener('click', () => {
        if (Object.keys(currentTripConfig).length === 0) {
        }
        editingHotelId = null;
        modalTitle.textContent = "Añadir Nuevo Hotel";
        btnSaveHotel.textContent = "Guardar Hotel";
        renderRatingInputs();

        addHotelModal.style.display = 'block';
        btnAddHotel.style.display = 'none';
        
        // Scroll suave hacia el formulario
        addHotelModal.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    cancelAddHotel.addEventListener('click', () => {
        addHotelModal.style.display = 'none';
        btnAddHotel.style.display = 'inline-flex';
        addHotelForm.reset();
    });

    // --- ANALIZADOR DE TEXTO (SIN IA) ---
    btnAnalyzeText.addEventListener('click', () => {
        const textToAnalyze = document.getElementById('hotelComments').value.toLowerCase();
        if (!textToAnalyze) {
            alert('Pega primero una descripción en el campo de texto para poder analizarla.');
            return;
        }

        hotelRatingsInputs.innerHTML = '';

        // Reglas de análisis: qué palabras buscar y qué nota poner.
        // nameMatches: partes del nombre de la característica en BD (ej: 'ubicación' coincide con '📍 5. Ubicación')
        // keywords: palabras a buscar en el texto del usuario
        const analysisRules = [
            { 
                nameMatches: ['ubicación', 'ubicacion', 'situación', 'entorno'], 
                keywords: ['ubicación', 'ubicacion', 'situación', 'centro', 'cerca', 'lejos', 'barrio', 'zona', 'vistas'], 
                score: 8, 
                positive: ['excelente', 'buena', 'perfecta', 'céntrico', 'mejor', 'espectacular'], positiveScore: 10,
                negative: ['mala', 'lejos', 'apartado', 'peligroso', 'ruidoso', 'peor'], negativeScore: 4
            },
            { 
                nameMatches: ['limpieza', 'higiene'], 
                keywords: ['limpio', 'limpieza', 'sucio', 'impecable', 'pulcro', 'manchas'], 
                score: 8,
                positive: ['impecable', 'perfecta', 'brillante'], positiveScore: 10,
                negative: ['sucio', 'polvo', 'manchas', 'olor', 'falta'], negativeScore: 3
            },
            { 
                nameMatches: ['personal', 'atención', 'servicio', 'amabilidad'], 
                keywords: ['personal', 'staff', 'recepción', 'amable', 'trato', 'atento', 'servicio'], 
                score: 8,
                positive: ['encantador', 'excelente', 'ayuda', 'rápido'], positiveScore: 10,
                negative: ['borde', 'antipático', 'lento', 'maleducado', 'malo'], negativeScore: 3
            },
            { 
                nameMatches: ['habitación', 'habitaciones', 'confort'], 
                keywords: ['habitación', 'cama', 'colchón', 'almohada', 'espacio', 'descanso'], 
                score: 7,
                positive: ['grande', 'espaciosa', 'cómoda', 'confortable', 'enorme'], positiveScore: 9,
                negative: ['pequeña', 'incomoda', 'dura', 'vieja', 'zulo'], negativeScore: 4
            },
            { 
                nameMatches: ['baño', 'aseo'], 
                keywords: ['baño', 'ducha', 'agua', 'toallas', 'presión'], 
                score: 7,
                positive: ['nuevo', 'grande', 'moderno'], positiveScore: 9,
                negative: ['pequeño', 'sucio', 'fría', 'viejo'], negativeScore: 4
            },
            { 
                nameMatches: ['ruido', 'insonorización', 'tranquilidad'], 
                keywords: ['ruido', 'silencioso', 'tranquilo', 'insonorizado', 'paredes'], 
                score: 8,
                negative: ['ruido', 'paredes de papel', 'se oye todo', 'molesto'], negativeScore: 3
            },
            { 
                nameMatches: ['desayuno', 'gastronomía', 'comida'], 
                keywords: ['desayuno', 'breakfast', 'buffet', 'comida', 'cena'], 
                score: 8, 
                positive: ['variado', 'rico', 'delicioso', 'abundante'], positiveScore: 9,
                negative: ['pobre', 'escaso', 'malo', 'caro', 'de pago'], negativeScore: 4 
            },
            { nameMatches: ['piscina'], keywords: ['piscina', 'pool'], score: 9, negative: ['pequeña', 'sucia', 'cerrada'], negativeScore: 5 },
            { nameMatches: ['gimnasio', 'deporte'], keywords: ['gimnasio', 'gym', 'fitness'], score: 8 },
            { nameMatches: ['wifi', 'wi-fi', 'internet', 'conectividad'], keywords: ['wi-fi', 'wifi', 'internet', 'conexión'], score: 8, negative: ['lento', 'malo', 'de pago', 'no funciona'], negativeScore: 3 },
            { nameMatches: ['mascotas', 'pet-friendly'], keywords: ['mascotas', 'pet-friendly', 'perros', 'gatos'], score: 10 },
            { nameMatches: ['parking', 'aparcamiento'], keywords: ['parking', 'aparcamiento', 'garaje', 'coche'], score: 8, negative: ['caro', 'pequeño', 'completo'], negativeScore: 5 },
            { nameMatches: ['aire acondicionado', 'climatización'], keywords: ['aire acondicionado', 'a/c', 'calefacción', 'frío', 'calor'], score: 9, negative: ['no funciona', 'ruidoso', 'roto'], negativeScore: 3 },
            { nameMatches: ['calidad-precio', 'precio'], keywords: ['precio', 'caro', 'barato', 'económico', 'calidad-precio'], score: 7, positive: ['buen precio', 'barato', 'económico', 'ganga'], positiveScore: 9, negative: ['caro', 'excesivo', 'robo'], negativeScore: 4 }
        ];

        // Iteramos sobre TODAS las características maestras para encontrar coincidencias
        allCharacteristics.forEach(characteristic => {
            const charId = characteristic.id;
            const charNameLower = characteristic.name.toLowerCase();
            let score = null;

            // 1. Buscamos una regla específica
            const rule = analysisRules.find(r => r.nameMatches.some(match => charNameLower.includes(match)));

            if (rule) {
                // Comprobamos si alguna palabra clave está en el texto
                if (rule.keywords.some(kw => textToAnalyze.includes(kw))) {
                    score = rule.score; // Puntuación base

                    // Ajuste por contexto negativo
                    if (rule.negative && rule.negative.some(negKw => textToAnalyze.includes(negKw))) {
                        score = rule.negativeScore;
                    }
                    // Ajuste por contexto positivo (si no es negativo)
                    else if (rule.positive && rule.positive.some(posKw => textToAnalyze.includes(posKw))) {
                        score = rule.positiveScore;
                    }
                }
            }
            
            // 2. Fallback inteligente: Si no hay regla (o no saltó), buscamos el nombre de la característica en el texto
            if (score === null) {
                // Limpiamos el nombre (quitamos emojis y números ej: "📍 5. Ubicación" -> "ubicación")
                const cleanName = charNameLower
                    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Emojis
                    .replace(/^\d+\.\s*/, '') // "1. "
                    .trim();
                
                // Si el nombre limpio (ej: "sostenibilidad") aparece en el texto, lo añadimos
                if (cleanName.length > 3 && textToAnalyze.includes(cleanName)) {
                    score = 7; // Puntuación neutra por defecto al mencionar la característica
                }
            }

            // Si hemos calculado un score, añadimos el input
            if (score !== null) {
                const config = currentTripConfig[charId] || { weight: 1 };
                const div = document.createElement('div');
                div.className = 'input-group';
                div.innerHTML = `
                    <label style="font-size: 0.85rem;">${characteristic.name} <span style="color:var(--secondary-color)">(x${config.weight})</span></label>
                    <input type="number" name="rating_${charId}" min="0" max="10" placeholder="0-10" required value="${score}">
                `;
                hotelRatingsInputs.appendChild(div);
            }
        });

        if (hotelRatingsInputs.childElementCount === 0) {
            hotelRatingsInputs.innerHTML = '<p style="grid-column: 1 / -1; font-size: 0.9em; color: var(--text-light-color);">No se encontraron características relevantes en la descripción.</p>';
        }
        alert('Análisis completado. Se han generado valoraciones para las características encontradas.');
    });

    btnOpenUrl.addEventListener('click', () => {
        const urlInput = document.getElementById('hotelLink');
        const url = urlInput.value.trim();
        // Comprobamos que la URL no esté vacía y parezca válida
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            window.open(url, '_blank');
        } else {
            alert('Por favor, introduce una URL válida que empiece con http:// o https://');
        }
    });

    // --- LÓGICA CONCLUSIÓN IA ---
    btnConclusion.addEventListener('click', () => {
        if (rankedHotelsList.length === 0) {
            alert('Añade y puntúa al menos un hotel para obtener una conclusión.');
            return;
        }

        const winner = rankedHotelsList[0];
        const secondPlace = rankedHotelsList.length > 1 ? rankedHotelsList[1] : null;

        // Generar contenido
        let conclusionHtml = `
            <p style="font-size: 1.1rem; text-align: center;">Tras un análisis exhaustivo de las opciones, la elección es clara:</p>
            <h2 style="text-align: center; color: var(--accent-color); font-size: 2.5rem; margin: 1rem 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">${winner.name}</h2>
            <p>Este hotel se ha coronado como el <strong>ganador indiscutible</strong> de nuestro ranking, y aquí te explicamos por qué es la decisión perfecta para vuestro viaje a <strong>${currentTripData.city}</strong>.</p>
        `;

        // Encontrar los puntos fuertes
        const winnerRatings = winner.ratings || {};
        const topRatedChars = Object.keys(winnerRatings)
            .filter(charId => currentTripConfig[charId] && winnerRatings[charId] >= 8) // Características activas con nota alta
            .map(charId => ({
                name: currentTripConfig[charId].name,
                rating: winnerRatings[charId],
                weight: currentTripConfig[charId].weight,
                score: winnerRatings[charId] * currentTripConfig[charId].weight
            }))
            .sort((a, b) => b.score - a.score) // Ordenar por puntos aportados
            .slice(0, 3); // Coger los 3 mejores

        if (topRatedChars.length > 0) {
            conclusionHtml += `<h4 style="margin-top: 2rem; color: var(--primary-color);">Sus Puntos Fuertes Clave:</h4><ul style="list-style-type: '✅'; padding-left: 1.5rem;">`;
            topRatedChars.forEach(char => {
                conclusionHtml += `<li style="margin-bottom: 0.5rem;">Destaca enormemente en <strong>${char.name}</strong>, logrando una puntuación de <strong>${char.rating} sobre 10</strong>.</li>`;
            });
            conclusionHtml += `</ul>`;
        }

        // Comparativa de precio
        if (secondPlace) {
            if (winner.price <= secondPlace.price) {
                conclusionHtml += `<p style="margin-top: 1.5rem;">Además, su precio de <strong>${winner.price}€</strong> es muy competitivo, siendo igual o más económico que su rival más cercano.</p>`;
            } else {
                const priceDiff = winner.price - secondPlace.price;
                conclusionHtml += `<p style="margin-top: 1.5rem;">Aunque su precio de <strong>${winner.price}€</strong> es ${priceDiff}€ superior a la siguiente opción, la diferencia en calidad y puntuación (${winner.totalScore} vs ${secondPlace.totalScore} pts) justifica con creces la inversión.</p>`;
            }
        } else {
            conclusionHtml += `<p style="margin-top: 1.5rem;">Con un precio de <strong>${winner.price}€</strong>, ofrece una propuesta de valor excelente.</p>`;
        }

        conclusionHtml += `
            <div style="margin-top: 2rem; padding: 1rem; background-color: #eef2f5; border-radius: var(--border-radius); text-align: center;">
                <p style="font-weight: 600; font-size: 1.2rem; color: var(--primary-color);">En resumen: ¡Habéis acertado!</p>
                <p>Elegir el <strong>${winner.name}</strong> es apostar sobre seguro. Podéis estar tranquilos, esta elección garantiza una experiencia memorable para vuestro viaje.</p>
            </div>
        `;

        conclusionModalBody.innerHTML = conclusionHtml;
        conclusionModal.style.display = 'flex';
    });

    closeConclusionModal.addEventListener('click', () => conclusionModal.style.display = 'none');
    conclusionModal.addEventListener('click', (e) => {
        if (e.target === conclusionModal) conclusionModal.style.display = 'none';
    });

    addHotelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const ratings = {};
        // Recorrer los inputs que estén actualmente en el DOM
        const ratingInputs = hotelRatingsInputs.querySelectorAll('input[type="number"]');
        ratingInputs.forEach(input => {
            const charId = input.name.replace('rating_', '');
            if (input.value !== '') {
                ratings[charId] = parseInt(input.value);
            }
        });

        // --- ACTUALIZACIÓN AUTOMÁTICA DE CRITERIOS ---
        // Si el hotel trae valoraciones nuevas, las activamos en la configuración del viaje
        let configChanged = false;
        const updatedConfig = { ...currentTripConfig };

        Object.keys(ratings).forEach(charId => {
            // Si la característica tiene nota pero no está activa en el viaje
            if (!updatedConfig[charId] || !updatedConfig[charId].active) {
                const masterChar = allCharacteristics.find(c => c.id === charId);
                if (masterChar) {
                    updatedConfig[charId] = {
                        active: true,
                        weight: updatedConfig[charId]?.weight || 1, // Peso 1 por defecto si es nueva
                        name: masterChar.name,
                        category: masterChar.category
                    };
                    configChanged = true;
                }
            }
        });

        if (configChanged) {
            try {
                await tripRef.update({ criteriaConfig: updatedConfig });
            } catch (error) {
                console.error("Error al actualizar criterios del viaje:", error);
            }
        }
        // ---------------------------------------------

        const hotelData = {
            name: document.getElementById('hotelName').value,
            link: document.getElementById('hotelLink').value,
            price: parseFloat(document.getElementById('hotelPrice').value) || 0,
            comments: document.getElementById('hotelComments').value,
            ratings: ratings,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Si estamos editando, mantenemos la fecha de creación original (o la ignoramos al actualizar)
        if (editingHotelId) {
            delete hotelData.createdAt; // No actualizamos la fecha de creación
        }

        try {
            if (editingHotelId) {
                await hotelsCollection.doc(editingHotelId).update(hotelData);
            } else {
                await hotelsCollection.add(hotelData);
            }
            addHotelModal.style.display = 'none';
            btnAddHotel.style.display = 'inline-flex';
            addHotelForm.reset();
        } catch (error) {
            console.error("Error al añadir hotel:", error);
            alert("Error al añadir hotel");
        }
    });

    // --- FUNCIONES UI: RANKING Y LISTADO ---

    function calculateTotalScore(ratings) {
        let total = 0;
        if (!ratings) return 0;
        
        // Iteramos sobre la configuración del viaje para usar los pesos actuales
        Object.keys(currentTripConfig).forEach(charId => {
            const config = currentTripConfig[charId];
            const rating = ratings[charId] || 0; // Si no se votó, es 0
            total += rating * config.weight;
        });
        return total;
    }

    function renderHotelsRanking(hotels) {
        // 1. Calcular puntuación por PRECIO
        // Ordenamos por precio ascendente (barato a caro) para asignar puntos
        const sortedByPrice = [...hotels].sort((a, b) => (a.price || 0) - (b.price || 0));
        const priceScoreMap = {};
        
        sortedByPrice.forEach((h, index) => {
            // 10 puntos al 1º, 7 al 2º, 4 al 3º, 1 al 4º, -2 al 5º...
            priceScoreMap[h.id] = 10 - (index * 3);
        });

        // 2. Calcular puntuaciones totales y ordenar
        const rankedHotels = hotels.map(h => {
            const ratingScore = calculateTotalScore(h.ratings);
            const priceScore = priceScoreMap[h.id] || 0;
            return { ...h, ratingScore, priceScore, totalScore: ratingScore + priceScore };
        }).sort((a, b) => b.totalScore - a.totalScore);

        rankedHotelsList = rankedHotels; // Guardar la lista ordenada para usarla en otros sitios

        hotelsList.innerHTML = '';
        
        if (rankedHotels.length === 0) {
            if (tripStats) tripStats.innerHTML = '';
            hotelsList.innerHTML = '<p style="text-align: center;">No hay hoteles añadidos aún.</p>';
            if (btnDownloadPDF) btnDownloadPDF.style.display = 'none';
            return;
        }

        if (btnDownloadPDF) btnDownloadPDF.style.display = 'inline-flex';

        // Actualizar Dashboard (Resumen)
        if (tripStats) {
            const totalHotels = rankedHotels.length;
            const avgPrice = (rankedHotels.reduce((sum, h) => sum + (h.price || 0), 0) / totalHotels).toFixed(0);
            tripStats.innerHTML = `
                <div><i class="fas fa-hotel" style="color: var(--secondary-color);"></i> <strong>${totalHotels}</strong> Hoteles</div>
                <div><i class="fas fa-tag" style="color: var(--secondary-color);"></i> <strong>${avgPrice} €</strong> Precio Medio</div>
            `;
        }

        rankedHotels.forEach((hotel, index) => {
            const card = document.createElement('div');
            card.className = 'hotel-card';
            if (index === 0) {
                card.classList.add('hotel-winner');
            }
            
            // Generar detalle de puntos
            let detailsHtml = '<h4>Desglose de Puntos</h4><ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem;">';
            
            // Mostrar comentarios si existen
            if (hotel.comments) {
                detailsHtml = `<div style="margin-bottom: 1rem; padding: 0.8rem; background-color: #f8f9fa; border-left: 4px solid var(--secondary-color); border-radius: 4px; font-size: 0.9rem;">
                    <strong><i class="fas fa-sticky-note"></i> Notas:</strong> ${hotel.comments}
                </div>` + detailsHtml;
            }
            
            // Añadir detalle del precio
            detailsHtml += `<li style="font-size: 0.9rem; border-bottom: 1px solid #eee; padding: 0.2rem 0; background-color: #fff3cd;">
                                <strong>💰 Precio (${hotel.price}€):</strong> ${hotel.priceScore} pts
                            </li>`;

            Object.keys(currentTripConfig).forEach(charId => {
                const config = currentTripConfig[charId];
                const rating = hotel.ratings ? (hotel.ratings[charId] || 0) : 0;
                const points = rating * config.weight;
                detailsHtml += `
                    <li style="font-size: 0.9rem; border-bottom: 1px solid #eee; padding: 0.2rem 0;">
                        <strong>${config.name}:</strong> ${rating} <small>x${config.weight}</small> = <b>${points}</b>
                    </li>
                `;
            });
            detailsHtml += '</ul>';
            if(hotel.link) detailsHtml += `<div style="margin-top:1rem;"><a href="${hotel.link}" target="_blank" class="btn-secondary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">Ver Hotel <i class="fas fa-external-link-alt"></i></a></div>`;

            card.innerHTML = `
                <div class="hotel-header" onclick="this.nextElementSibling.classList.toggle('active')">
                    <div class="hotel-position">#${index + 1}</div>
                    <div style="font-weight: 600; font-size: 1.1rem;">${hotel.name}</div>
                    <div class="hotel-price">${hotel.price} €</div>
                    <div class="hotel-score">${hotel.totalScore} pts</div>
                    <div class="hotel-actions">
                        <button class="btn-edit-hotel" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-delete-hotel" title="Borrar"><i class="fas fa-trash-alt"></i></button>
                    </div>
                    <div><i class="fas fa-chevron-down"></i></div>
                </div>
                <div class="hotel-details">
                    ${detailsHtml}
                </div>
            `;
            
            // Añadir eventos a los botones de acción
            const btnEdit = card.querySelector('.btn-edit-hotel');
            const btnDelete = card.querySelector('.btn-delete-hotel');

            btnEdit.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar que se abra el acordeón
                openEditModal(hotel);
            });

            btnDelete.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`¿Estás seguro de borrar el hotel "${hotel.name}"?`)) {
                    try {
                        await hotelsCollection.doc(hotel.id).delete();
                    } catch (error) {
                        console.error("Error al borrar:", error);
                        alert("Error al borrar el hotel");
                    }
                }
            });

            hotelsList.appendChild(card);
        });
    }

    function openEditModal(hotel) {
        editingHotelId = hotel.id;
        modalTitle.textContent = "Editar Hotel";
        btnSaveHotel.textContent = "Actualizar Hotel";
        
        // Rellenar datos básicos
        document.getElementById('hotelName').value = hotel.name;
        document.getElementById('hotelPrice').value = hotel.price;
        document.getElementById('hotelLink').value = hotel.link || '';
        document.getElementById('hotelComments').value = hotel.comments || '';

        renderRatingInputs(hotel.ratings || {});

        addHotelModal.style.display = 'block';
        btnAddHotel.style.display = 'none';
    }

    // --- GENERAR PDF ---
    async function generatePDF() {
        const btn = document.getElementById('btnDownloadPDF');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        btn.disabled = true;

        // Crear contenedor temporal para el PDF
        const pdfContainer = document.createElement('div');
        pdfContainer.style.padding = '20px';
        pdfContainer.style.fontFamily = 'Poppins, sans-serif';
        pdfContainer.style.color = '#333';
        pdfContainer.style.background = 'white';

        // 1. Header (Logo + Título + Stats)
        const headerDiv = document.createElement('div');
        headerDiv.style.marginBottom = '20px';
        headerDiv.style.borderBottom = '2px solid var(--secondary-color)';
        headerDiv.style.paddingBottom = '10px';
        
        const title = document.createElement('h1');
        title.textContent = tripTitle.textContent;
        title.style.color = 'var(--primary-color)';
        headerDiv.appendChild(title);

        const details = document.createElement('p');
        details.textContent = tripDetails.textContent;
        details.style.color = '#666';
        headerDiv.appendChild(details);

        // Clonar stats pero quitar el botón de PDF
        const statsClone = tripStats.cloneNode(true);
        const pdfBtn = statsClone.querySelector('#btnDownloadPDF');
        if(pdfBtn) pdfBtn.remove();
        statsClone.style.marginTop = '10px';
        headerDiv.appendChild(statsClone);

        pdfContainer.appendChild(headerDiv);

        // 2. Ranking de Hoteles
        const rankingDiv = document.createElement('div');
        const hotels = hotelsList.querySelectorAll('.hotel-card');
        
        hotels.forEach(card => {
            const cardClone = card.cloneNode(true);
            cardClone.style.marginBottom = '15px';
            cardClone.style.border = '1px solid #ddd';
            cardClone.style.pageBreakInside = 'avoid'; // Evitar cortes de página en mitad de un hotel

            // Limpiar interfaz (quitar botones de acción y chevrons)
            const actions = cardClone.querySelector('.hotel-actions');
            if(actions) actions.remove();
            const chevron = cardClone.querySelector('.fa-chevron-down');
            if(chevron && chevron.parentNode) chevron.parentNode.remove();

            // Forzar que los detalles estén visibles
            const details = cardClone.querySelector('.hotel-details');
            details.style.display = 'block';
            details.style.borderTop = '1px solid #eee';

            rankingDiv.appendChild(cardClone);
        });

        pdfContainer.appendChild(rankingDiv);

        // Configuración y generación
        const opt = {
            margin:       10,
            filename:     `Roomly_${currentTripData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(pdfContainer).save();
        } catch (error) {
            console.error("Error PDF:", error);
            alert("Error al generar el PDF.");
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
});