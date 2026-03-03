document.addEventListener('DOMContentLoaded', async () => {
    // --- UTILIDADES Y CONFIG INICIAL ---
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

    // --- REFERENCIAS FIREBASE ---
    const tripRef = db.collection('trips').doc(tripId);
    const hotelsCollection = tripRef.collection('hotels');

    // --- ELEMENTOS DOM ---
    const tripTitle = document.getElementById('tripTitle');
    const tripDetails = document.getElementById('tripDetails');
    const criteriaFilters = document.getElementById('criteria-filters');
    const hotelsList = document.getElementById('hotelsList');
    const btnShowDetailedView = document.getElementById('btnShowDetailedView');
    const detailedTableContainer = document.getElementById('detailedTableContainer');
    const chartContainer = document.getElementById('chartContainer');
    document.getElementById('backToTripLink').href = `viaje.html?id=${tripId}`;

    // --- ESTADO GLOBAL ---
    let localTripConfig = {};
    let allHotels = [];
    let showDetailedTable = false; // State to track which view is active

    // --- CARGA DE DATOS ---
    // 1. Cargar Info del Viaje y su configuración
    const tripDoc = await tripRef.get();
    if (tripDoc.exists) {
        const data = tripDoc.data();
        tripTitle.textContent = data.name;
        tripDetails.textContent = `${data.city} | ${data.rooms} hab. | ${data.people} pers.`;
        if (data.criteriaConfig) {
            localTripConfig = data.criteriaConfig;
        }
    }

    // 2. Cargar Hoteles (una sola vez, no en tiempo real para esta vista)
    const hotelsSnapshot = await hotelsCollection.get();
    allHotels = hotelsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Now that all data is loaded, render filters and initial ranking views
    renderCriteriaFilters();
    updateRankingViews(); // Initial render of the correct view


    // --- RENDERIZADO Y LÓGICA ---

    function renderCriteriaFilters() {
        // Agrupar por categoría
        const groupedByCategory = {};
        Object.keys(localTripConfig).forEach(charId => {
            const config = localTripConfig[charId];
            if (!groupedByCategory[config.category]) {
                groupedByCategory[config.category] = [];
            }
            groupedByCategory[config.category].push({ id: charId, ...config });
        });

        criteriaFilters.innerHTML = '';
        const sortedCategories = Object.keys(groupedByCategory).sort();

        sortedCategories.forEach(category => {
            const details = document.createElement('details');
            details.open = true; // Abierto por defecto

            const summary = document.createElement('summary');
            summary.innerHTML = `<strong>${category}</strong>`;
            details.appendChild(summary);

            const list = document.createElement('ul');
            list.className = 'criteria-filter-list';

            groupedByCategory[category].forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <label>
                        <input type="checkbox" data-char-id="${item.id}" ${item.active ? 'checked' : ''}>
                        ${item.name} (x${item.weight})
                    </label>
                `;
                list.appendChild(li);
            });
            details.appendChild(list);
            criteriaFilters.appendChild(details);
        });

        // Añadir event listeners
        criteriaFilters.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const charId = e.target.dataset.charId;
                if (localTripConfig[charId]) {
                    localTripConfig[charId].active = e.target.checked;
                    updateRankingViews(); // Recalcular y renderizar ambas vistas
                }
            });
        });
    }

    // Helper function to get ranked hotels (to avoid recalculating multiple times)
    function getRankedHotels() {
        // 1. Calcular puntuación por PRECIO
        const sortedByPrice = [...allHotels].sort((a, b) => (a.price || 0) - (b.price || 0));
        const priceScoreMap = {};
        sortedByPrice.forEach((h, index) => {
            priceScoreMap[h.id] = 10 - (index * 3);
        });

        // 2. Calcular puntuaciones totales y ordenar
        return allHotels.map(h => {
            const ratingScore = calculateTotalScore(h.ratings, localTripConfig);
            const priceScore = priceScoreMap[h.id] || 0;
            return { ...h, ratingScore, priceScore, totalScore: ratingScore + priceScore };
        }).sort((a, b) => b.totalScore - a.totalScore);
    }

    function calculateTotalScore(ratings, config) {
        let total = 0;
        if (!ratings) return 0;
        
        Object.keys(config).forEach(charId => {
            const criterion = config[charId];
            if (criterion.active) { // Solo sumar si está activo
                const rating = ratings[charId] || 0;
                total += rating * criterion.weight;
            }
        });
        return total;
    }

    function renderHotelsRanking() {
        const rankedHotels = getRankedHotels();

        hotelsList.innerHTML = '';
        if (rankedHotels.length === 0) {
            hotelsList.innerHTML = '<p style="text-align: center;">No hay hoteles para comparar.</p>';
            return;
        }

        rankedHotels.forEach((hotel, index) => {
            const card = document.createElement('div');
            card.className = 'hotel-card';
            if (index === 0) {
                card.classList.add('hotel-winner'); // Add winner class
            }
            // Simplificamos la tarjeta para esta vista
            card.innerHTML = `
                <div class="hotel-header">
                    <div class="hotel-position">#${index + 1}</div>
                    <div style="font-weight: 600; font-size: 1.1rem;">${hotel.name}</div>
                    <div class="hotel-price">${hotel.price} €</div>
                    <div class="hotel-score">${hotel.totalScore} pts</div>
                </div>
            `;
            hotelsList.appendChild(card);
        });
    }

    function renderDetailedTable() {
        const rankedHotels = getRankedHotels();

        if (rankedHotels.length === 0) {
            detailedTableContainer.innerHTML = '<p style="text-align: center;">No hay hoteles para comparar en detalle.</p>';
            return;
        }

        const activeCharacteristicsByCategory = {};
        Object.keys(localTripConfig).forEach(charId => {
            const config = localTripConfig[charId];
            if (config.active) {
                if (!activeCharacteristicsByCategory[config.category]) {
                    activeCharacteristicsByCategory[config.category] = [];
                }
                activeCharacteristicsByCategory[config.category].push({ id: charId, ...config });
            }
        });

        let tableHtml = `
            <table class="detailed-comparison-table">
                <thead>
                    <tr>
                        <th class="sticky-header-col"></th> <!-- Empty for category/char names -->
                        ${rankedHotels.map(h => `<th><div>${h.name}<br><small class="header-price-display">${h.price} €</small></div></th>`).join('')}
                    </tr>
                    <tr>
                        <th class="sticky-header-col">Total Puntos</th>
                        ${rankedHotels.map(h => `<th>${h.totalScore} pts</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        // Add price score row
        tableHtml += `
            <tr class="price-score-row">
                <td class="sticky-header-col"><strong>💰 Puntuación Precio</strong></td>
                ${rankedHotels.map(h => `<td><strong>${h.priceScore} pts</strong></td>`).join('')}
            </tr>
        `;

        const sortedCategories = Object.keys(activeCharacteristicsByCategory).sort();

        sortedCategories.forEach(category => {
            // Generar un ID seguro para la clase (eliminando caracteres especiales como emojis o puntos)
            const safeCategoryClass = 'cat-' + category.replace(/[^a-zA-Z0-9]/g, '-');

            // Category row
            // Calcular media para esta categoría por hotel
            const categoryCells = rankedHotels.map(h => {
                let sumPoints = 0;
                let sumWeights = 0;
                
                activeCharacteristicsByCategory[category].forEach(char => {
                    const rating = h.ratings ? (h.ratings[char.id] || 0) : 0;
                    sumPoints += rating * char.weight;
                    sumWeights += char.weight;
                });

                const avg = sumWeights > 0 ? (sumPoints / sumWeights).toFixed(1) : '0.0';
                return `<td style="background-color: #eef2f5; font-weight:bold; color: var(--primary-color);">${avg}</td>`;
            }).join('');

            tableHtml += `
                <tr class="category-row" data-category="${category}">
                    <td class="sticky-header-col category-toggle">
                        <i class="fas fa-chevron-down category-chevron"></i> <strong>${category}</strong>
                    </td>
                    ${categoryCells}
                </tr>
            `;
            // Characteristic rows for this category
            activeCharacteristicsByCategory[category].forEach(char => {
                tableHtml += `
                    <tr class="characteristic-row ${safeCategoryClass}">
                        <td class="sticky-header-col char-name-cell">${char.name} (x${char.weight})</td>
                        ${rankedHotels.map(h => `<td>${h.ratings ? (h.ratings[char.id] || 0) : 0}</td>`).join('')}
                    </tr>
                `;
            });
        });

        tableHtml += `
                </tbody>
            </table>
        `;
        detailedTableContainer.innerHTML = tableHtml;

        // Add event listeners for collapsing categories
        detailedTableContainer.querySelectorAll('.category-row').forEach(row => {
            row.addEventListener('click', () => {
                const category = row.dataset.category;
                const safeCategoryClass = 'cat-' + category.replace(/[^a-zA-Z0-9]/g, '-');
                const charRows = detailedTableContainer.querySelectorAll(`.characteristic-row.${safeCategoryClass}`);
                const chevron = row.querySelector('.category-chevron');
                charRows.forEach(charRow => {
                    charRow.classList.toggle('hidden-char-row');
                });
                chevron.classList.toggle('fa-chevron-down');
                chevron.classList.toggle('fa-chevron-up');
            });
        });
    }

    function renderBarChart() {
        const rankedHotels = getRankedHotels();

        if (rankedHotels.length === 0) {
            chartContainer.innerHTML = '';
            return;
        }

        const maxScore = Math.max(...rankedHotels.map(h => h.totalScore), 0);

        let chartHtml = '<h3><i class="fas fa-chart-bar"></i> Gráfico de Puntuaciones</h3><div class="chart-wrapper">';

        rankedHotels.forEach(hotel => {
            const barWidth = maxScore > 0 ? (hotel.totalScore / maxScore) * 100 : 0;
            chartHtml += `
                <div class="chart-bar-item">
                    <div class="chart-label" title="${hotel.name}">${hotel.name}</div>
                    <div class="chart-bar-container">
                        <div class="chart-bar" style="width: ${barWidth}%;"></div>
                    </div>
                    <div class="chart-value">${hotel.totalScore} pts</div>
                </div>
            `;
        });

        chartHtml += '</div>';
        chartContainer.innerHTML = chartHtml;
    }

    // Function to update both ranking views based on current state
    function updateRankingViews() {
        if (showDetailedTable) {
            hotelsList.style.display = 'none';
            detailedTableContainer.style.display = 'block';
            chartContainer.style.display = 'block';
            renderDetailedTable();
            renderBarChart();
        } else {
            hotelsList.style.display = 'flex'; // Assuming flex-direction: column for hotelsList
            detailedTableContainer.style.display = 'none';
            chartContainer.style.display = 'none';
            renderHotelsRanking(); // This will re-render the simplified list
        }
    }

    btnShowDetailedView.addEventListener('click', () => {
        showDetailedTable = !showDetailedTable;
        btnShowDetailedView.innerHTML = showDetailedTable 
            ? '<i class="fas fa-list"></i> Ver Ranking Simple' 
            : '<i class="fas fa-table"></i> Ver Tabla Detallada';
        btnShowDetailedView.title = showDetailedTable ? 'Ver ranking simple' : 'Ver tabla detallada';
        updateRankingViews();
    });
});