document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const tripsList = document.getElementById('tripsList');
    const createTripCard = document.getElementById('createTripCard');
    const showCreateTripBtn = document.getElementById('showCreateTripBtn');
    const createTripForm = document.getElementById('createTripForm');
    const editTripModal = document.getElementById('editTripModal');
    const editTripForm = document.getElementById('editTripForm');
    const cancelEditTrip = document.getElementById('cancelEditTrip');

    // --- REFERENCIA A FIREBASE ---
    const tripsCollection = db.collection('trips');

    // --- ESTADO ---
    let editingTripId = null;

    // --- LÓGICA DE LA UI ---

    // Mostrar/ocultar el formulario de creación
    showCreateTripBtn.addEventListener('click', () => {
        const isHidden = createTripCard.style.display === 'none';
        createTripCard.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            createTripCard.scrollIntoView({ behavior: 'smooth' });
        }
    });

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
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await tripsCollection.add(tripData);
            createTripForm.reset();
            createTripCard.style.display = 'none';
            // La lista se actualizará automáticamente gracias al listener onSnapshot
        } catch (error) {
            console.error("Error al crear el viaje: ", error);
            alert('Hubo un error al crear el viaje.');
        }
    });

    // --- LÓGICA DE EDICIÓN Y BORRADO ---

    // Usar delegación de eventos para los botones de la lista
    tripsList.addEventListener('click', async (e) => {
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

    // --- RENDERIZADO DE VIAJES ---

    // Escuchar cambios en tiempo real en la colección de viajes
    tripsCollection.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        if (snapshot.empty) {
            tripsList.innerHTML = '<p>No hay viajes creados. ¡Anímate y crea el primero!</p>';
            return;
        }

        tripsList.innerHTML = ''; // Limpiar la lista antes de renderizar
        snapshot.forEach(doc => {
            const trip = doc.data();
            const tripId = doc.id;

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
                    <a href="viaje.html?id=${tripId}" class="btn-primary btn-open-trip">Abrir</a>
                    <button class="btn-secondary btn-icon btn-edit-trip" data-id="${tripId}" title="Editar Viaje"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-danger btn-icon btn-delete-trip" data-id="${tripId}" title="Eliminar Viaje"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            tripsList.appendChild(tripElement);
        });

    }, error => {
        console.error("Error al obtener los viajes: ", error);
        tripsList.innerHTML = '<p>Error al cargar los viajes. Revisa la consola para más detalles.</p>';
    });
});