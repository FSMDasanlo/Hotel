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
    const configSection = document.getElementById('configSection');
    const toggleConfigBtn = document.getElementById('toggleConfigBtn');
    const criteriaList = document.getElementById('criteriaList');
    const criteriaForm = document.getElementById('criteriaForm');
    
    const hotelsList = document.getElementById('hotelsList');
    const btnAddHotel = document.getElementById('btnAddHotel');
    const addHotelModal = document.getElementById('addHotelModal');
    const addHotelForm = document.getElementById('addHotelForm');
    const cancelAddHotel = document.getElementById('cancelAddHotel');
    const hotelRatingsInputs = document.getElementById('hotelRatingsInputs');
    const modalTitle = document.getElementById('modalTitle');
    const btnSaveHotel = document.getElementById('btnSaveHotel');
    const btnAnalyzeText = document.getElementById('btnAnalyzeText');
    const btnFetchFromUrl = document.getElementById('btnFetchFromUrl');
    
    // Elementos para editar viaje
    const btnEditTrip = document.getElementById('btnEditTrip');
    const editTripModal = document.getElementById('editTripModal');
    const btnDeleteTrip = document.getElementById('btnDeleteTrip');
    const editTripForm = document.getElementById('editTripForm');
    const cancelEditTrip = document.getElementById('cancelEditTrip');

    // --- ESTADO GLOBAL ---
    let currentTripConfig = {}; // Guardará { charId: { active: true, weight: 5, name: "..." } }
    let currentTripData = null;
    let editingHotelId = null; // ID del hotel que se está editando (null si es nuevo)
    let allCharacteristics = [];

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

    // 3. Cargar Hoteles (Listener en tiempo real)
    hotelsCollection.onSnapshot(snapshot => {
        const hotels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHotelsRanking(hotels);
    });

    // --- FUNCIONES UI: CONFIGURACIÓN ---

    toggleConfigBtn.addEventListener('click', () => {
        const isHidden = configSection.style.display === 'none';
        configSection.style.display = isHidden ? 'block' : 'none';
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
            configSection.style.display = 'none';
        } catch (error) {
            console.error("Error al guardar config:", error);
            alert("Error al guardar configuración");
        }
    });

    // --- FUNCIONES UI: EDITAR VIAJE ---

    btnEditTrip.addEventListener('click', () => {
        if (!currentTripData) return;

        // Rellenar formulario con datos actuales
        document.getElementById('editTripName').value = currentTripData.name;
        document.getElementById('editTripCity').value = currentTripData.city;
        document.getElementById('editTripRooms').value = currentTripData.rooms;
        document.getElementById('editTripPeople').value = currentTripData.people;

        // Formatear fechas para input date (YYYY-MM-DD)
        if (currentTripData.startDate) {
            document.getElementById('editTripStartDate').value = currentTripData.startDate.toDate().toISOString().split('T')[0];
        }
        if (currentTripData.endDate) {
            document.getElementById('editTripEndDate').value = currentTripData.endDate.toDate().toISOString().split('T')[0];
        }

        editTripModal.style.display = 'block';
    });

    cancelEditTrip.addEventListener('click', () => {
        editTripModal.style.display = 'none';
    });

    editTripForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const updatedData = {
            name: document.getElementById('editTripName').value,
            city: document.getElementById('editTripCity').value,
            rooms: parseInt(document.getElementById('editTripRooms').value),
            people: parseInt(document.getElementById('editTripPeople').value),
            startDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('editTripStartDate').value)),
            endDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('editTripEndDate').value))
        };

        try {
            await tripRef.update(updatedData);
            editTripModal.style.display = 'none';
            // La UI se actualizará sola gracias al onSnapshot
        } catch (error) {
            console.error("Error al actualizar viaje:", error);
            alert("Error al actualizar los datos del viaje.");
        }
    });

    btnDeleteTrip.addEventListener('click', async () => {
        if (!currentTripData) return;

        const confirmation = confirm(`¿Estás SEGURO de que quieres eliminar el viaje "${currentTripData.name}"?\n\n¡ESTA ACCIÓN ES PERMANENTE Y BORRARÁ TODOS LOS HOTELES ASOCIADOS!`);

        if (confirmation) {
            try {
                // 1. Get all hotels in the subcollection
                const hotelsSnapshot = await hotelsCollection.get();
                
                // 2. Create a batch to delete all hotels
                const batch = db.batch();
                hotelsSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();

                // 3. Delete the main trip document
                await tripRef.delete();

                // 4. Redirect to home
                alert('El viaje ha sido eliminado correctamente.');
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Error al eliminar el viaje:", error);
                alert("Hubo un error al eliminar el viaje. Revisa la consola.");
            }
        }
    });

    // --- FUNCIONES UI: AÑADIR HOTEL ---

    function renderRatingInputs() {
        hotelRatingsInputs.innerHTML = '';
        const activeIds = Object.keys(currentTripConfig);
        
        if (activeIds.length === 0) {
            return;
        }

        activeIds.forEach(charId => {
            const item = currentTripConfig[charId];
            const div = document.createElement('div');
            div.className = 'input-group';
            div.innerHTML = `
                <label style="font-size: 0.85rem;">${item.name} <span style="color:var(--secondary-color)">(x${item.weight})</span></label>
                <input type="number" name="rating_${charId}" min="0" max="10" placeholder="0-10" required>
            `;
            hotelRatingsInputs.appendChild(div);
        });
    }

    btnAddHotel.addEventListener('click', () => {
        if (Object.keys(currentTripConfig).length === 0) {
            alert("Primero debes configurar y guardar los criterios del viaje.");
            configSection.style.display = 'block';
            return;
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

        // 1. Resetear inputs y obtenerlos
        const allRatingInputs = hotelRatingsInputs.querySelectorAll('input[type="number"]');
        allRatingInputs.forEach(input => {
            input.value = '';
            input.classList.remove('rating-defaulted');
        });

        // Reglas de análisis: qué palabras buscar y qué nota poner.
        const analysisRules = [
            { nameMatches: ['piscina'], keywords: ['piscina', 'pool'], score: 8 },
            { nameMatches: ['gimnasio'], keywords: ['gimnasio', 'gym', 'fitness'], score: 8 },
            { nameMatches: ['wifi', 'wi-fi', 'conectividad'], keywords: ['wi-fi', 'wifi'], score: 7, negative: ['de pago', 'suplemento', 'con cargo'], negativeScore: 3 },
            { nameMatches: ['desayuno'], keywords: ['desayuno', 'breakfast'], score: 8, negative: ['de pago', 'suplemento', 'con cargo'], negativeScore: 4 },
            { nameMatches: ['mascotas', 'pet-friendly'], keywords: ['mascotas', 'pet-friendly', 'se admiten animales'], score: 9 },
            { nameMatches: ['parking', 'aparcamiento'], keywords: ['parking', 'aparcamiento', 'garaje'], score: 7 },
            { nameMatches: ['restaurante'], keywords: ['restaurante'], score: 8 },
            { nameMatches: ['bar'], keywords: ['bar'], score: 7 },
            { nameMatches: ['accesibilidad', 'accesible'], keywords: ['accesible', 'silla de ruedas'], score: 9 },
            { nameMatches: ['aire acondicionado'], keywords: ['aire acondicionado', 'a/c'], score: 9 },
            { nameMatches: ['centro de negocios', 'coworking'], keywords: ['centro de negocios', 'business center'], score: 7 },
            { nameMatches: ['servicio de habitaciones'], keywords: ['servicio de habitaciones', 'room service'], score: 7 },
            { nameMatches: ['traslado aeropuerto'], keywords: ['traslado aeropuerto', 'airport shuttle'], score: 7 },
        ];

        const scoredInputs = new Set();

        // Iteramos sobre las características activas en este viaje
        Object.keys(currentTripConfig).forEach(charId => {
            const characteristic = currentTripConfig[charId];
            const charNameLower = characteristic.name.toLowerCase();

            // Buscamos una regla que coincida con el nombre de la característica
            const rule = analysisRules.find(r => r.nameMatches.some(match => charNameLower.includes(match)));

            if (rule) {
                // Comprobamos si alguna palabra clave positiva está en el texto
                if (rule.keywords.some(kw => textToAnalyze.includes(kw))) {
                    let score = rule.score;

                    // Si se encontró, comprobamos si hay modificadores negativos
                    if (rule.negative && rule.negative.some(negKw => textToAnalyze.includes(negKw))) {
                        score = rule.negativeScore;
                    }

                    const input = document.querySelector(`input[name="rating_${charId}"]`);
                    if (input) {
                        input.value = score;
                        scoredInputs.add(input);
                    }
                }
            }
        });

        // 3. Para los no puntuados, poner 1 y estilo.
        allRatingInputs.forEach(input => {
            if (!scoredInputs.has(input)) {
                input.value = 1;
                input.classList.add('rating-defaulted');
            }
        });

        alert('Análisis completado. Revisa las puntuaciones sugeridas.');
    });

    btnFetchFromUrl.addEventListener('click', async () => {
        const hotelLinkInput = document.getElementById('hotelLink');
        const url = hotelLinkInput.value;
        if (!url || !url.startsWith('http')) {
            alert('Por favor, introduce una URL válida en el campo "Enlace".');
            return;
        }

        // Mostrar estado de carga
        btnFetchFromUrl.disabled = true;
        btnFetchFromUrl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const hotelCommentsTextarea = document.getElementById('hotelComments');

        try {
            // Llama a la Cloud Function. Asegúrate de que la región coincide.
            const functions = firebase.app().functions('europe-west1');
            const scrapeUrl = functions.httpsCallable('scrapeUrl');
            const result = await scrapeUrl({ url: url });

            if (result.data && result.data.text) {
                hotelCommentsTextarea.value = result.data.text;
                alert('Descripción cargada con éxito. Ahora puedes hacer clic en "Analizar Descripción".');
            } else {
                throw new Error(result.data.error || 'La función no devolvió texto.');
            }

        } catch (error) {
            console.error("Error al invocar la Cloud Function de scraping:", error);
            alert(`Hubo un error al cargar los datos de la URL: ${error.message}`);
            hotelCommentsTextarea.value = `Error al cargar desde ${url}. Detalles: ${error.message}`;
        } finally {
            // Restaurar el botón
            btnFetchFromUrl.disabled = false;
            btnFetchFromUrl.innerHTML = '<i class="fas fa-cloud-download-alt"></i>';
        }
    });

    addHotelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addHotelForm);
        
        const ratings = {};
        // Recorrer solo los criterios configurados
        Object.keys(currentTripConfig).forEach(charId => {
            const val = formData.get(`rating_${charId}`);
            if (val) {
                ratings[charId] = parseInt(val);
            }
        });

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

        hotelsList.innerHTML = '';
        
        if (rankedHotels.length === 0) {
            if (tripStats) tripStats.innerHTML = '';
            hotelsList.innerHTML = '<p style="text-align: center;">No hay hoteles añadidos aún.</p>';
            return;
        }

        // Actualizar Dashboard (Resumen)
        if (tripStats) {
            const totalHotels = rankedHotels.length;
            const avgPrice = (rankedHotels.reduce((sum, h) => sum + (h.price || 0), 0) / totalHotels).toFixed(0);
            tripStats.innerHTML = `
                <div><i class="fas fa-hotel" style="color: var(--secondary-color);"></i> <strong>${totalHotels}</strong> Hoteles</div>
                <div><i class="fas fa-tag" style="color: var(--secondary-color);"></i> <strong>${avgPrice} €</strong> Precio Medio</div>
                <button id="btnDownloadPDF" class="btn-secondary" style="padding: 0.3rem 0.8rem; font-size: 0.85rem; margin-left: auto; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-file-pdf"></i> Descargar PDF</button>
            `;
            
            document.getElementById('btnDownloadPDF').addEventListener('click', generatePDF);
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

        // Generar inputs y rellenar valores
        renderRatingInputs();
        
        if (hotel.ratings) {
            Object.keys(hotel.ratings).forEach(charId => {
                const input = document.querySelector(`input[name="rating_${charId}"]`);
                if (input) {
                    input.value = hotel.ratings[charId];
                }
            });
        }

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