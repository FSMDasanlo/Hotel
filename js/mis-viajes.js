document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const tripsList = document.getElementById('tripsList');
    const createTripCard = document.getElementById('createTripCard');
    const showCreateTripBtn = document.getElementById('showCreateTripBtn');
    const createTripForm = document.getElementById('createTripForm');
    const editTripModal = document.getElementById('editTripModal');
    const editTripForm = document.getElementById('editTripForm');
    const cancelEditTrip = document.getElementById('cancelEditTrip');
    const showAllTripsContainer = document.getElementById('showAllTripsContainer');
    const showAllTripsBtn = document.getElementById('showAllTripsBtn');
    const tripsListTitle = document.getElementById('tripsListTitle');
    const criteriaWarningModal = document.getElementById('criteriaWarningModal');
    const criteriaWarningText = document.getElementById('criteriaWarningText');
    const btnGoToCriteria = document.getElementById('btnGoToCriteria');
    const btnCancelCriteriaWarning = document.getElementById('btnCancelCriteriaWarning');
    const universalCriteriaContainer = document.getElementById('universalCriteriaContainer');
    const additionalCriteriaContainer = document.getElementById('additionalCriteriaContainer');
    const toggleAdditionalCriteria = document.getElementById('toggleAdditionalCriteria');

    // --- REFERENCIA A FIREBASE ---
    const tripsCollection = db.collection('trips');
    const characteristicsCollection = db.collection('characteristics');

    // --- ESTADO ---
    let editingTripId = null;
    let allTrips = [];
    let showAllTrips = false;
    let pendingCriteriaTripId = null;
    const TRIPS_PREVIEW_COUNT = 3;
    const MIN_REQUIRED_CRITERIA = 3; // Mínimo de criterios activos recomendado para comparar hoteles

    // --- LÓGICA DE LA UI ---

    // Mostrar/ocultar el formulario de creación
    showCreateTripBtn.addEventListener('click', () => {
        const isHidden = createTripCard.style.display === 'none';
        createTripCard.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            createTripCard.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Desplegar/ocultar el bloque de criterios adicionales
    toggleAdditionalCriteria.addEventListener('click', () => {
        const isHidden = additionalCriteriaContainer.style.display === 'none';
        additionalCriteriaContainer.style.display = isHidden ? 'block' : 'none';
        toggleAdditionalCriteria.classList.toggle('open', isHidden);
    });

    // --- CRITERIOS: CARGA Y RENDERIZADO EN EL ALTA DE VIAJE ---

    function buildCriteriaCard(group) {
        const card = document.createElement('div');
        card.classList.add('criteria-selector-card');

        const header = document.createElement('div');
        header.classList.add('category-header');
        header.innerHTML = group.isUniversal
            ? `${group.category} <span class="universal-badge">UNIVERSAL</span>`
            : group.category;
        card.appendChild(header);

        group.items.forEach(char => {
            const row = document.createElement('div');
            row.classList.add('criteria-selector-item');
            row.innerHTML = `
                <input type="checkbox" class="criteria-active-checkbox" data-char-id="${char.id}" ${group.isUniversal ? 'checked' : ''}>
                <label>${char.name}</label>
                <input type="number" class="criteria-weight-input" data-char-id="${char.id}" min="1" max="9" value="5">
            `;
            card.appendChild(row);
        });

        return card;
    }

    async function loadCriteriaSelectors() {
        try {
            const snapshot = await characteristicsCollection.orderBy('category').get();
            const allCharacteristics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const groupedByCat = allCharacteristics.reduce((acc, char) => {
                if (!acc[char.category]) acc[char.category] = [];
                acc[char.category].push(char);
                return acc;
            }, {});

            const sortedCategories = Object.keys(groupedByCat).sort((a, b) => {
                const orderA = groupedByCat[a][0].categoryOrder ?? 999;
                const orderB = groupedByCat[b][0].categoryOrder ?? 999;
                return orderA - orderB;
            });

            universalCriteriaContainer.innerHTML = '';
            additionalCriteriaContainer.innerHTML = '';

            sortedCategories.forEach(category => {
                const items = groupedByCat[category];
                const isUniversal = !!items[0].isUniversal;
                const card = buildCriteriaCard({ category, isUniversal, items });
                (isUniversal ? universalCriteriaContainer : additionalCriteriaContainer).appendChild(card);
            });

            // Si no hay ninguna categoría marcada como universal, el catálogo de Firestore aún no está actualizado
            if (universalCriteriaContainer.children.length === 0) {
                universalCriteriaContainer.innerHTML = `
                    <div class="criteria-selector-card" style="border-color: #f0ad4e; background: #fff8ec;">
                        <p style="margin: 0; font-size: 0.9rem;">
                            <i class="fas fa-exclamation-triangle" style="color: #f0ad4e;"></i>
                            Aún no se ven los criterios universales porque el catálogo de Firestore no está actualizado.
                            Ve a <a href="caracteristicas.html">Gestionar Criterios</a> y pulsa <strong>"Restaurar catálogo 2026"</strong>, luego vuelve aquí.
                        </p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error al cargar los criterios:', error);
            universalCriteriaContainer.innerHTML = '<p>Error al cargar los criterios.</p>';
        }
    }

    loadCriteriaSelectors();

    // Construye el criteriaConfig a guardar con el viaje a partir de los checkboxes marcados
    function collectCriteriaConfig() {
        const criteriaConfig = {};
        createTripForm.querySelectorAll('.criteria-active-checkbox').forEach(checkbox => {
            if (!checkbox.checked) return;
            const charId = checkbox.dataset.charId;
            const weightInput = createTripForm.querySelector(`.criteria-weight-input[data-char-id="${charId}"]`);
            const row = checkbox.closest('.criteria-selector-item');
            const name = row.querySelector('label').textContent;
            const category = row.closest('.criteria-selector-card').querySelector('.category-header').firstChild.textContent.trim();
            criteriaConfig[charId] = {
                active: true,
                weight: parseInt(weightInput.value, 10) || 5,
                name,
                category
            };
        });
        return criteriaConfig;
    }

    // Manejar el envío del formulario para crear un viaje
    createTripForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tripData = {
            name: document.getElementById('tripName').value,
            city: document.getElementById('tripCity').value,
            startDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tripStartDate').value)),
            endDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tripEndDate').value)),
            rooms: parseInt(document.getElementById('tripRooms').value),
            people: parseInt(document.getElementById('tripPeople').value),
            themeColor: document.getElementById('tripThemeColor').value,
            criteriaConfig: collectCriteriaConfig(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await tripsCollection.add(tripData);
            createTripForm.reset();
            createTripCard.style.display = 'none';
            additionalCriteriaContainer.style.display = 'none';
            toggleAdditionalCriteria.classList.remove('open');
            // La lista se actualizará automáticamente gracias al listener onSnapshot
        } catch (error) {
            console.error("Error al crear el viaje: ", error);
            alert('Hubo un error al crear el viaje.');
        }
    });

    // --- LÓGICA DE EDICIÓN Y BORRADO ---

    // Usar delegación de eventos para los botones de la lista
    tripsList.addEventListener('click', async (e) => {
        const openLink = e.target.closest('.btn-open-trip');
        if (openLink) {
            e.preventDefault();
            const tripId = openLink.dataset.id;
            handleOpenTrip(tripId, openLink.href);
            return;
        }

        const editButton = e.target.closest('.btn-edit-trip');
        if (editButton) {
            const tripId = editButton.dataset.id;
            handleEditTrip(tripId);
        }

        const deleteButton = e.target.closest('.btn-delete-trip');
        if (deleteButton) {
            const tripId = deleteButton.dataset.id;
            handleDeleteTrip(tripId);
        }
    });

    // Comprueba que el viaje tenga criterios suficientes marcados antes de abrirlo
    async function handleOpenTrip(tripId, tripUrl) {
        try {
            const tripDoc = await tripsCollection.doc(tripId).get();
            const tripData = tripDoc.exists ? tripDoc.data() : {};
            const criteriaConfig = tripData.criteriaConfig || {};
            const activeCount = Object.values(criteriaConfig).filter(c => c.active).length;

            if (activeCount < MIN_REQUIRED_CRITERIA) {
                pendingCriteriaTripId = tripId;
                criteriaWarningText.textContent = `El viaje "${tripData.name || ''}" solo tiene ${activeCount} criterio(s) marcado(s). Te recomendamos configurar al menos ${MIN_REQUIRED_CRITERIA} para poder comparar bien los hoteles.`;
                criteriaWarningModal.style.display = 'flex';
                return;
            }

            window.location.href = tripUrl;
        } catch (error) {
            console.error('Error al comprobar los criterios del viaje:', error);
            window.location.href = tripUrl;
        }
    }

    btnGoToCriteria.addEventListener('click', () => {
        if (pendingCriteriaTripId) {
            window.location.href = `viaje.html?id=${pendingCriteriaTripId}&openCriteria=1`;
        }
    });

    btnCancelCriteriaWarning.addEventListener('click', () => {
        pendingCriteriaTripId = null;
        criteriaWarningModal.style.display = 'none';
    });

    async function handleEditTrip(tripId) {
        editingTripId = tripId;
        const tripDoc = await tripsCollection.doc(tripId).get();
        if (!tripDoc.exists) return alert("El viaje no existe.");
        
        const tripData = tripDoc.data();
        document.getElementById('editTripName').value = tripData.name;
        document.getElementById('editTripPeople').value = tripData.people;
        if (tripData.startDate) {
            document.getElementById('editTripStartDate').value = tripData.startDate.toDate().toISOString().split('T')[0];
        }
        if (tripData.endDate) {
            document.getElementById('editTripEndDate').value = tripData.endDate.toDate().toISOString().split('T')[0];
        }
        editTripModal.style.display = 'flex';
    }

    async function handleDeleteTrip(tripId) {
        const tripDoc = await tripsCollection.doc(tripId).get();
        if (!tripDoc.exists) return;

        const confirmation = confirm(`¿Estás SEGURO de que quieres eliminar el viaje "${tripDoc.data().name}"?\n\n¡ESTA ACCIÓN ES PERMANENTE Y BORRARÁ TODOS LOS HOTELES ASOCIADOS!`);
        if (!confirmation) return;

        try {
            const hotelsSnapshot = await tripsCollection.doc(tripId).collection('hotels').get();
            const batch = db.batch();
            hotelsSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            await tripsCollection.doc(tripId).delete();
            alert('El viaje ha sido eliminado correctamente.');
        } catch (error) {
            console.error("Error al eliminar el viaje:", error);
            alert("Hubo un error al eliminar el viaje.");
        }
    }

    editTripForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editingTripId) return;
        const updatedData = {
            name: document.getElementById('editTripName').value,
            people: parseInt(document.getElementById('editTripPeople').value),
            startDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('editTripStartDate').value)),
            endDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('editTripEndDate').value))
        };
        try {
            await tripsCollection.doc(editingTripId).update(updatedData);
            editTripModal.style.display = 'none';
        } catch (error) {
            console.error("Error al actualizar viaje:", error);
            alert("Error al actualizar los datos del viaje.");
        } finally {
            editingTripId = null;
        }
    });

    cancelEditTrip.addEventListener('click', () => {
        editTripModal.style.display = 'none';
    });

    showAllTripsBtn.addEventListener('click', () => {
        showAllTrips = true;
        renderTrips();
    });

    // --- RENDERIZADO DE VIAJES ---

    function renderTrips() {
        tripsListTitle.textContent = showAllTrips ? 'Todos los viajes' : 'Últimos viajes creados';

        if (allTrips.length === 0) {
            tripsList.innerHTML = '<p>No hay viajes creados. ¡Anímate y crea el primero!</p>';
            showAllTripsContainer.style.display = 'none';
            return;
        }

        const tripsToRender = showAllTrips ? allTrips : allTrips.slice(0, TRIPS_PREVIEW_COUNT);

        tripsList.innerHTML = ''; // Limpiar la lista antes de renderizar
        tripsToRender.forEach(({ id: tripId, data: trip }) => {
            const tripElement = document.createElement('div');
            tripElement.classList.add('trip-item');
            tripElement.style.borderLeftColor = trip.themeColor || 'var(--primary-color)';

            // Formatear fechas
            const startDate = trip.startDate ? trip.startDate.toDate().toLocaleDateString('es-ES') : 'N/A';
            const endDate = trip.endDate ? trip.endDate.toDate().toLocaleDateString('es-ES') : 'N/A';

            tripElement.innerHTML = `
                <div class="trip-info">
                    <div class="trip-row-main">
                        <h3>${trip.name}</h3>
                        <span class="trip-city">${trip.city}</span>
                    </div>
                    <div class="trip-row-details">
                        <span><i class="fas fa-calendar-alt"></i> ${startDate} - ${endDate}</span>
                        <span><i class="fas fa-bed"></i> ${trip.rooms} hab.</span>
                        <span><i class="fas fa-users"></i> ${trip.people} pers.</span>
                    </div>
                </div>
                <div class="trip-actions">
                    <a href="viaje.html?id=${tripId}" class="btn-primary btn-open-trip" data-id="${tripId}">Abrir</a>
                    <button class="btn-secondary btn-icon btn-edit-trip" data-id="${tripId}" title="Editar Viaje"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-danger btn-icon btn-delete-trip" data-id="${tripId}" title="Eliminar Viaje"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            tripsList.appendChild(tripElement);
        });

        showAllTripsContainer.style.display = (!showAllTrips && allTrips.length > TRIPS_PREVIEW_COUNT) ? 'block' : 'none';
    }

    // Escuchar cambios en tiempo real en la colección de viajes
    tripsCollection.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        allTrips = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        renderTrips();
    }, error => {
        console.error("Error al obtener los viajes: ", error);
        tripsList.innerHTML = '<p>Error al cargar los viajes. Revisa la consola para más detalles.</p>';
    });
});