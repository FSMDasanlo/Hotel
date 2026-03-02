document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    // La variable `db` viene de `firebase-config.js`
    const tripsCollection = db.collection('trips');

    const showCreateTripBtn = document.getElementById('showCreateTripBtn');
    const createTripCard = document.getElementById('createTripCard');
    const createTripForm = document.getElementById('createTripForm');
    const tripsList = document.getElementById('tripsList');

    // --- LÓGICA DE LA UI ---

    // Mostrar/ocultar el formulario para crear un nuevo viaje
    showCreateTripBtn.addEventListener('click', () => {
        const isVisible = createTripCard.style.display === 'block';
        createTripCard.style.display = isVisible ? 'none' : 'block';
        showCreateTripBtn.innerHTML = isVisible 
            ? '<i class="fas fa-plus"></i> Nuevo Viaje' 
            : '<i class="fas fa-times"></i> Cancelar';
    });

    // Manejar el envío del formulario para crear un viaje
    createTripForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const tripData = {
            name: document.getElementById('tripName').value,
            city: document.getElementById('tripCity').value,
            // Guardar fechas como Timestamps de Firestore para poder ordenarlas correctamente
            startDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tripStartDate').value)),
            endDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tripEndDate').value)),
            rooms: parseInt(document.getElementById('tripRooms').value),
            people: parseInt(document.getElementById('tripPeople').value),
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // Usar el timestamp del servidor
        };

        console.log('Nuevo viaje a crear:', tripData);
        
        try {
            await tripsCollection.add(tripData);
            console.log('Viaje creado con éxito');
            createTripForm.reset();
            createTripCard.style.display = 'none';
            showCreateTripBtn.innerHTML = '<i class="fas fa-plus"></i> Nuevo Viaje';
            // La lista se actualizará automáticamente gracias a onSnapshot
        } catch (error) {
            console.error("Error al crear el viaje: ", error);
            alert('Hubo un error al crear el viaje. Revisa la consola para más detalles.');
        }
    });


    // --- LÓGICA DE FIREBASE ---

    /**
     * Formatea una fecha de Firestore a un formato legible (dd/mm/yyyy)
     * @param {firebase.firestore.Timestamp} timestamp 
     */
    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Carga los viajes desde Firestore en tiempo real y los muestra en la lista.
     */
    function loadTrips() {
        tripsList.innerHTML = '<p>Cargando Viajes...</p>';

        // Escuchar cambios en tiempo real
        tripsCollection.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                tripsList.innerHTML = '<p>No hay viajes creados. ¡Crea el primero usando el botón "Nuevo Viaje"!</p>';
                return;
            }
            
            tripsList.innerHTML = ''; // Limpiar la lista antes de renderizar
            snapshot.forEach(doc => {
                const trip = doc.data();
                const tripId = doc.id;
                const tripElement = document.createElement('div');
                tripElement.classList.add('trip-item'); // Necesitaremos estilos para esta clase
                tripElement.setAttribute('data-id', tripId);

                tripElement.innerHTML = `
                    <div class="trip-info">
                        <div class="trip-row-main">
                            <h3>${trip.name}</h3>
                            <span class="trip-city"><i class="fas fa-map-marker-alt"></i> ${trip.city}</span>
                        </div>
                        <div class="trip-row-details">
                            <span><i class="fas fa-calendar-alt"></i> ${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}</span>
                            <span><i class="fas fa-bed"></i> ${trip.rooms} hab. / <i class="fas fa-users"></i> ${trip.people} pers.</span>
                        </div>
                    </div>
                    <button class="btn-primary btn-open-trip" onclick="window.location.href='viaje.html?id=${tripId}'">Abrir Viaje</button>
                `;
                tripsList.appendChild(tripElement);
            });
        }, error => {
            console.error("Error al cargar los viajes: ", error);
            tripsList.innerHTML = '<p>Error al cargar los viajes. Revisa la consola y las reglas de seguridad de Firestore.</p>';
        });
    }

    // Carga inicial de los viajes al cargar la página
    loadTrips();

});