document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const createCharacteristicForm = document.getElementById('createCharacteristicForm');
    const characteristicsGrid = document.getElementById('characteristicsGrid');
    const charNameInput = document.getElementById('charName');
    const charCategoryInput = document.getElementById('charCategory');
    const btnResetCatalog = document.getElementById('btnResetCatalog');

    // --- CATÁLOGO 2026: 5 categorías universales (siempre marcadas) + 9 adicionales ---
    // Se expone en window para que otras páginas (ej. mis-viajes.js) puedan reutilizarlo si Firestore aún está vacío.
    const CRITERIA_CATALOG = [
        { category: "🥇 1. Precio y relación calidad-precio", order: 1, isUniversal: true, items: [
            "Precio total", "Costes y tasas adicionales", "Relación calidad-precio", "Flexibilidad de cancelación", "Correspondencia entre lo anunciado y lo recibido"
        ]},
        { category: "📍 2. Ubicación", order: 2, isUniversal: true, items: [
            "Ubicación", "Cercanía a puntos de interés", "Cercanía a transporte público", "Oferta de restaurantes y comercios cercanos", "Seguridad de la zona", "Ruido del entorno"
        ]},
        { category: "🧼 3. Limpieza y estado", order: 3, isUniversal: true, items: [
            "Limpieza", "Estado de mantenimiento", "Estado general del edificio", "Ausencia de malos olores", "Estado de las instalaciones"
        ]},
        { category: "🛏️ 4. Habitación y comodidad", order: 4, isUniversal: true, items: [
            "Comodidad de la cama", "Tamaño de la habitación", "Calidad de sábanas y toallas", "Climatización", "Insonorización", "Iluminación", "Espacio de almacenamiento", "Calidad de las vistas"
        ]},
        { category: "⭐ 5. Opiniones de otros huéspedes", order: 5, isUniversal: true, items: [
            "Nota media de los huéspedes", "Número de opiniones", "Consistencia de las opiniones", "Recencia de las opiniones", "Problemas recurrentes en las opiniones", "Valoración de la limpieza por los huéspedes"
        ]},
        { category: "🚿 6. Baño", order: 6, isUniversal: false, items: [
            "Limpieza del baño", "Calidad de la ducha", "Presión del agua", "Temperatura del agua", "Tamaño del baño", "Calidad de los artículos de aseo", "Calidad del secador"
        ]},
        { category: "🧑‍💼 7. Atención y servicio", order: 7, isUniversal: false, items: [
            "Amabilidad del personal", "Rapidez del check-in", "Facilidad del check-in", "Atención durante la estancia", "Capacidad para resolver problemas", "Disponibilidad de atención 24 horas"
        ]},
        { category: "🚗 8. Aparcamiento, transporte y accesibilidad", order: 8, isUniversal: false, items: [
            "Disponibilidad de parking", "Precio del parking", "Seguridad del parking", "Facilidad de acceso al alojamiento", "Accesibilidad para movilidad reducida", "Cercanía al aeropuerto", "Carga para vehículos eléctricos"
        ]},
        { category: "🍽️ 9. Gastronomía", order: 9, isUniversal: false, items: [
            "Calidad del desayuno", "Variedad del desayuno", "Calidad del restaurante", "Relación calidad-precio de la gastronomía", "Opciones para dietas especiales", "Calidad del servicio de habitaciones"
        ]},
        { category: "🧖 10. Instalaciones", order: 10, isUniversal: false, items: [
            "Calidad de la piscina", "Calidad del spa", "Calidad del gimnasio", "Calidad de las zonas comunes", "Calidad de la terraza", "Espacios para trabajar"
        ]},
        { category: "🌐 11. Conectividad y tecnología", order: 11, isUniversal: false, items: [
            "Calidad del WiFi", "Estabilidad del WiFi", "Cobertura móvil", "Disponibilidad de enchufes", "Calidad del espacio de trabajo"
        ]},
        { category: "👨‍👩‍👧 12. Adecuación al tipo de viajero", order: 12, isUniversal: false, items: [
            "Adecuación para familias", "Adecuación para parejas", "Adecuación para viajes de negocios", "Adecuación para mascotas", "Adecuación para estancias largas"
        ]},
        { category: "🌱 13. Sostenibilidad", order: 13, isUniversal: false, items: [
            "Compromiso con la sostenibilidad", "Uso de energías renovables", "Reducción de plásticos", "Gestión de residuos"
        ]},
        { category: "✨ 14. Experiencia y diferenciación", order: 14, isUniversal: false, items: [
            "Diseño y estética", "Personalidad del alojamiento", "Calidad de la experiencia", "Servicios diferenciales", "Cumplimiento de las expectativas"
        ]}
    ];
    window.CRITERIA_CATALOG = CRITERIA_CATALOG;

    // Referencia a la colección de Firestore (la variable `db` viene de firebase-config.js)
    const characteristicsCollection = db.collection('characteristics');

    // --- LÓGICA DE LA UI ---

    // Manejar el envío del formulario para crear una característica
    createCharacteristicForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const characteristicData = {
            name: charNameInput.value,
            category: charCategoryInput.value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await characteristicsCollection.add(characteristicData);
            console.log('Característica creada con éxito');
            createCharacteristicForm.reset();
        } catch (error) {
            console.error("Error al crear la característica: ", error);
            alert('Hubo un error al crear la característica.');
        }
    });

    // Sustituir todo el catálogo actual por el nuevo (5 universales + 9 adicionales)
    btnResetCatalog.addEventListener('click', async () => {
        const confirmation = confirm('Esto BORRARÁ todas las características actuales y las sustituirá por el nuevo catálogo 2026.\n\nLos viajes ya creados podrían perder su configuración de criterios.\n\n¿Quieres continuar?');
        if (!confirmation) return;

        btnResetCatalog.disabled = true;
        try {
            // 1. Borrar el catálogo actual (por lotes de 500, límite de Firestore)
            const existingDocs = await characteristicsCollection.get();
            const docsRefs = existingDocs.docs.map(d => d.ref);
            for (let i = 0; i < docsRefs.length; i += 500) {
                const batch = db.batch();
                docsRefs.slice(i, i + 500).forEach(ref => batch.delete(ref));
                await batch.commit();
            }

            // 2. Insertar el nuevo catálogo
            const newDocs = [];
            CRITERIA_CATALOG.forEach(group => {
                group.items.forEach(name => {
                    newDocs.push({
                        name,
                        category: group.category,
                        categoryOrder: group.order,
                        isUniversal: group.isUniversal,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
            });
            for (let i = 0; i < newDocs.length; i += 500) {
                const batch = db.batch();
                newDocs.slice(i, i + 500).forEach(data => batch.set(characteristicsCollection.doc(), data));
                await batch.commit();
            }

            alert('¡Catálogo de criterios actualizado correctamente!');
        } catch (error) {
            console.error('Error al restaurar el catálogo:', error);
            alert('Hubo un error al restaurar el catálogo.');
        } finally {
            btnResetCatalog.disabled = false;
        }
    });

    // --- RENDERIZADO ---

    // --- LÓGICA DE FIREBASE ---

    // Escuchar cambios en tiempo real en la colección de características
    characteristicsCollection.orderBy('category').onSnapshot(snapshot => {
        if (snapshot.empty) {
            characteristicsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No hay características definidas. Usa el botón "Restaurar catálogo 2026" para cargarlas.</p>';
            return;
        }

        // 1. Agrupar los datos por categoría
        const groupedData = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            if (!groupedData[data.category]) {
                groupedData[data.category] = [];
            }
            groupedData[data.category].push({ id, ...data });
        });

        // 2. Renderizar las tarjetas
        characteristicsGrid.innerHTML = ''; // Limpiar grid
        
        // Ordenar las categorías por el campo categoryOrder (o, si no existe, por el número al principio del nombre)
        const sortedCategories = Object.keys(groupedData).sort((a, b) => {
            const orderA = groupedData[a][0].categoryOrder ?? parseInt(a.match(/^.*?(\d+)\./)?.[1] || 0);
            const orderB = groupedData[b][0].categoryOrder ?? parseInt(b.match(/^.*?(\d+)\./)?.[1] || 0);
            return orderA - orderB;
        });

        sortedCategories.forEach(category => {
            const isUniversal = !!groupedData[category][0].isUniversal;

            // Crear tarjeta de categoría
            const card = document.createElement('div');
            card.classList.add('category-card');
            
            // Header de la tarjeta
            const header = document.createElement('div');
            header.classList.add('category-header');
            header.innerHTML = isUniversal
                ? `${category} <span class="universal-badge">UNIVERSAL</span>`
                : category;
            card.appendChild(header);

            // Lista de items
            const list = document.createElement('div');
            list.classList.add('category-list');

            groupedData[category].forEach(item => {
                const row = document.createElement('div');
                row.classList.add('category-list-item');
                row.innerHTML = `
                    <span>${item.name}</span>
                    <div class="actions">
                        <button class="btn-delete" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                
                // Evento borrar
                row.querySelector('.btn-delete').addEventListener('click', async () => {
                    if(confirm(`¿Borrar "${item.name}"?`)) {
                        await characteristicsCollection.doc(item.id).delete();
                    }
                });

                list.appendChild(row);
            });

            card.appendChild(list);
            characteristicsGrid.appendChild(card);
        });

    }, error => {
        console.error("Error al obtener características: ", error);
        characteristicsGrid.innerHTML = '<p>Error al cargar las características.</p>';
    });
});
